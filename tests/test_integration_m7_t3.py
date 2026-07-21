"""Integration tests for M7-T3 via the FastAPI wrapper."""
from fastapi.testclient import TestClient

from m7_t1_fastapi_service import app


client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_predict_mime():
    sample = (
        "From: attacker@evil.com\n"
        "To: user@example.com\n"
        "Subject: URGENT: Verify Account\n\n"
        "URGENT ACTION REQUIRED!\nClick here: http://evil.com/phish"
    )
    r = client.post("/predict/mime", json={"email": sample})
    assert r.status_code == 200
    data = r.json()
    assert 'label' in data
    assert 'confidence' in data
    assert 'reason' in data
