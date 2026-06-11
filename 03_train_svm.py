"""
STEP 2: Train SVM Classifier for Email Classification
(Mirrors M5-T1 harness structure for reproducibility)

This script:
1. Loads the email dataset (train/test split)
2. Defines the feature engineering pipeline (TF-IDF + scaling)
3. Trains LinearSVC with cross-validation
4. Evaluates on test set
5. Logs results to results/m5_results.csv
"""

import os
os.environ.setdefault('PYTHONWARNINGS', 'ignore')

import warnings
warnings.filterwarnings('ignore')

import time
import csv
from pathlib import Path

import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)

# ============================================================================
# CONFIGURATION (locked protocol - same for all M5 experiments)
# ============================================================================

ROOT = Path.cwd()
DATA_DIR = ROOT / 'data' / 'processed'
RESULTS_DIR = ROOT / 'results'
RESULTS_CSV = RESULTS_DIR / 'm5_results.csv'

RANDOM_STATE = 42
CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

# Email feature config
EMAIL_TEXT = 'text_clean'
EMAIL_NUM = ['urgency_score', 'word_count', 'avg_word_length']

print(f"Data directory: {DATA_DIR}")
print(f"Results log: {RESULTS_CSV}")

# ============================================================================
# STEP 1: Load Data
# ============================================================================

def load_email():
    """Load email train/test splits. Repair NaN text_clean to ''."""
    train_path = DATA_DIR / 'email_train.csv'
    test_path = DATA_DIR / 'email_test.csv'
    
    if not train_path.exists() or not test_path.exists():
        print(f"Error: Data not found. Run 02_generate_data.py first.")
        raise FileNotFoundError(f"Missing {train_path} or {test_path}")
    
    train = pd.read_csv(train_path)
    test = pd.read_csv(test_path)
    
    for df in [train, test]:
        df[EMAIL_TEXT] = df[EMAIL_TEXT].fillna('')
    
    return train, test

# ============================================================================
# STEP 2: Metrics
# ============================================================================

def _get_proba(pipe, X):
    """Extract probability/decision scores for ROC-AUC."""
    if hasattr(pipe, 'predict_proba'):
        return pipe.predict_proba(X)[:, 1]
    if hasattr(pipe, 'decision_function'):
        return pipe.decision_function(X)
    return None


def compute_scores(y_true, y_pred, y_score=None):
    """Compute evaluation metrics."""
    return {
        'accuracy': accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred, zero_division=0),
        'recall': recall_score(y_true, y_pred, zero_division=0),
        'f1': f1_score(y_true, y_pred, zero_division=0),
        'roc_auc': roc_auc_score(y_true, y_score) if y_score is not None else float('nan'),
    }

# ============================================================================
# STEP 3: Build Pipeline
# ============================================================================

def build_email_pipeline(classifier):
    """
    Build email classification pipeline:
    - TF-IDF on text_clean (sparse features)
    - StandardScaler on numeric features
    - Classifier
    """
    parts = [
        ('text', TfidfVectorizer(
            max_features=20000,
            ngram_range=(1, 2),
            stop_words='english',
            min_df=2,
            max_df=0.95
        ), EMAIL_TEXT),
    ]
    
    # Add numeric features
    parts.append((
        'num',
        StandardScaler(with_mean=False),  # Sparse-safe scaler
        EMAIL_NUM
    ))
    
    return Pipeline([
        ('preprocess', ColumnTransformer(parts)),
        ('classifier', classifier)
    ])

# ============================================================================
# STEP 4: Run Experiment
# ============================================================================

def log_result(row):
    """Append result to CSV log."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    cols = ['track', 'model', 'accuracy', 'precision', 'recall', 'f1', 'roc_auc', 
            'cv_f1', 'train_time', 'n_support_vectors']
    
    exists = RESULTS_CSV.exists()
    with open(RESULTS_CSV, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        if not exists:
            writer.writeheader()
        writer.writerow({k: row.get(k, '') for k in cols})


def run_experiment(model_name, classifier, X_train, y_train, X_test, y_test):
    """
    Train and evaluate model:
    1. 5-fold stratified CV on train (report mean F1)
    2. Fit on full train set
    3. Evaluate on test set
    4. Log all metrics
    """
    pipe = build_email_pipeline(classifier)
    
    # Cross-validation
    print(f"\n{'='*70}")
    print(f"Training {model_name}...")
    print(f"{'='*70}")
    
    print(f"Running 5-fold stratified cross-validation on {len(X_train)} samples...")
    t0 = time.time()
    cv_scores = cross_val_score(
        pipe, X_train, y_train, cv=CV, scoring='f1', n_jobs=-1
    )
    cv_time = time.time() - t0
    cv_f1_mean = cv_scores.mean()
    print(f"  CV F1 scores: {cv_scores.round(4)}")
    print(f"  Mean CV F1: {cv_f1_mean:.4f} (±{cv_scores.std():.4f})")
    
    # Train on full training set
    print(f"\nTraining on full training set ({len(X_train)} samples)...")
    t0 = time.time()
    pipe.fit(X_train, y_train)
    train_time = time.time() - t0
    print(f"  Training time: {train_time:.2f}s")
    
    # Test set evaluation
    print(f"\nEvaluating on test set ({len(X_test)} samples)...")
    y_pred = pipe.predict(X_test)
    y_score = _get_proba(pipe, X_test)
    metrics = compute_scores(y_test, y_pred, y_score)
    
    # Count support vectors (only for LinearSVC)
    n_sv = None
    if hasattr(classifier, 'n_support_'):
        n_sv = classifier.n_support_.sum()
    
    print(f"\nResults on test set:")
    for metric, value in metrics.items():
        if not np.isnan(value):
            print(f"  {metric:12s}: {value:.4f}")
    
    if n_sv is not None:
        print(f"  Support vectors: {n_sv}")
    
    # Log result
    row = {
        'track': 'email',
        'model': model_name,
        **{k: round(v, 4) for k, v in metrics.items()},
        'cv_f1': round(cv_f1_mean, 4),
        'train_time': round(train_time, 2),
        'n_support_vectors': n_sv if n_sv else '',
    }
    log_result(row)
    print(f"\n[OK] Result logged to {RESULTS_CSV}")
    
    return pipe, metrics

# ============================================================================
# STEP 5: Train SVM
# ============================================================================

if __name__ == '__main__':
    # Load data
    print("Loading email dataset...")
    email_train, email_test = load_email()
    print(f"  Train: {len(email_train)} samples")
    print(f"  Test:  {len(email_test)} samples")
    print(f"  Class distribution (train):")
    print(f"    Benign (0): {(email_train['label']==0).sum()}")
    print(f"    Phishing (1): {(email_train['label']==1).sum()}")
    
    # Prepare feature matrices
    X_train = email_train[[EMAIL_TEXT] + EMAIL_NUM]
    y_train = email_train['label']
    X_test = email_test[[EMAIL_TEXT] + EMAIL_NUM]
    y_test = email_test['label']
    
    # Train SVM with different C values (hyperparameter tuning)
    svm_configs = [
        ('LinearSVC (C=0.1, balanced)', LinearSVC(C=0.1, class_weight='balanced', max_iter=2000, random_state=RANDOM_STATE)),
        ('LinearSVC (C=1.0, balanced)', LinearSVC(C=1.0, class_weight='balanced', max_iter=2000, random_state=RANDOM_STATE)),
        ('LinearSVC (C=10.0, balanced)', LinearSVC(C=10.0, class_weight='balanced', max_iter=2000, random_state=RANDOM_STATE)),
    ]
    
    for model_name, clf in svm_configs:
        run_experiment(model_name, clf, X_train, y_train, X_test, y_test)
    
    print(f"\n{'='*70}")
    print(f"All experiments complete!")
    print(f"Results summary:")
    results_df = pd.read_csv(RESULTS_CSV)
    print(results_df.to_string(index=False))
