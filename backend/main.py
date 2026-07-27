"""
M7-T1 + M7-T3: FastAPI inference service.

Wraps the M6 classifiers (inference.py) behind:
- GET  /health
- POST /predict/email  — single email-track prediction (metrics as input)
- POST /predict/url    — single URL-track prediction
- POST /analyze/email  — paste raw email text or upload a .eml file; parses
                          it, scores the email track and every URL found in
                          the body with the real M6 models, and returns one
                          combined verdict with full per-track detail for the
                          dashboard (M7-T12/T13).

Run locally with:
    uvicorn main:app --port 8000
"""
import hmac
import math
import os
from typing import Optional

import boto3
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from cognito_auth import (
    cognito_configured,
    get_config,
    verify_access_token,
    TokenBackendError,
    TokenError,
)
from inference import predict_email, predict_url
from mime_parser import MimeEmail, body_features, normalize_text

app = FastAPI(title="Email Security Pipeline — Inference API")

# --------------------------------------------------------------------------- #
# CORS — the dashboard SPA calls this API from the browser (localhost in dev,
# the Amplify domains in prod). Without these headers the browser blocks every
# cross-origin call. Origins come from CORS_ALLOWED_ORIGINS (comma-separated).
# --------------------------------------------------------------------------- #
_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000',
    ).split(',')
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

MAX_EMAIL_BYTES = 2 * 1024 * 1024  # 2MB — generous for an email, bounds abuse/latency

# ---------------------------------------------------------------------------
# Verdict thresholding (M7-T1 scope: a simple two-threshold split; M8 owns
# the real tuning pass against the false-positive target).
#
# email_score is an SVM decision_function value (unbounded, 0.0 = the
# confirmed M6-T9 boundary). url_score is a probability in [0, 1] (0.5 = the
# confirmed M6-T9 boundary). Because the two scales aren't comparable, each
# track gets its own quarantine cutoff above the label-1 boundary.
# ---------------------------------------------------------------------------
EMAIL_QUARANTINE_SCORE = float(os.environ.get('EMAIL_QUARANTINE_SCORE', 1.0))
URL_QUARANTINE_SCORE = float(os.environ.get('URL_QUARANTINE_SCORE', 0.85))

_SEVERITY = {'clean': 0, 'flag': 1, 'quarantine': 2}


def _verdict(label: int, score: float, quarantine_at: float) -> str:
    if label == 0:
        return 'clean'
    return 'quarantine' if score >= quarantine_at else 'flag'


def _email_likelihood(score: float) -> float:
    """
    email_linearsvc has no calibrated predict_proba (LinearSVC). This maps
    the decision_function score through a logistic curve as a *display*
    approximation of "how confident", not a statistically calibrated
    probability — clearly worth knowing before trusting it for thresholding.
    """
    return round(100 / (1 + math.exp(-score)), 1)


def _url_likelihood(score: float) -> float:
    """url_charcnn/url_rf both output an actual predict_proba — this is a
    real (if imperfectly calibrated) probability, not a display trick."""
    return round(score * 100, 1)


# ---------------------------------------------------------------------------
# Auth placeholder — full Cognito JWT / signed-token verification is
# M7-T14/M9 scope. Until then: if JWT_SIGNING_KEY isn't set (local dev),
# these routes stay open. If it is set (e.g. once deployed via M7-T7), callers
# must send it as a bearer token so the API isn't silently unauthenticated
# on the public ALB. See docs/m7-t1-fastapi-service.md #4.
# ---------------------------------------------------------------------------
def _bearer_token(request: Request) -> str:
    auth = request.headers.get('authorization', '')
    return auth[7:].strip() if auth[:7].lower() == 'bearer ' else ''


def require_auth(request: Request) -> dict:
    """
    Accepts EITHER:
      - the static JWT_SIGNING_KEY (internal mail content-filter -> API), or
      - a valid Cognito access token (dashboard users).
    Returns a principal descriptor. Local dev with neither configured stays open.
    """
    token = _bearer_token(request)
    signing_key = os.environ.get('JWT_SIGNING_KEY')

    # Internal service caller (mail filter). compare_digest, not ==, so the
    # comparison time doesn't leak how much of the token matched.
    if signing_key and token and hmac.compare_digest(token, signing_key):
        return {'principal': 'service'}

    # Dashboard user via Cognito.
    if cognito_configured():
        if not token:
            raise HTTPException(status_code=401, detail='Unauthorized')
        try:
            claims = verify_access_token(token)
        except TokenBackendError as e:
            # Verification could not run (JWKS unreachable). 503, not 401 — the
            # token may be fine, and telling a signed-in analyst to log in again
            # would send them in circles against a service outage.
            raise HTTPException(status_code=503, detail=str(e))
        except TokenError as e:
            raise HTTPException(status_code=401, detail=str(e))
        return {'principal': 'user', 'claims': claims}

    # Neither the static key nor Cognito configured => local dev, stay open.
    if not signing_key:
        return {'principal': 'anonymous'}

    raise HTTPException(status_code=401, detail='Unauthorized')


def derive_provenance(auth: dict) -> tuple[str, Optional[str], Optional[str]]:
    """
    Decide which feed a detection belongs to from WHO is calling, never from
    what they sent. Returns (source, submitted_by, submitted_by_sub).

    This is the control that keeps the two feeds apart. `source` used to be a
    client-supplied form field validated only against ('upload','server'), so
    any authenticated analyst -- or a fuzzer with a token -- could write into
    the mail-server feed, and `submitted_by` could name anyone. A membership
    check is not a trust boundary; the caller's verified identity is.

    - 'service'   -> the mail content filter (static JWT_SIGNING_KEY). Server
                     feed, no submitter: mail arrives on behalf of nobody.
    - 'user'      -> a Cognito dashboard analyst. Upload feed, attributed to
                     their claims. `username` is the readable label the
                     detections table renders; `sub` is the immutable id that
                     survives a username change, so both are stored.
    - 'anonymous' -> local dev only (neither Cognito nor the static key is
                     configured). Never reachable in a deployed environment,
                     but handled explicitly rather than falling through.
    """
    principal = auth.get('principal')

    if principal == 'service':
        return 'server', None, None

    if principal == 'user':
        claims = auth.get('claims') or {}
        sub = claims.get('sub')
        # Fall back to sub if the pool doesn't issue `username`: a row keyed by
        # an opaque id is still attributable, whereas NULL is indistinguishable
        # from the mail path and would defeat the split this function exists for.
        return 'upload', claims.get('username') or sub, sub

    return 'upload', 'local-dev', None


def require_cognito_user(auth: dict = Depends(require_auth)) -> dict:
    """Require a signed-in dashboard user (not the internal service key)."""
    if auth.get('principal') != 'user':
        raise HTTPException(
            status_code=403,
            detail='This action requires a signed-in dashboard user.',
        )
    return auth['claims']


# custom:role value -> Cognito group name.
_ROLE_TO_GROUP = {
    'soc-analyst': 'soc-analyst',
    'security-operator': 'security-operator',
    'security-analyst': 'security-analyst',
}


class EmailPredictRequest(BaseModel):
    text: str
    urgency_score: float = 0.0
    link_count: int = 0
    html_ratio: float = 0.0
    word_count: int = 0
    avg_word_length: float = 0.0


class UrlPredictRequest(BaseModel):
    url: str


class PredictResponse(BaseModel):
    verdict: str
    score: float
    likelihood: float  # 0-100, see _email_likelihood/_url_likelihood
    model: str
    reason: str
    # The per-feature values that drove the verdict, for the dashboard's
    # detailed-analysis view. Keys differ by track (email vs URL).
    features: dict


class UrlDetail(PredictResponse):
    url: str


class EmailMetadata(BaseModel):
    from_addr: str
    to_addr: str
    subject: str
    date: str
    num_urls: int
    attachment_count: int


class AnalyzeResponse(BaseModel):
    verdict: str
    likelihood: float  # worst-case signal across email + all URLs
    summary: str
    remediation: str
    email: PredictResponse
    urls: list[UrlDetail]
    metadata: EmailMetadata
    # Row id of the persisted detection, so the dashboard can deep-link to
    # /detections/{id} and offer review controls. None when persistence failed
    # open (no DB configured or Postgres unreachable) -- the analysis still
    # succeeded, but there is no stored record to point at, and the UI says so
    # rather than offering a link that 404s.
    detection_id: Optional[int] = None


class DetectionRecord(BaseModel):
    id: int
    created_at: str
    source: str
    submitted_by: Optional[str]
    verdict: str
    likelihood: float
    summary: str
    remediation: str
    from_addr: Optional[str]
    to_addr: Optional[str]
    subject: Optional[str]
    email_date: Optional[str]
    num_urls: int
    attachment_count: int
    email_score: Optional[float]
    email_model: Optional[str]
    email_reason: Optional[str]
    email_features: Optional[dict]
    urls: list


class DetectionSeriesPoint(BaseModel):
    bucket_start: str  # ISO, aligned to an absolute hour/day boundary
    count: int


class DetectionStats(BaseModel):
    """
    Overview-wall aggregates. Every figure except the two `newest_*` timestamps
    is scoped to the window, so the dashboard can label one denominator rather
    than mixing an all-time count with a windowed chart.
    """
    window_hours: int
    window_start: str  # rounded out to a bucket boundary, so sum(series) == total
    bucket_unit: str  # "hour" | "day"
    generated_at: str  # server clock — freshness is measured against this, not the browser's
    total: int
    by_verdict: dict[str, int]
    by_source: dict[str, int]
    series: list[DetectionSeriesPoint]
    newest_at: Optional[str]
    newest_server_at: Optional[str]  # unbounded by the window; drives the "quiet" rule
    reviewed: Optional[dict]  # null until review persistence exists


# The direction that makes each URL feature suspicious, so the dashboard can
# explain *why* without hard-coding copy on the frontend.
_URL_SUSPICIOUS = {
    'has_ip':        (lambda v: v == 1, 'Uses a raw IP address instead of a domain'),
    'is_shortened':  (lambda v: v == 1, 'Uses a URL shortener'),
    'has_https':     (lambda v: v == 0, 'No HTTPS'),
    'num_at':        (lambda v: v > 0,  'Contains an "@" symbol'),
    'num_subdomains': (lambda v: v >= 3, 'Unusually many subdomains'),
}


def _email_reason(verdict: str, feats: dict) -> str:
    if verdict == 'clean':
        return 'No strong phishing signals in the email content.'
    signals = []
    if feats.get('urgency_score', 0) > 0:
        signals.append('urgency language')
    if feats.get('link_count', 0) > 0:
        signals.append(f"{feats['link_count']} link(s)")
    if feats.get('html_ratio', 0) > 0.1:
        signals.append('high HTML density')
    detail = ', '.join(signals) if signals else 'suspicious content patterns'
    return f'Flagged on email content: {detail}.'


def _url_reason(verdict: str, feats: dict) -> str:
    if verdict == 'clean':
        return 'No strong phishing signals in the URL structure.'
    signals = [msg for key, (is_bad, msg) in _URL_SUSPICIOUS.items()
               if is_bad(feats.get(key, 0))]
    detail = '; '.join(signals) if signals else 'suspicious URL character patterns'
    return f'Flagged on URL structure: {detail}.'


def _remediation(verdict: str, bad_url_count: int) -> str:
    if verdict == 'clean':
        return 'No action needed — no phishing indicators detected.'
    if verdict == 'flag':
        parts = ['Review manually before acting on this message.']
        if bad_url_count:
            parts.append('Do not click the flagged link(s) until verified.')
        parts.append('Confirm sender identity through a separate channel if in doubt.')
        return ' '.join(parts)
    # quarantine
    parts = ['Do not click any links or open any attachments in this message.']
    if bad_url_count:
        parts.append(f'{bad_url_count} URL(s) were flagged as malicious.')
    parts.append('Report to IT/security and delete after review.')
    return ' '.join(parts)


def _score_email_text(text_clean: str, feats: dict) -> dict:
    result = predict_email(
        text_clean,
        urgency_score=feats['urgency_score'],
        link_count=feats['link_count'],
        html_ratio=feats['html_ratio'],
        word_count=feats['word_count'],
        avg_word_length=feats['avg_word_length'],
    )
    verdict = _verdict(result['label'], result['confidence'], EMAIL_QUARANTINE_SCORE)
    return {
        'verdict': verdict,
        'score': result['confidence'],
        'likelihood': _email_likelihood(result['confidence']),
        'model': result['model'],
        'reason': _email_reason(verdict, feats),
        'features': feats,
    }


def _score_url(url: str) -> dict:
    result = predict_url(url)
    verdict = _verdict(result['label'], result['confidence'], URL_QUARANTINE_SCORE)
    feats = result.get('features', {})
    return {
        'url': url,
        'verdict': verdict,
        'score': result['confidence'],
        'likelihood': _url_likelihood(result['confidence']),
        'model': result['model'],
        'reason': _url_reason(verdict, feats),
        'features': feats,
    }


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/predict/email', response_model=PredictResponse, dependencies=[Depends(require_auth)])
def predict_email_route(req: EmailPredictRequest):
    feats = {
        'urgency_score':   req.urgency_score,
        'link_count':      req.link_count,
        'html_ratio':      req.html_ratio,
        'word_count':      req.word_count,
        'avg_word_length': req.avg_word_length,
    }
    return _score_email_text(req.text, feats)


@app.post('/predict/url', response_model=PredictResponse, dependencies=[Depends(require_auth)])
def predict_url_route(req: UrlPredictRequest):
    detail = _score_url(req.url)
    detail.pop('url')
    return detail


@app.post('/analyze/email', response_model=AnalyzeResponse)
async def analyze_email_route(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    # `auth`, not `dependencies=[...]`: the dependency-list form validates the
    # token and then discards the claims, which is why source/submitted_by used
    # to come from the request body. Binding the principal here is what makes
    # provenance derivable -- see derive_provenance.
    auth: dict = Depends(require_auth),
):
    # source / submitted_by are deliberately NOT parameters. The mail filter
    # still sends a `source=server` part in its hand-rolled multipart body;
    # FastAPI ignores unknown parts, so the filter keeps working untouched and
    # this endpoint can ship without a coordinated EC2 redeploy.
    source, submitted_by, submitted_by_sub = derive_provenance(auth)

    if not text and not file:
        raise HTTPException(status_code=400, detail='Provide either "text" (pasted email) or "file" (.eml upload).')
    if text and file:
        raise HTTPException(status_code=400, detail='Provide only one of "text" or "file", not both.')

    if file:
        raw = await file.read()
        if len(raw) > MAX_EMAIL_BYTES:
            raise HTTPException(status_code=413, detail=f'.eml file exceeds {MAX_EMAIL_BYTES // 1024}KB limit.')
    else:
        if len(text.encode('utf-8')) > MAX_EMAIL_BYTES:
            raise HTTPException(status_code=413, detail=f'Email text exceeds {MAX_EMAIL_BYTES // 1024}KB limit.')
        raw = text

    try:
        email = MimeEmail(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f'Could not parse email: {e}')

    combined = email.combined_text
    feats = body_features(combined)
    email_detail = _score_email_text(normalize_text(combined), feats)

    urls = email.extract_urls()
    url_details = [_score_url(u) for u in urls]

    all_verdicts = [email_detail['verdict']] + [u['verdict'] for u in url_details]
    overall_verdict = max(all_verdicts, key=lambda v: _SEVERITY[v])
    overall_likelihood = max(
        [email_detail['likelihood']] + [u['likelihood'] for u in url_details],
        default=email_detail['likelihood'],
    )

    summary_parts = []
    if email_detail['verdict'] != 'clean':
        summary_parts.append(f"email content flagged ({email_detail['reason']})")
    bad_urls = [u for u in url_details if u['verdict'] != 'clean']
    if bad_urls:
        summary_parts.append(f"{len(bad_urls)}/{len(url_details)} URL(s) flagged")
    summary = ('Phishing indicators found: ' + '; '.join(summary_parts) + '.') if summary_parts \
        else 'No phishing indicators found in the email content or any extracted URLs.'
    remediation = _remediation(overall_verdict, len(bad_urls))

    metadata = {
        'from_addr': email.from_addr,
        'to_addr': email.to_addr,
        'subject': email.subject,
        'date': email.date,
        'num_urls': len(urls),
        'attachment_count': email.attachment_count,
    }

    # Best-effort persistence — db.insert_detection fails open (logs and
    # returns None) if Postgres isn't reachable, never breaks this response.
    # It already returns the inserted id; keeping it is what lets the dashboard
    # link the live result to its stored row.
    detection_id = db.insert_detection({
        'source': source,
        'submitted_by': submitted_by,
        'submitted_by_sub': submitted_by_sub,
        'verdict': overall_verdict,
        'likelihood': overall_likelihood,
        'summary': summary,
        'remediation': remediation,
        'from_addr': metadata['from_addr'],
        'to_addr': metadata['to_addr'],
        'subject': metadata['subject'],
        'email_date': metadata['date'],
        'num_urls': metadata['num_urls'],
        'attachment_count': metadata['attachment_count'],
        'email_score': email_detail['score'],
        'email_model': email_detail['model'],
        'email_reason': email_detail['reason'],
        'email_features': email_detail['features'],
        'urls': url_details,
    })

    return {
        'verdict': overall_verdict,
        'likelihood': overall_likelihood,
        'summary': summary,
        'remediation': remediation,
        'email': email_detail,
        'urls': url_details,
        'metadata': metadata,
        'detection_id': detection_id,
    }


@app.get('/detections', response_model=list[DetectionRecord], dependencies=[Depends(require_auth)])
def list_detections_route(
    source: Optional[str] = Query(None, description='Filter by "upload" or "server"'),
    verdict: Optional[str] = Query(None, description='Filter by "clean", "flag", or "quarantine"'),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if source is not None and source not in ('upload', 'server'):
        raise HTTPException(status_code=400, detail='source must be "upload" or "server".')
    if verdict is not None and verdict not in ('clean', 'flag', 'quarantine'):
        raise HTTPException(status_code=400, detail='verdict must be "clean", "flag", or "quarantine".')
    return db.list_detections(source=source, verdict=verdict, limit=limit, offset=offset)


# Declared before any future /detections/{id} route so "stats" is never
# captured as an id. Kept as a sibling of /detections rather than folded into
# it: that route is `response_model=list[DetectionRecord]`, so adding totals
# would mean an envelope, breaking every existing row consumer.
@app.get(
    '/detections/stats',
    response_model=Optional[DetectionStats],
    dependencies=[Depends(require_auth)],
)
def detections_stats_route(
    window_hours: int = Query(
        24, ge=1, le=168, description='Window in hours: 24 (1d), 72 (3d), or 168 (7d).'
    ),
):
    """
    Aggregates the Overview wall cannot derive from the row feed: the feed
    returns the most recent N rows, so any proportion taken from it swings with
    traffic instead of describing the period.

    Returns null (not zeros) when the database is unreachable, so the dashboard
    can tell "we looked and found none" from "we don't know" and avoid rendering
    an outage as a quiet night.
    """
    return db.detection_stats(window_hours=window_hours)


class ClaimRoleResponse(BaseModel):
    status: str  # "claimed" | "already_assigned"
    group: Optional[str] = None
    groups: list[str] = []


@app.post('/users/claim-role', response_model=ClaimRoleResponse)
def claim_role(claims: dict = Depends(require_cognito_user)):
    """
    M7-T14: assign the caller's Cognito group from their verified custom:role,
    once, if they don't already have one. Called by the frontend right after a
    fresh user's first sign-in (the pending-role screen).
    """
    pool, region, _ = get_config()
    if not pool:
        raise HTTPException(status_code=503, detail='Cognito is not configured.')

    username = claims.get('username') or claims.get('cognito:username')
    if not username:
        raise HTTPException(status_code=400, detail='Token is missing a username.')

    existing = claims.get('cognito:groups') or []
    if existing:
        return ClaimRoleResponse(status='already_assigned', groups=list(existing))

    idp = boto3.client('cognito-idp', region_name=region)
    try:
        user = idp.admin_get_user(UserPoolId=pool, Username=username)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f'Could not read user profile: {e}')

    attrs = {a['Name']: a['Value'] for a in user.get('UserAttributes', [])}
    group = _ROLE_TO_GROUP.get(attrs.get('custom:role') or '')
    if not group:
        raise HTTPException(
            status_code=400,
            detail='No valid role on your profile to claim.',
        )

    try:
        idp.admin_add_user_to_group(UserPoolId=pool, Username=username, GroupName=group)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f'Could not assign group: {e}')

    return ClaimRoleResponse(status='claimed', group=group)
