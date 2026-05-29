# Dataset EDA Summary

**Milestone:** M2 — Dataset Collection
**Owner:** Sanjeewa Narayana
**Notebook:** `notebooks/m2_eda.ipynb`

> This document captures the light exploratory data analysis performed during M2.
> Deep feature-level analysis is deferred to M4 (Preprocessing) and M5/M6 (Model Selection/Training).

---

## 1. Phishing Email Dataset

**Source:** Kaggle — Naser Abdullah Alam  
**S3 path:** `s3://email-security-pipeline-datasets/datasets/phishing/`

| Metric | Value |
|---|---|
| Total rows | ~82,500 |
| Phishing emails | TBD — update after EDA notebook run |
| Legitimate emails | TBD — update after EDA notebook run |
| Columns | `sender`, `subject`, `body`, `label` (and others) |
| Duplicates found | TBD |
| Empty rows | TBD |
| Encoding issues | TBD |

**Spot-check notes:** *(fill in after running notebook)*

---

## 2. Malicious URL Dataset

**Sources:**
1. Kaggle — Manu Siddhartha (primary): `s3://email-security-pipeline-datasets/datasets/urls/kaggle-malicious-urls.csv`
2. URLhaus — abuse.ch (supplementary): `s3://email-security-pipeline-datasets/datasets/urls/urlhaus-YYYY-MM-DD.csv`

| Metric | Value |
|---|---|
| Total URLs (Kaggle) | ~651,000 |
| Classes | benign, phishing, malware, defacement |
| URLhaus date range | TBD — update after EDA notebook run |
| Duplicates found | TBD |
| Malformed URLs | TBD |

**Spot-check notes:** *(fill in after running notebook)*

---

## 3. Action Items

- [ ] Run `notebooks/m2_eda.ipynb` and fill in the TBD fields above
- [ ] Verify S3 uploads for both datasets
- [ ] Mark Notion M2-T1 and M2-T2 as **Done** with S3 paths in Accomplishments
