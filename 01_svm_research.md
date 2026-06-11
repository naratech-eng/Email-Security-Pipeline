# Research: SVM for Text Classification

## Overview
Support Vector Machines (SVM) are powerful classifiers for binary and multi-class text classification. They work exceptionally well when combined with TF-IDF features.

## Why SVM for Text Classification?

### Strengths
1. Effective in high dimensions: TF-IDF creates sparse, high-dimensional feature spaces (10K-20K features); SVM handles this efficiently
2. Memory efficient: Only stores support vectors (subset of training data), not the entire dataset
3. Good generalization: Maximizes margin between classes, reducing overfitting risk
4. Fast prediction: Linear SVM prediction is O(n_features), very quick at inference
5. Robust to class imbalance: `class_weight='balanced'` automatically handles skewed datasets

### Disadvantages
1. Slower training: Scales as O(n_samples²) to O(n_samples³) for non-linear kernels
2. Sensitive to feature scaling: Requires proper normalization (TF-IDF is pre-normalized; numerics need StandardScaler)
3. Limited probability estimates: LinearSVC uses `decision_function` instead of probabilistic `predict_proba`

## Standard Pipeline for Email/Text Classification

```
Raw Text → TF-IDF Vectorizer → SVM Classifier
                ↓
        (1-20K sparse features)
```

For mixed data (text + numeric features):

```
Text Data ──→ TF-IDF (sparse)  ──┐
                                 ├→ Combine Features → Scale → SVM
Numeric Data → StandardScaler ──┘
```

## Key Parameters

### TF-IDF Vectorizer
- max_features: 10K-20K (typical for email; limits memory)
- ngram_range: (1, 1) for unigrams, (1, 2) for bigrams (captures 2-word phrases)
- stop_words: 'english' (removes common words like 'the', 'is', 'a')
- min_df / max_df: Filter rare/frequent terms

### LinearSVC Classifier
- C: Regularization strength (smaller = more regularization, fewer support vectors)
  - Default: 1.0
  - Range: 0.001 to 100 (log scale)
- loss: 'squared_hinge' (default, smooth) or 'hinge' (traditional SVM)
- max_iter: Training iterations (2000+ for large datasets)
- class_weight: 'balanced' for imbalanced datasets

## Cross-Validation Strategy
5-fold stratified CV on training data ensures:
- Each fold preserves class proportions
- Reproducible with fixed `random_state`
- Estimates generalization error via F1 score

## Metrics for Email Classification
- Accuracy: Overall correctness (can be misleading with imbalanced data)
- Precision: "Of predicted positives, how many were correct?" (minimize false alarms)
- Recall: "Of true positives, how many did we find?" (minimize missed threats)
- F1: Harmonic mean of precision & recall (balanced metric)
- ROC-AUC: Area under precision-recall curve (robust to class imbalance)

## Expected Performance
- Baseline (random): F1 ≈ 0.5, ROC-AUC ≈ 0.5
- With TF-IDF + LinearSVC: F1 ≈ 0.75–0.95, ROC-AUC ≈ 0.85–0.99 (depends on dataset)

## References
- Joachims (2006): "Training Linear SVMs in Linear Time"
- Scikit-learn docs: https://scikit-learn.org/stable/modules/svm.html
