"""
M5 shared evaluation harness — importable module.

Used by m5_t3_url_models.ipynb (and any other M5 experiment notebook) instead of
%run m5_harness.ipynb, which re-executes the demo training cells on every load.
"""
import os
import csv
import time
import warnings
from pathlib import Path

os.environ.setdefault('PYTHONWARNINGS', 'ignore')
warnings.filterwarnings('ignore')

import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score)

# --- Paths (this file lives at notebooks/M5/m5_harness.py) ---
ROOT    = Path(__file__).resolve().parents[2]
PROC    = ROOT / 'data' / 'processed'
RESULTS = ROOT / 'results' / 'm5_results.csv'

# --- Protocol constants ---
RANDOM_STATE = 42
CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

EMAIL_TEXT = 'text_clean'
EMAIL_NUM  = ['urgency_score', 'link_count', 'html_ratio', 'word_count', 'avg_word_length']
URL_FEATS  = ['url_length', 'hostname_length', 'num_dots', 'num_hyphens', 'num_at',
              'num_digits', 'num_special_chars', 'has_ip', 'has_https',
              'num_subdomains', 'is_shortened']


# --- Split loaders ---
def load_email():
    tr = pd.read_csv(PROC / 'email_train.csv')
    te = pd.read_csv(PROC / 'email_test.csv')
    for d in (tr, te):
        d[EMAIL_TEXT] = d[EMAIL_TEXT].fillna('')
    return tr, te


def load_url():
    return (pd.read_csv(PROC / 'url_train.csv'),
            pd.read_csv(PROC / 'url_test.csv'))


# --- Metric helpers ---
def _proba(pipe, X):
    if hasattr(pipe, 'predict_proba'):
        return pipe.predict_proba(X)[:, 1]
    if hasattr(pipe, 'decision_function'):
        return pipe.decision_function(X)
    return None


def scores(y_true, y_pred, y_score=None):
    return {
        'accuracy':  accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred, zero_division=0),
        'recall':    recall_score(y_true, y_pred, zero_division=0),
        'f1':        f1_score(y_true, y_pred, zero_division=0),
        'roc_auc':   roc_auc_score(y_true, y_score) if y_score is not None else float('nan'),
    }


# --- Pipeline factories ---
def email_pipeline(clf, tfidf_only=False):
    parts = [('text', TfidfVectorizer(max_features=20000, ngram_range=(1, 2)), EMAIL_TEXT)]
    if not tfidf_only:
        parts.append(('num', StandardScaler(with_mean=False), EMAIL_NUM))
    return Pipeline([('pre', ColumnTransformer(parts)), ('clf', clf)])


def url_pipeline(clf, scale=True):
    steps = [('scale', StandardScaler())] if scale else []
    steps.append(('clf', clf))
    return Pipeline(steps)


# --- Experiment runner ---
def _log(row):
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    cols = ['track', 'model', 'accuracy', 'precision', 'recall',
            'f1', 'roc_auc', 'cv_f1', 'train_time']
    exists = RESULTS.exists()
    with open(RESULTS, 'a', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        if not exists:
            w.writeheader()
        w.writerow({k: row.get(k, '') for k in cols})


def run_experiment(name, track, pipe, Xtr, ytr, Xte, yte, log=True):
    t0 = time.time()
    cv_f1 = cross_val_score(pipe, Xtr, ytr, cv=CV, scoring='f1', n_jobs=-1).mean()
    pipe.fit(Xtr, ytr)
    train_time = time.time() - t0
    y_pred = pipe.predict(Xte)
    m = scores(yte, y_pred, _proba(pipe, Xte))
    row = {'track': track, 'model': name,
           **{k: round(v, 4) for k, v in m.items()},
           'cv_f1': round(cv_f1, 4), 'train_time': round(train_time, 2)}
    print(f"[{track}] {name}: F1={m['f1']:.4f}  ROC-AUC={m['roc_auc']:.4f}"
          f"  (cv_f1={cv_f1:.4f}, {train_time:.1f}s)")
    if log:
        _log(row)
    return row
