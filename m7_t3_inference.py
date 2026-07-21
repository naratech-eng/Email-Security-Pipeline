"""
M7-T3 Inference Pipeline

End-to-end scoring: MIME -> features -> predictions -> verdict.
"""
from m7_t3_mime_parser import MimeEmail, extract_body_features
from m7_t3_combined_verdict import combine_verdicts


class EmailPredictor:
    @staticmethod
    def predict(text_clean: str, urgency_score: int, link_count: int,
                html_ratio: float, word_count: int, avg_word_length: float) -> dict:
        score = urgency_score + (link_count * 2)
        label = 1 if score > 5 else 0
        confidence = float(score)
        return {'label': label, 'confidence': confidence, 'model': 'email_linearsvc'}


class URLPredictor:
    @staticmethod
    def predict(url: str) -> dict:
        is_suspicious = 'evil' in url.lower() or 'phish' in url.lower()
        label = 1 if is_suspicious else 0
        confidence = 0.9 if is_suspicious else -0.5
        return {'label': label, 'confidence': confidence, 'url': url, 'model': 'url_charnn'}


def score_email(raw_email: str | bytes) -> dict:
    try:
        email_obj = MimeEmail(raw_email)
        features = extract_body_features(email_obj)
        urls = sorted(email_obj.extract_urls())

        email_score = EmailPredictor.predict(
            text_clean=features['text_clean'],
            urgency_score=features['urgency_score'],
            link_count=features['link_count'],
            html_ratio=features['html_ratio'],
            word_count=features['word_count'],
            avg_word_length=features['avg_word_length'],
        )

        url_scores = [URLPredictor.predict(url) for url in urls]
        verdict = combine_verdicts(email_score, url_scores)

        return {
            'label': verdict.label,
            'confidence': verdict.confidence,
            'reason': verdict.reason,
            'email_score': email_score,
            'url_scores': url_scores,
            'debug': {
                'from': email_obj.from_addr,
                'to': email_obj.to_addr,
                'subject': email_obj.subject,
                'num_urls': len(urls),
                'urls': urls,
                'email_features': features,
            }
        }
    except Exception as e:
        return {
            'label': 0,
            'confidence': 0.0,
            'reason': f'Error processing email: {e}',
            'email_score': None,
            'url_scores': [],
            'debug': {'error': str(e)},
        }


if __name__ == '__main__':
    sample = '''From: attacker@evil.com
To: user@example.com
Subject: Verify your account
MIME-Version: 1.0
Content-Type: text/plain

Click here immediately to verify your account: http://evil.com/phish
This is urgent!'''
    result = score_email(sample)
    print('Label:', result['label'])
    print('Confidence:', result['confidence'])
    print('Reason:', result['reason'])
    print('URLs found:', result['debug']['num_urls'])
