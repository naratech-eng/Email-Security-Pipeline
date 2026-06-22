"""
M6-T6: Per-track inference wrapper.

EmailPredictor  — wraps the M6-T2 LinearSVC email pipeline.
URLPredictor    — tries M6-T3 Char-CNN (primary), falls back to M6-T4 RF.

Both expose a .predict() method that returns:
    {"label": 0|1, "confidence": float, "model": str}

Convenience functions predict_email() and predict_url() use module-level
singletons so artifacts are loaded only once per process.

Artifact loading order (each model):
  1. Local path (artifact_dir, default "models/")
  2. Auto-download from S3 if not found locally
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

# M4 URL feature extractor (reuse existing logic, no duplication)
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'notebooks' / 'M4'))
from m4_t3_url_features import url_features  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
S3_BASE    = 's3://email-security-pipeline-datasets/models/artifacts'
S3_PROFILE = 'lab-user'  # change if needed, e.g. 'aws-lab', 'deploy-user'

EMAIL_NUM = ['urgency_score', 'link_count', 'html_ratio', 'word_count', 'avg_word_length']
URL_FEATS = ['url_length', 'hostname_length', 'num_dots', 'num_hyphens', 'num_at',
             'num_digits', 'num_special_chars', 'has_ip', 'has_https',
             'num_subdomains', 'is_shortened']

# ---------------------------------------------------------------------------
# S3 helper
# ---------------------------------------------------------------------------
def _s3_download(s3_path: str, local: Path) -> None:
    if local.exists():
        return
    local.parent.mkdir(parents=True, exist_ok=True)
    aws = shutil.which('aws') or '/usr/local/bin/aws'
    r = subprocess.run(
        [aws, 's3', 'cp', s3_path, str(local), '--profile', S3_PROFILE],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f'S3 download failed for {s3_path}:\n{r.stderr}')


# ---------------------------------------------------------------------------
# Email predictor
# ---------------------------------------------------------------------------
class EmailPredictor:
    """Wraps the M6-T2 LinearSVC + TF-IDF email pipeline."""

    _instance: Optional['EmailPredictor'] = None

    def __init__(self, path: Path):
        self._pipe = joblib.load(path)

    @classmethod
    def load(cls, artifact_dir: Path = Path('models')) -> 'EmailPredictor':
        if cls._instance is None:
            path = artifact_dir / 'email_linearsvc.joblib'
            if not path.exists():
                _s3_download(f'{S3_BASE}/email/email_linearsvc.joblib', path)
            cls._instance = cls(path)
        return cls._instance

    def predict(self, text_clean: str, urgency_score: float = 0.0,
                link_count: int = 0, html_ratio: float = 0.0,
                word_count: int = 0, avg_word_length: float = 0.0) -> dict:
        row = pd.DataFrame([{
            'text_clean':     text_clean,
            'urgency_score':  urgency_score,
            'link_count':     link_count,
            'html_ratio':     html_ratio,
            'word_count':     word_count,
            'avg_word_length': avg_word_length,
        }])
        label = int(self._pipe.predict(row)[0])
        score = float(self._pipe.decision_function(row)[0])
        return {'label': label, 'confidence': round(score, 4), 'model': 'email_linearsvc'}


# ---------------------------------------------------------------------------
# URL predictor
# ---------------------------------------------------------------------------
class URLPredictor:
    """
    Tries Char-CNN first (requires TensorFlow). Falls back to Random Forest
    automatically if TF is unavailable or the keras artifact is missing.
    Both paths accept a raw URL string — RF features are computed internally.
    """

    _instance: Optional['URLPredictor'] = None

    def __init__(self, model, char2idx: dict, maxlen: int, using_cnn: bool):
        self._model    = model
        self._char2idx = char2idx
        self._maxlen   = maxlen
        self._using_cnn = using_cnn

    @classmethod
    def load(cls, artifact_dir: Path = Path('models')) -> 'URLPredictor':
        if cls._instance is None:
            cls._instance = (
                cls._try_cnn(artifact_dir) or
                cls._try_rf(artifact_dir)
            )
            if cls._instance is None:
                raise RuntimeError('No URL model artifacts available.')
        return cls._instance

    @classmethod
    def _try_cnn(cls, artifact_dir: Path) -> Optional['URLPredictor']:
        try:
            import tensorflow as tf  # noqa: F401
            model_path = artifact_dir / 'url_charcnn.keras'
            vocab_path = artifact_dir / 'url_char_vocab.json'
            if not model_path.exists():
                _s3_download(f'{S3_BASE}/url/url_charcnn.keras', model_path)
            if not vocab_path.exists():
                _s3_download(f'{S3_BASE}/url/url_char_vocab.json', vocab_path)
            model = tf.keras.models.load_model(model_path)
            vocab = json.loads(vocab_path.read_text())
            print('[URLPredictor] loaded Char-CNN (primary)')
            return cls(model, vocab['char2idx'], vocab['MAXLEN'], using_cnn=True)
        except Exception:
            return None

    @classmethod
    def _try_rf(cls, artifact_dir: Path) -> Optional['URLPredictor']:
        try:
            path = artifact_dir / 'url_rf.joblib'
            if not path.exists():
                _s3_download(f'{S3_BASE}/url/url_rf.joblib', path)
            model = joblib.load(path)
            print('[URLPredictor] loaded Random Forest fallback (TF unavailable or CNN load failed)')
            return cls(model, {}, 0, using_cnn=False)
        except Exception:
            return None

    def _encode(self, url: str) -> np.ndarray:
        arr = np.zeros((1, self._maxlen), dtype=np.int32)
        for i, c in enumerate(url[:self._maxlen]):
            arr[0, i] = self._char2idx.get(c, 0)
        return arr

    def predict(self, url: str) -> dict:
        if self._using_cnn:
            proba = float(self._model.predict(self._encode(url), verbose=0)[0][0])
            label = int(proba >= 0.5)
            return {'label': label, 'confidence': round(proba, 4), 'model': 'url_charcnn'}
        else:
            feats = url_features(url)
            row   = pd.DataFrame([feats])[URL_FEATS]
            proba = float(self._model.predict_proba(row)[0][1])
            label = int(proba >= 0.5)
            return {'label': label, 'confidence': round(proba, 4), 'model': 'url_rf'}


# ---------------------------------------------------------------------------
# Convenience functions (module-level singletons)
# ---------------------------------------------------------------------------
def predict_email(text_clean: str, **meta) -> dict:
    """Score a single email. meta keys: urgency_score, link_count, html_ratio, word_count, avg_word_length."""
    return EmailPredictor.load().predict(text_clean, **meta)


def predict_url(url: str) -> dict:
    """Score a single URL. Uses Char-CNN if TF is available, else RF fallback."""
    return URLPredictor.load().predict(url)
