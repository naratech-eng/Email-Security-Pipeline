"""
M7-T3 MIME Email Parser

Parses raw RFC822 emails and extracts headers, body, and URLs.
"""
import re
from email import policy
from email.parser import BytesParser


class MimeEmail:
    """Wraps an RFC822 email with header/body/URL extraction."""

    def __init__(self, raw_email: str | bytes):
        if isinstance(raw_email, str):
            raw_email = raw_email.encode('utf-8', errors='replace')

        parser = BytesParser(policy=policy.default)
        self.msg = parser.parsebytes(raw_email)

    @property
    def from_addr(self) -> str:
        return self.msg.get('From', '').strip() or ''

    @property
    def to_addr(self) -> str:
        return self.msg.get('To', '').strip() or ''

    @property
    def subject(self) -> str:
        return self.msg.get('Subject', '').strip() or ''

    @property
    def body_text(self) -> str:
        if self.msg.is_multipart():
            for part in self.msg.iter_parts():
                if part.get_content_type() == 'text/plain':
                    payload = part.get_payload(decode=True)
                    if payload is None:
                        continue
                    return self._decode_payload(payload)
            for part in self.msg.iter_parts():
                if part.get_content_type() == 'text/html':
                    payload = part.get_payload(decode=True)
                    if payload is None:
                        continue
                    return self._decode_payload(payload)
            return ''

        payload = self.msg.get_payload(decode=True)
        if payload is None:
            payload = self.msg.get_payload()
            if isinstance(payload, str):
                return payload
            return ''

        return self._decode_payload(payload)

    def _decode_payload(self, payload: bytes) -> str:
        try:
            return payload.decode('utf-8', errors='replace')
        except Exception:
            return payload.decode('latin-1', errors='replace')

    @property
    def headers_dict(self) -> dict:
        return dict(self.msg.items())

    def extract_urls(self) -> set[str]:
        urls = set()
        url_pattern = r'https?://[^\s\)\]<>"\']+|ftp://[^\s\)\]<>"\']+'

        body = self.body_text
        urls.update(re.findall(url_pattern, body, re.IGNORECASE))

        for header in ['Unsubscribe', 'List-Unsubscribe', 'Reply-To', 'X-Originating-IP']:
            value = self.msg.get(header, '')
            if value:
                urls.update(re.findall(url_pattern, value, re.IGNORECASE))

        cleaned = set()
        for url in urls:
            url = url.rstrip('.,;:!?)')
            if url:
                cleaned.add(url)

        return cleaned


def extract_body_features(email_obj: MimeEmail) -> dict:
    body = email_obj.body_text or ''
    text_clean = body.lower().strip()
    text_clean = re.sub(r'\s+', ' ', text_clean)

    words = re.findall(r"\w+", text_clean)
    word_count = len(words)
    avg_word_length = sum(len(w) for w in words) / max(word_count, 1)

    link_count = len(email_obj.extract_urls())
    html_tag_count = len(re.findall(r'<[^>]+>', body))
    html_ratio = html_tag_count / max(len(body), 1)

    urgency_keywords = {
        'verif': 10,
        'confirm': 8,
        'urgent': 10,
        'action required': 10,
        'immediately': 9,
        'expire': 9,
        'click here': 7,
        'update': 6,
        'suspended': 10,
        'unusual': 7,
    }

    urgency_score = 0
    for keyword, score in urgency_keywords.items():
        if keyword in text_clean:
            urgency_score = max(urgency_score, score)

    return {
        'text_clean': text_clean,
        'urgency_score': urgency_score,
        'link_count': link_count,
        'html_ratio': float(html_ratio),
        'word_count': word_count,
        'avg_word_length': float(avg_word_length),
    }


if __name__ == '__main__':
    sample = '''From: attacker@evil.com
To: user@example.com
Subject: Verify your account
MIME-Version: 1.0
Content-Type: text/plain

Click here immediately to verify: http://evil.com/phish'''
    email = MimeEmail(sample)
    print('From:', email.from_addr)
    print('Subject:', email.subject)
    print('URLs:', email.extract_urls())
    print('Features:', extract_body_features(email))
