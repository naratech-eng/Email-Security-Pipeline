# Machine Learning — Model Selection

> Two-track phishing classifier: an **email-text** model and a **URL** model, combined at decision
> time. Every candidate is benchmarked through one shared evaluation harness (5-fold stratified
> cross-validation; F1 and ROC-AUC reported on a held-out test split) so results are directly
> comparable.

## Selected models (M5 outcome)

| Track | Primary model | Test F1 | ROC-AUC | Notes |
| --- | --- | --- | --- | --- |
| **Email** | **LinearSVC** (TF-IDF + numeric) | **0.990** | 0.999 | Fast, CPU-only, interpretable |
| **URL** | **Character-level CNN** (raw URL) | **0.974** | 0.998 | Best accuracy; needs GPU to train, CPU to serve |
| URL (fallback) | Random Forest (11 features) | 0.866 | 0.965 | CPU-only fallback; clears the F1 ≥ 0.85 target |

## How we got there

- **Email track:** LinearSVC beat Logistic Regression, Random Forest, and Multinomial Naive Bayes
  on TF-IDF + body features.
- **URL track:** Random Forest was the engineered-feature winner (over Decision Tree, XGBoost,
  Gradient Boosting, Logistic Regression); a character-level CNN on the raw URL string then beat it
  by **+0.108 F1**.
- **Deep-learning verdict:** the char-CNN is worth adopting for URLs (large gain, modest cost), but
  **DistilBERT was rejected for email** — it edged LinearSVC by only +0.004 F1 at ~258× the
  training cost. Deep learning paid off only where the classical model left real signal on the table.

## Detailed reports

- [Evaluation Protocol & Harness (M5-T1)](m5-t1-report-section.md)
- [URL Classifier — model experiments (M5-T3)](m5-t3-report-section.md)
- [Model Comparison & Primary Selection (M5-T5)](m5-t5-model-comparison.md)
- [Deep-Learning Stretch — DistilBERT & char-CNN (M5-T7/T8)](m5-t7-t8-deep-learning.md)
- [Deep-Learning Research & Justification (M5-T11)](m5-t11-deep-learning-research.md)

## Next: M6 — training & packaging

The selected models move into **M6 (Model Training & Testing)**: train the final artifacts
(LinearSVC + TF-IDF vectorizer · char-CNN + char-vocab · RF fallback), evaluate against the PRD
targets (email precision & recall ≥ 0.90; URL F1 ≥ 0.85), package a per-track `predict()` interface,
and store versioned artifacts in S3 for the M7 inference service. See the [Roadmap](roadmap.md).
