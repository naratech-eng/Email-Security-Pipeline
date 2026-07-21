"""
M7-T3 Combined Phishing Verdict

Combines email + URL predictor outputs into a single verdict.
"""
from dataclasses import dataclass


@dataclass
class Verdict:
    label: int
    confidence: float
    reason: str
    email_signal: bool
    url_signals: list[bool]
    num_urls: int
    email_score: float
    url_scores: list[float]


def combine_verdicts(email_pred: dict, url_preds: list[dict]) -> Verdict:
    email_label = email_pred.get('label', 0)
    email_score = float(email_pred.get('confidence', 0.0))
    url_labels = [int(p.get('label', 0)) for p in url_preds]
    url_scores = [float(p.get('confidence', 0.0)) for p in url_preds]

    num_urls = len(url_preds)
    num_malicious_urls = sum(url_labels)

    email_weight = 0.6
    url_weight = 0.4

    import math
    email_score_norm = 1.0 / (1.0 + math.exp(-email_score))
    url_score_max = max(url_scores) if url_scores else 0.0
    url_score_norm = 1.0 / (1.0 + math.exp(-url_score_max))

    combined_score = email_weight * email_score_norm + url_weight * url_score_norm
    reasons = []

    if email_label == 1:
        reasons.append(f'suspicious email content (score: {email_score:.2f})')
    if num_malicious_urls > 0:
        reasons.append(f'{num_malicious_urls}/{num_urls} malicious URLs detected')

    if reasons:
        reason = 'Phishing detected: ' + ', '.join(reasons)
        final_label = 1
    else:
        reason = 'Benign email'
        final_label = 0

    return Verdict(
        label=final_label,
        confidence=round(float(combined_score), 4),
        reason=reason,
        email_signal=bool(email_label),
        url_signals=[bool(l) for l in url_labels],
        num_urls=num_urls,
        email_score=email_score,
        url_scores=url_scores,
    )


if __name__ == '__main__':
    email_pred = {'label': 1, 'confidence': 2.47, 'model': 'email_linearsvc'}
    url_preds = [
        {'label': 1, 'confidence': 0.89, 'url': 'http://evil.com/phish'},
        {'label': 1, 'confidence': 0.75, 'url': 'http://evil.com/bank'},
    ]
    verdict = combine_verdicts(email_pred, url_preds)
    print('Label:', verdict.label)
    print('Confidence:', verdict.confidence)
    print('Reason:', verdict.reason)
    print('Email Signal:', verdict.email_signal)
    print('URL Signals:', verdict.url_signals)
