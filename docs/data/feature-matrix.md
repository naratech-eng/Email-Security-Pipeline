# M4 Feature Matrices — Data Dictionary

The project produces **two independent model-ready datasets** (two-track architecture).
They are not merged: an email and a single URL are different units with different row
counts. M5 trains a model per track and combines them at decision time.

All processed artifacts live in S3 (kept out of Git):
`s3://email-security-pipeline-datasets/datasets/processed/`

| Artifact | Rows | Purpose |
|---|---|---|
| `email_features.csv` | 82,078 | Full email feature matrix (M4-T6) |
| `url_features.csv` | 641,119 | Full URL feature matrix (M4-T3) |
| `splits/email_train.csv` / `email_test.csv` | 65,662 / 16,416 | Stratified 80/20 split (M4-T7) |
| `splits/url_train.csv` / `url_test.csv` | 512,895 / 128,224 | Stratified 80/20 split (M4-T7) |

Split parameters: `test_size=0.20`, `stratify=label`, `random_state=42`.

---

## Email track — `email_features.csv`

| Column | Type | Role | Description | Source |
|---|---|---|---|---|
| `text_clean` | text | feature (TF-IDF) | Normalized email text (lowercased, HTML/URLs/emails stripped, whitespace collapsed). Primary language signal. | M4-T2 / M4-T6 |
| `urgency_score` | int | feature (numeric) | Count of urgency cues via stem + word-boundary matching. Interpretable auxiliary. | M4-T5 / M4-T6 |
| `link_count` | int | feature (numeric) | Count of http(s) links. **Zero on this corpus** (URLs pre-stripped); informative on live-captured email. | M4-T5 / M4-T6 |
| `html_ratio` | float | feature (numeric) | Ratio of HTML-tag chars to total chars. **Zero on this corpus** (HTML pre-stripped). | M4-T5 / M4-T6 |
| `word_count` | int | feature (numeric) | Number of words. Discriminative (legit ~204 vs phishing ~121). | M4-T5 / M4-T6 |
| `avg_word_length` | float | feature (numeric) | Average characters per word. | M4-T5 / M4-T6 |
| `label` | int | target | 1 = phishing, 0 = legitimate. | M4-T1 |

Class balance: phishing 42,845 / legitimate 39,233 (≈1.09:1).

**Modeling notes:** vectorize `text_clean` with TF-IDF/n-grams; scale the 5 numeric
columns for linear/SVM models; tree ensembles need no scaling; MultinomialNB requires
non-negative input (TF-IDF only or MinMax).

---

## URL track — `url_features.csv`

| Column | Type | Role | Description | Source |
|---|---|---|---|---|
| `url` | text | identifier (NOT a feature) | Raw URL string. Keep for reference/traceability; exclude from X. | M4-T3 |
| `url_length` | int | feature | Total characters in the URL. | M4-T3 |
| `hostname_length` | int | feature | Characters in the host portion. | M4-T3 |
| `num_dots` | int | feature | Count of `.` | M4-T3 |
| `num_hyphens` | int | feature | Count of `-` | M4-T3 |
| `num_at` | int | feature | Count of `@` | M4-T3 |
| `num_digits` | int | feature | Count of numeric characters. | M4-T3 |
| `num_special_chars` | int | feature | Count of `@ % ? = & _ ~` | M4-T3 |
| `has_ip` | int | feature | 1 if host is a raw IP address. | M4-T3 |
| `has_https` | int | feature | 1 if the URL uses HTTPS. | M4-T3 |
| `num_subdomains` | int | feature | Number of subdomain labels. | M4-T3 |
| `is_shortened` | int | feature | 1 if a known URL shortener. | M4-T3 |
| `label` | int | target | 1 = malicious (phishing/defacement/malware), 0 = benign. | M4-T3 |

Class balance: benign 428,080 / malicious 213,039 (≈2:1).

**Modeling notes:** drop `url` from X; all 11 features are numeric. Scale for linear/SVM;
tree ensembles need no scaling. Given the ~2:1 imbalance, report F1 and ROC-AUC (not just
accuracy) and consider `class_weight='balanced'`.
