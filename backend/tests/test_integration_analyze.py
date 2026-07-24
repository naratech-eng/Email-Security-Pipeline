"""
Integration tests for /analyze/email — paste + .eml upload, using constructed
messages built around real held-out phishing/benign signals plus a synthetic
multi-URL case to exercise the combined-verdict and URL-extraction paths
end to end with the real M6 models.
"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

PHISHING_EML = """From: security@paypa1-verify.tk
To: victim@example.com
Subject: URGENT: Your account has been suspended - action required
Date: Mon, 1 Jan 2026 12:00:00 -0000
Content-Type: text/plain

Dear Customer,

We detected unusual activity on your account. Your account has been
suspended and requires immediate verification to avoid permanent closure.

Please click here immediately to confirm your identity:
http://192.168.44.12@paypa1-secure.tk/login?verify=1

You can also use this shortened link: http://bit.ly/3xKq9zP

This is your last chance. Act now or lose access permanently.

Regards,
Security Team
"""

BENIGN_EML = """From: boss@company.com
To: employee@company.com
Subject: Meeting tomorrow
Date: Mon, 1 Jan 2026 09:00:00 -0000
Content-Type: text/plain

Hi,

Can we reschedule tomorrow's 10am meeting to 2pm instead? I have a
conflict come up.

Thanks,
Boss
"""


def test_requires_text_or_file():
    r = client.post("/analyze/email")
    assert r.status_code == 400


def test_rejects_both_text_and_file():
    r = client.post(
        "/analyze/email",
        data={"text": "x"},
        files={"file": ("a.eml", b"From: a@b.com\n\nhi")},
    )
    assert r.status_code == 400


def test_analyze_phishing_email_paste():
    r = client.post("/analyze/email", data={"text": PHISHING_EML})
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] in ("flag", "quarantine")
    assert data["likelihood"] > 50
    assert data["metadata"]["num_urls"] == 2
    assert data["metadata"]["subject"].startswith("URGENT")
    assert len(data["urls"]) == 2
    # both planted URLs should be flagged (raw IP+@ and a known shortener)
    assert all(u["verdict"] != "clean" for u in data["urls"])
    assert data["email"]["features"]["urgency_score"] > 0


def test_analyze_phishing_email_upload():
    r = client.post(
        "/analyze/email",
        files={"file": ("phish.eml", PHISHING_EML.encode(), "message/rfc822")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] in ("flag", "quarantine")
    assert data["metadata"]["num_urls"] == 2


def test_analyze_benign_email():
    r = client.post("/analyze/email", data={"text": BENIGN_EML})
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "clean"
    assert data["metadata"]["num_urls"] == 0


def test_analyze_rejects_oversized_text(monkeypatch):
    import main
    monkeypatch.setattr(main, "MAX_EMAIL_BYTES", 100)
    r = client.post("/analyze/email", data={"text": PHISHING_EML})
    assert r.status_code == 413


def test_analyze_requires_auth_when_configured(monkeypatch):
    monkeypatch.setenv("JWT_SIGNING_KEY", "test-secret")
    r = client.post("/analyze/email", data={"text": BENIGN_EML})
    assert r.status_code == 401

    r = client.post(
        "/analyze/email",
        data={"text": BENIGN_EML},
        headers={"Authorization": "Bearer test-secret"},
    )
    assert r.status_code == 200
