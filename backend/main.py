"""
M7-T1: FastAPI inference service.

Wraps the M6 classifiers (inference.py) behind three routes so the operator
dashboard (M7-T12) and the mail server's content_filter (M7-T9) can both call
one HTTP API. Run locally with:

    uvicorn main:app --port 8000
"""
import os

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

from inference import predict_email, predict_url

app = FastAPI(title="Email Security Pipeline — Inference API")

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


def _verdict(label: int, score: float, quarantine_at: float) -> str:
    if label == 0:
        return 'clean'
    return 'quarantine' if score >= quarantine_at else 'flag'


# ---------------------------------------------------------------------------
# Auth placeholder — full Cognito JWT / signed-token verification is
# M7-T14/M9 scope. Until then: if JWT_SIGNING_KEY isn't set (local dev),
# /predict/* stays open. If it is set (e.g. once deployed via M7-T7), callers
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
    model: str


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/predict/email', response_model=PredictResponse, dependencies=[Depends(require_auth)])
def predict_email_route(req: EmailPredictRequest):
    result = predict_email(
        req.text,
        urgency_score=req.urgency_score,
        link_count=req.link_count,
        html_ratio=req.html_ratio,
        word_count=req.word_count,
        avg_word_length=req.avg_word_length,
    )
    verdict = _verdict(result['label'], result['confidence'], EMAIL_QUARANTINE_SCORE)
    return {'verdict': verdict, 'score': result['confidence'], 'model': result['model']}


@app.post('/predict/url', response_model=PredictResponse, dependencies=[Depends(require_auth)])
def predict_url_route(req: UrlPredictRequest):
    result = predict_url(req.url)
    verdict = _verdict(result['label'], result['confidence'], URL_QUARANTINE_SCORE)
    return {'verdict': verdict, 'score': result['confidence'], 'model': result['model']}
