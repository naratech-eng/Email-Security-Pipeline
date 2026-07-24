"""Unit tests for remediation text generation — no DB, no model loading."""
from main import _remediation


def test_clean_needs_no_action():
    assert _remediation('clean', bad_url_count=0) == 'No action needed — no phishing indicators detected.'


def test_flag_recommends_manual_review():
    text = _remediation('flag', bad_url_count=0)
    assert 'Review manually' in text
    assert 'flagged link' not in text  # no bad URLs, shouldn't mention links


def test_flag_mentions_bad_urls_when_present():
    text = _remediation('flag', bad_url_count=2)
    assert 'flagged link' in text


def test_quarantine_warns_against_links_and_attachments():
    text = _remediation('quarantine', bad_url_count=0)
    assert 'Do not click any links or open any attachments' in text
    assert 'Report to IT/security' in text


def test_quarantine_counts_malicious_urls():
    text = _remediation('quarantine', bad_url_count=3)
    assert '3 URL(s) were flagged as malicious' in text
