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
import math
import os
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from inference import predict_email, predict_url
from mime_parser import MimeEmail, body_features, normalize_text

app = FastAPI(title="Email Security Pipeline — Inference API")

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
def require_auth(request: Request) -> None:
    signing_key = os.environ.get('JWT_SIGNING_KEY')
    if not signing_key:
        return
    auth = request.headers.get('authorization', '')
    if auth != f'Bearer {signing_key}':
        raise HTTPException(status_code=401, detail='Unauthorized')


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
    email: PredictResponse
    urls: list[UrlDetail]
    metadata: EmailMetadata


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


@app.post('/analyze/email', response_model=AnalyzeResponse, dependencies=[Depends(require_auth)])
async def analyze_email_route(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
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

    return {
        'verdict': overall_verdict,
        'likelihood': overall_likelihood,
        'summary': summary,
        'email': email_detail,
        'urls': url_details,
        'metadata': {
            'from_addr': email.from_addr,
            'to_addr': email.to_addr,
            'subject': email.subject,
            'date': email.date,
            'num_urls': len(urls),
            'attachment_count': email.attachment_count,
        },
    }
