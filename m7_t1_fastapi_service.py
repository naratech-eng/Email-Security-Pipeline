"""
Minimal FastAPI wrapper for M7-T3 integration (M7-T1 endpoint)

Exposes:
- GET /health
- POST /predict/mime  {"email": "<raw rfc822>"}

This file is intentionally lightweight so it can be used in integration tests
via FastAPI's TestClient without starting a server.
"""
from fastapi import FastAPI
from pydantic import BaseModel

from m7_t3_inference import score_email


class MimeRequest(BaseModel):
    email: str


app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/mime")
def predict_mime(req: MimeRequest):
    if not req.email:
        return {
            'label': 0,
            'confidence': 0.0,
            'reason': 'empty email',
            'email_score': None,
            'url_scores': [],
            'debug': {},
        }

    result = score_email(req.email)
    return result
