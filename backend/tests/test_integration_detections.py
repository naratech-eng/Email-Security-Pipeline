"""
Integration tests for the detections store (M7-T15) — real Postgres, not
mocks. Skipped if DB_CREDENTIALS_JSON isn't set (e.g. local dev without a
database) so the rest of the suite still runs; CI provides a real Postgres
service container so these run for real there.
"""
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

import db
from main import app

pytestmark = pytest.mark.skipif(
    not os.environ.get('DB_CREDENTIALS_JSON'),
    reason='DB_CREDENTIALS_JSON not set — no database available for these tests',
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_table():
    import json
    creds = json.loads(os.environ['DB_CREDENTIALS_JSON'])
    url = f"host={creds['host']} port={creds['port']} dbname={creds['dbname']} user={creds['username']} password={creds['password']}"
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM detections")
        conn.commit()
    yield


PHISHING_EMAIL = """From: attacker@evil.tk
To: victim@example.com
Subject: URGENT: verify your account now
Date: Mon, 1 Jan 2026 12:00:00 -0000

Click here immediately: http://bit.ly/x to verify your account or it will be suspended.
"""

BENIGN_EMAIL = """From: boss@company.com
To: employee@company.com
Subject: Meeting tomorrow

Hi, can we reschedule to 2pm?
"""


def test_db_insert_and_list_round_trip():
    row = {
        'source': 'server', 'submitted_by': None, 'verdict': 'quarantine',
        'likelihood': 99.9, 'summary': 's', 'remediation': 'r',
        'from_addr': 'a@b.com', 'to_addr': 'c@d.com', 'subject': 'subj', 'email_date': 'date',
        'num_urls': 1, 'attachment_count': 0, 'email_score': 2.1, 'email_model': 'email_linearsvc',
        'email_reason': 'reason', 'email_features': {'urgency_score': 5}, 'urls': [{'url': 'x'}],
    }
    new_id = db.insert_detection(row)
    assert new_id is not None

    results = db.list_detections()
    assert len(results) == 1
    assert results[0]['id'] == new_id
    assert results[0]['email_features'] == {'urgency_score': 5}
    assert results[0]['urls'] == [{'url': 'x'}]


def test_analyze_email_persists_with_derived_provenance():
    """
    source/submitted_by come from the authenticated principal, never the body.
    Under the test client neither Cognito nor JWT_SIGNING_KEY is configured, so
    require_auth yields the 'anonymous' principal -> the local-dev upload row.
    """
    r = client.post('/analyze/email', data={'text': PHISHING_EMAIL})
    assert r.status_code == 200
    assert 'remediation' in r.json()

    rows = db.list_detections(source='upload')
    assert len(rows) == 1
    assert rows[0]['submitted_by'] == 'local-dev'
    assert rows[0]['verdict'] in ('flag', 'quarantine')
    assert rows[0]['remediation']


def test_analyze_email_ignores_client_supplied_provenance():
    """
    Regression guard for the spoofing vector this replaced: `source` and
    `submitted_by` used to be Form fields, so any caller could write into the
    mail-server feed or attribute a detection to someone else. Both are now
    ignored -- sending them must not change where the row lands or who it names.
    """
    r = client.post(
        '/analyze/email',
        data={'text': BENIGN_EMAIL, 'source': 'server', 'submitted_by': 'someone-else'},
    )
    assert r.status_code == 200

    # Claimed 'server', but the principal is anonymous -> still an upload row.
    assert db.list_detections(source='server') == []
    rows = db.list_detections(source='upload')
    assert len(rows) == 1
    assert rows[0]['submitted_by'] == 'local-dev'


def test_analyze_response_exposes_detection_id():
    """The dashboard deep-links the live result to its stored row."""
    r = client.post('/analyze/email', data={'text': BENIGN_EMAIL})
    assert r.status_code == 200
    detection_id = r.json()['detection_id']
    assert detection_id is not None
    assert db.list_detections()[0]['id'] == detection_id


def test_detections_endpoint_filters_by_verdict():
    client.post('/analyze/email', data={'text': PHISHING_EMAIL, 'source': 'upload'})
    client.post('/analyze/email', data={'text': BENIGN_EMAIL, 'source': 'upload'})

    r = client.get('/detections', params={'verdict': 'clean'})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]['verdict'] == 'clean'


def test_detections_endpoint_rejects_bad_filters():
    assert client.get('/detections', params={'source': 'bogus'}).status_code == 400
    assert client.get('/detections', params={'verdict': 'bogus'}).status_code == 400
