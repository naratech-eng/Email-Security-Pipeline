"""
RFC822/MIME email parsing + the exact text_clean/body-feature extraction the
M6-T2 email_linearsvc model was trained on.

normalize_text() and body_features() are ported verbatim from
notebooks/M4/m4_t6_pipeline.ipynb (the script that produced the training
data's text_clean/urgency_score/link_count/html_ratio/word_count/
avg_word_length columns) — not reinvented, so a raw email scored here lands
in the same feature distribution the model was fit on.
"""
import re
from email import policy
from email.parser import BytesParser

MAX_URLS_ANALYZED = 25

URGENCY_STEMS = [
    r'urgent', r'immediat', r'verif', r'suspend', r'limit', r'restrict',
    r'action required', r'click here', r'confirm', r'account', r'password',
    r'updat', r'expir', r'unusual activ', r'security alert',
    r'hurry', r'act now', r'last chance', r'time.?sensitive',
]
URGENCY_RE = re.compile(r'\b(?:' + '|'.join(URGENCY_STEMS) + r')', re.IGNORECASE)

URL_RE = re.compile(r'https?://[^\s\)\]<>"\']+', re.IGNORECASE)


def urgency_score(text: str) -> int:
    return len(URGENCY_RE.findall(str(text)))


def normalize_text(text: str) -> str:
    """Produces text_clean — the TF-IDF input. Matches m4_t6_pipeline.ipynb."""
    t = str(text).lower()
    t = re.sub(r'<[^>]+>', ' ', t)           # strip HTML tags
    t = re.sub(r'http\S+|www\.\S+', ' ', t)  # strip URLs
    t = re.sub(r'\S+@\S+', ' ', t)           # strip emails
    return re.sub(r'\s+', ' ', t).strip()


def body_features(text: str) -> dict:
    """
    The 5 numeric features the email pipeline uses alongside TF-IDF.
    Computed on the RAW (unnormalized) text — html_ratio and link_count need
    the original tags/URLs still present, matching m4_t6_pipeline.ipynb.
    """
    raw = str(text)
    words = raw.split()
    tags = len(re.findall(r'<[^>]+>', raw))
    return {
        'urgency_score':   urgency_score(raw),
        'link_count':      len(re.findall(r'https?://[^\s]+', raw)),
        'html_ratio':      round(tags / len(raw), 4) if raw else 0.0,
        'word_count':      len(words),
        'avg_word_length': round(sum(len(w) for w in words) / len(words), 2) if words else 0.0,
    }


class MimeEmail:
    """Wraps an RFC822 email with header/body/URL extraction."""

    def __init__(self, raw_email: str | bytes):
        if isinstance(raw_email, str):
            raw_email = raw_email.encode('utf-8', errors='replace')
        self.msg = BytesParser(policy=policy.default).parsebytes(raw_email)

    @property
    def from_addr(self) -> str:
        return (self.msg.get('From', '') or '').strip()

    @property
    def to_addr(self) -> str:
        return (self.msg.get('To', '') or '').strip()

    @property
    def subject(self) -> str:
        return (self.msg.get('Subject', '') or '').strip()

    @property
    def date(self) -> str:
        return (self.msg.get('Date', '') or '').strip()

    @property
    def attachment_count(self) -> int:
        if not self.msg.is_multipart():
            return 0
        return sum(
            1 for part in self.msg.iter_parts()
            if part.get_content_disposition() == 'attachment'
        )

    @property
    def body_text(self) -> str:
        if self.msg.is_multipart():
            for part in self.msg.iter_parts():
                if part.get_content_type() == 'text/plain' and part.get_content_disposition() != 'attachment':
                    payload = part.get_payload(decode=True)
                    if payload is not None:
                        return self._decode(payload)
            for part in self.msg.iter_parts():
                if part.get_content_type() == 'text/html' and part.get_content_disposition() != 'attachment':
                    payload = part.get_payload(decode=True)
                    if payload is not None:
                        return self._decode(payload)
            return ''

        payload = self.msg.get_payload(decode=True)
        if payload is None:
            payload = self.msg.get_payload()
            return payload if isinstance(payload, str) else ''
        return self._decode(payload)

    @staticmethod
    def _decode(payload: bytes) -> str:
        try:
            return payload.decode('utf-8', errors='replace')
        except Exception:
            return payload.decode('latin-1', errors='replace')

    @property
    def combined_text(self) -> str:
        """Best-effort reconstruction of the training data's text_combined:
        subject + body, matching the shape body_features/normalize_text
        expect (whole-message text, tags/URLs still present)."""
        return f'{self.subject}\n{self.body_text}'

    def extract_urls(self) -> list[str]:
        urls = set(URL_RE.findall(self.body_text))
        for header in ('Reply-To', 'List-Unsubscribe'):
            value = self.msg.get(header, '')
            if value:
                urls.update(URL_RE.findall(value))
        cleaned = {u.rstrip('.,;:!?)') for u in urls if u}
        return sorted(cleaned)[:MAX_URLS_ANALYZED]
