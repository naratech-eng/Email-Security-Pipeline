"""
M7-T1 acceptance tests.

Samples below are pulled directly from the frozen M4-T7 held-out test
splits (data/processed/email_test.csv, url_test.csv), not training data,
per the M7-T1 acceptance criteria.
"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

BENIGN_EMAIL = {
    "text": (
        "quichua info hi quito march 23 april 2 would like information "
        "quichua particularly interested native language instruction "
        "movements quichuan spanish anybody contacts krbruna"
    ),
    "urgency_score": 0,
    "link_count": 0,
    "html_ratio": 0.0,
    "word_count": 23,
    "avg_word_length": 6.57,
}

PHISHING_EMAIL = {
    "text": (
        "cialis xanax valium viagra low price prescription needed discount "
        "rx simple quick affordable br offering many today widely usedbr "
        "prescription drugs market brbr viagra ambien meridia propecia "
        "valium xanax many br click special savings"
    ),
    "urgency_score": 0,
    "link_count": 0,
    "html_ratio": 0.0,
    "word_count": 34,
    "avg_word_length": 5.91,
}

BENIGN_URL = "http://sourceforge.net/directory/business-enterprise/add_facet_filter?facet=language&constraint=PL%2FSQL"
MALICIOUS_URL = "https://mitsui-jyuku.mixh.jp/uploads/891q2w3ez1x2c3.exe"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_predict_email_benign():
    r = client.post("/predict/email", json=BENIGN_EMAIL)
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "clean"
    assert data["model"] == "email_linearsvc"


def test_predict_email_phishing():
    r = client.post("/predict/email", json=PHISHING_EMAIL)
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] in ("flag", "quarantine")
    assert data["model"] == "email_linearsvc"


def test_predict_url_benign():
    r = client.post("/predict/url", json={"url": BENIGN_URL})
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "clean"


def test_predict_url_malicious():
    r = client.post("/predict/url", json={"url": MALICIOUS_URL})
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] in ("flag", "quarantine")


def test_predict_email_requires_auth_when_configured(monkeypatch):
    monkeypatch.setenv("JWT_SIGNING_KEY", "test-secret")
    r = client.post("/predict/email", json=BENIGN_EMAIL)
    assert r.status_code == 401

    r = client.post(
        "/predict/email",
        json=BENIGN_EMAIL,
        headers={"Authorization": "Bearer test-secret"},
    )
    assert r.status_code == 200
