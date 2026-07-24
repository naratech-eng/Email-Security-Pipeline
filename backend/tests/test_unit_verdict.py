"""Unit tests for verdict thresholding — no model loading, no I/O."""
from main import _verdict


def test_clean_when_label_zero_regardless_of_score():
    assert _verdict(label=0, score=999.0, quarantine_at=0.85) == 'clean'


def test_flag_when_label_one_below_quarantine_cutoff():
    assert _verdict(label=1, score=0.5, quarantine_at=0.85) == 'flag'


def test_quarantine_when_label_one_at_or_above_cutoff():
    assert _verdict(label=1, score=0.85, quarantine_at=0.85) == 'quarantine'
    assert _verdict(label=1, score=0.99, quarantine_at=0.85) == 'quarantine'


def test_email_scale_unbounded_score_above_cutoff():
    assert _verdict(label=1, score=2.44, quarantine_at=1.0) == 'quarantine'
    assert _verdict(label=1, score=0.1, quarantine_at=1.0) == 'flag'
