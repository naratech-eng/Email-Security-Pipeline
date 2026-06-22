# Dataset EDA Summary

**Milestone:** M2 — Dataset Collection
**Owner:** Sanjeewa Narayana
**Notebook:** `notebooks/m2_eda.ipynb`

> Light exploratory analysis from M2, now updated with the final figures confirmed through
> M4 (Preprocessing) and M5 (Model Selection). Cleaned/model-ready counts come from the
> M4-T7 stratified splits in `data/processed/`.

---

## 1. Phishing Email Dataset

**Source:** Kaggle — Naser Abdullah Alam  
**S3 path:** `s3://email-security-pipeline-datasets/datasets/phishing/`

| Metric | Value |
|---|---|
| Total rows (raw) | ~82,500 |
| Total rows (cleaned, M4-T1) | **82,078** |
| Phishing emails | **42,845 (52.2%)** |
| Legitimate emails | **39,233 (47.8%)** |
| Columns | `sender`, `subject`, `body`, `label` (and others) |
| Duplicates / invalid rows removed | ~400 (raw ≈ 82.5k → 82,078 cleaned in M4-T1) |
| Empty / encoding issues | handled in the M4-T1 normalization step (HTML/URL/header stripping) |

**Notes:** roughly balanced after cleaning; model-ready split is 65,662 train / 16,416 test (M4-T7).

---

## 2. Malicious URL Dataset

**Sources:**
1. Kaggle — Manu Siddhartha (primary): `s3://email-security-pipeline-datasets/datasets/urls/malicious_phish.csv`
2. URLhaus — abuse.ch (supplementary): `s3://email-security-pipeline-datasets/datasets/urls/urlhaus-YYYY-MM-DD.csv`

| Metric | Value |
|---|---|
| Total URLs (raw, Kaggle) | ~651,000 |
| Total URLs (deduplicated, M4-T3) | **641,119** |
| Original classes | benign, phishing, malware, defacement |
| Binarized labels (M4-T3) | **benign 428,080 (66.8%) · malicious 213,039 (33.2%)** — ≈ 2:1 |
| Duplicates removed | ~9,900 (≈ 651k → 641,119) |
| URLhaus date range / malformed URLs | URLhaus used only as a supplementary feed; not merged into the final training set |

**Notes:** the ~2:1 imbalance drives the choice of F1/ROC-AUC over accuracy; model-ready split is
512,895 train / 128,224 test (M4-T7).

---

## 3. Status

- [x] EDA figures confirmed and recorded (via the M4 preprocessing + M4-T7 export)
- [x] S3 uploads verified for both datasets
- [x] Notion M2-T1 / M2-T2 marked **Done** with S3 paths
