"""Test M7-T3 MIME parsing and combined verdict."""

import pytest
from m7_t3_inference import score_email
from m7_t3_mime_parser import MimeEmail, extract_body_features


class TestMimeParser:
    def test_parse_simple_email(self):
        email_text = '''From: sender@example.com
To: recipient@example.com
Subject: Test

Hello'''
        email = MimeEmail(email_text)
        assert email.from_addr == 'sender@example.com'
        assert email.subject == 'Test'
        assert 'Hello' in email.body_text

    def test_extract_urls(self):
        email_text = '''From: sender@example.com
Subject: Links

Check http://example.com and https://secure.com'''
        email = MimeEmail(email_text)
        urls = email.extract_urls()
        assert 'http://example.com' in urls
        assert 'https://secure.com' in urls


class TestFeatureExtraction:
    def test_urgency_detection(self):
        email_text = '''From: sender@example.com
Subject: Verify

Verify your account immediately: http://example.com'''
        email = MimeEmail(email_text)
        features = extract_body_features(email)
        assert features['urgency_score'] > 0
        assert features['link_count'] == 1


class TestEndToEnd:
    def test_score_phishing_email(self):
        phishing_email = '''From: attacker@evil.com
To: user@example.com
Subject: URGENT: Verify Account

URGENT ACTION REQUIRED!
Click here: http://evil.com/phish'''
        result = score_email(phishing_email)
        assert 'label' in result
        assert 'confidence' in result
        assert 'reason' in result
        assert result['label'] == 1

    def test_score_benign_email(self):
        benign_email = '''From: boss@company.com
To: employee@company.com
Subject: Meeting tomorrow

Hi, can we reschedule tomorrow's meeting?'''
        result = score_email(benign_email)
        assert 'label' in result
        assert result['label'] in [0, 1]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
