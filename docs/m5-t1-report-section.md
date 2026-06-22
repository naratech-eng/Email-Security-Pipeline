# M5-T1: Evaluation Protocol & Experiment Harness (Sanjeewa Narayana)

**Role:** ML Lead | **Depends on:** M4-T7 (model-ready splits)

> Paste into the M5 report. Replace each `>>> INSERT IMAGE HERE: <file> <<<` with the
> matching screenshot from `Image/M5-T1/`.

## Objective
Before any model is trained, M5-T1 fixes **one shared evaluation protocol** and packages it
as a reusable harness (`notebooks/M5/m5_harness.ipynb`). Every later experiment — email (T2),
URL (T3), and the deep-learning stretches (T7/T8) — imports these helpers, so all results are
produced the same way and are directly comparable.

## The protocol (the plan)
- **Primary metrics:** F1 and ROC-AUC (both datasets are imbalanced, so accuracy alone is misleading).
- **Validation:** 5-fold *stratified* cross-validation on the **train** split; final numbers reported once on the held-out **test** split.
- **Fixed seed (42):** identical folds and splits for every model → a fair comparison.

---

## 1. Configuration
The harness first locks the protocol constants and declares which columns are features per track.

```python
RANDOM_STATE = 42
CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

EMAIL_TEXT = 'text_clean'                       # -> TF-IDF
EMAIL_NUM  = ['urgency_score', 'word_count', 'avg_word_length']
URL_FEATS  = ['url_length', 'hostname_length', 'num_dots', ...]   # 11 numeric
```

**Explanation:** `CV` is defined once and reused everywhere, so every model is scored on the
same folds. `link_count` and `html_ratio` are intentionally **excluded** from `EMAIL_NUM` —
they are constant-zero on this corpus, so scaling them adds numeric noise without signal.

**Figure 1. Harness configuration**
>>> INSERT IMAGE HERE: fig1_configuration.png <<<

---

## 2. Split loaders
Small helpers load each track's train/test CSVs and guard against empty text.

```python
def load_email():
    tr = pd.read_csv(PROC/'email_train.csv'); te = pd.read_csv(PROC/'email_test.csv')
    for d in (tr, te):
        d[EMAIL_TEXT] = d[EMAIL_TEXT].fillna('')
    return tr, te

def load_url():
    return pd.read_csv(PROC/'url_train.csv'), pd.read_csv(PROC/'url_test.csv')
```

**Explanation:** centralising loading means no experiment accidentally reads a different file
or split. The `fillna('')` ensures the TF-IDF vectorizer never receives a `NaN`.

---

## 3. Metric helper
One function computes all five metrics; a second extracts a probability score for ROC-AUC.

```python
def _proba(pipe, X):
    if hasattr(pipe, 'predict_proba'):    return pipe.predict_proba(X)[:, 1]
    if hasattr(pipe, 'decision_function'): return pipe.decision_function(X)
    return None

def scores(y_true, y_pred, y_score=None):
    return {'accuracy': ..., 'precision': ..., 'recall': ...,
            'f1': ..., 'roc_auc': roc_auc_score(y_true, y_score)}
```

**Explanation:** `_proba` makes the harness model-agnostic — it works with classifiers that
expose `predict_proba` (Logistic Regression, Random Forest, Naive Bayes) **and** those that
only expose `decision_function` (Linear SVM), so ROC-AUC is always available.

---

## 4. Pipeline factories
Each track gets a factory that wraps any classifier in the correct preprocessing.

```python
def email_pipeline(clf, tfidf_only=False):
    parts = [('text', TfidfVectorizer(max_features=20000, ngram_range=(1, 2)), EMAIL_TEXT)]
    if not tfidf_only:
        parts.append(('num', StandardScaler(with_mean=False), EMAIL_NUM))
    return Pipeline([('pre', ColumnTransformer(parts)), ('clf', clf)])

def url_pipeline(clf, scale=True):
    steps = [('scale', StandardScaler())] if scale else []
    return Pipeline(steps + [('clf', clf)])
```

**Explanation:** the email factory combines TF-IDF on the text with scaled numeric features in
one `ColumnTransformer`; `tfidf_only=True` is used for Naive Bayes (which needs non-negative
input). The URL factory scales for linear/SVM models and is bypassed (`scale=False`) for tree
ensembles, which don't need it.

---

## 5. The experiment runner
A single function runs CV, fits, evaluates on test, and logs the result row.

```python
def run_experiment(name, track, pipe, Xtr, ytr, Xte, yte, log=True):
    cv_f1 = cross_val_score(pipe, Xtr, ytr, cv=CV, scoring='f1', n_jobs=-1).mean()
    pipe.fit(Xtr, ytr)
    m = scores(yte, pipe.predict(Xte), _proba(pipe, Xte))
    # -> append {track, model, accuracy..f1, roc_auc, cv_f1, train_time} to m5_results.csv
```

**Explanation:** this is the only entry point experiments call. Because it enforces the shared
`CV`, metric set, and an auto-appended row in `results/m5_results.csv`, every candidate model
lands in one comparable table that feeds M5-T4/T5.

---

## 6. Validation run
The harness was validated with one model per track on subsampled data.

```python
run_experiment('LogReg (demo)', 'email',
               email_pipeline(LogisticRegression(max_iter=1000)), ...)
run_experiment('RandomForest (demo)', 'url',
               url_pipeline(RandomForestClassifier(...), scale=False), ...)
```

**Figure 2. Validation run output**
>>> INSERT IMAGE HERE: fig2_validation_run.png <<<

| Track | Demo model | F1 | ROC-AUC | CV-F1 |
| --- | --- | --- | --- | --- |
| Email | Logistic Regression | 0.9724 | 0.9948 | 0.9708 |
| URL | Random Forest | 0.8201 | 0.9418 | 0.8137 |

Every run also appends to the shared results log:

**Figure 3. Shared results log (m5_results.csv)**
>>> INSERT IMAGE HERE: fig3_results_log.png <<<

---

## Conclusion
M5-T1 delivers a validated, dependency-light harness that locks the metrics (F1/ROC-AUC), the
5-fold stratified CV, and the fixed split for the entire M5 phase. With one
`run_experiment(...)` call, T2/T3/T7/T8 produce directly comparable results in a single log —
making the model selection in M5-T5 a fair, evidence-based decision rather than a set of
inconsistent one-off scores.
