# M2-T1 & M2-T2 — Dataset Selection and Justification

**Owner:** Sanjeewa Narayana
**Milestone:** M2 — Dataset Collection
**Tasks:** M2-T1 (phishing email dataset) & M2-T2 (malicious URL dataset)
**Date:** 2026-05-23

---

## 1. Overview

This document covers my portion of Milestone 2: selecting, downloading, and sharing the **phishing email dataset** and the **malicious URL dataset** that the rest of the team will build features and models on. Both datasets are uploaded to the project S3 bucket so the team can pull a single shared version, and both selections include a short justification explaining why the chosen source is the best fit for the project.

---

## 2. M2-T1 — Phishing Email Dataset

### 2.1 Selected Dataset

**Phishing Email Dataset** by *Naser Abdullah Alam* on Kaggle.
URL: https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset

### 2.2 Why This Dataset

This dataset is a **combined corpus** of several well-known public phishing email sources (Nazario Phishing Corpus, Enron, SpamAssassin, Nigerian Fraud, CEAS, and TREC). It already merges, cleans, and labels them, which removes a large amount of preprocessing work. For a capstone with a tight schedule, that matters.

Key reasons:

- **Size and balance:** ~82,500 emails with both phishing and legitimate labels in a single file.
- **Real email content:** the dataset includes full email body text, not just subject lines, so it supports proper feature extraction in M4 and model training in M5/M6.
- **Diversity of sources:** because it merges multiple corpora, it generalizes better than a single-source dataset.
- **License:** permissive academic use.
- **Tooling-friendly:** delivered as a CSV that loads directly into pandas with no `.eml` parsing required.

### 2.3 Datasets Considered but Not Chosen

| Dataset | Why not chosen |
|---|---|
| Nazario Phishing Corpus (raw `.eml`) | Requires `.eml` parsing pipeline before any ML work. |
| SpamAssassin Public Corpus | Smaller and skewed toward older spam, not modern phishing. |
| `subhajournal/phishingemails` (Kaggle) | Cleaner labels but smaller and less diverse. |
| CEAS 2008 | Outdated; phishing patterns have shifted significantly. |

### 2.4 Light Analysis (M2 Scope Only)

Run from a Jupyter notebook (`notebooks/m2_eda.ipynb`):

- Total row count and label split (phishing vs legitimate).
- Column / field inspection (sender, subject, body, label, etc.).
- Inspect 5–10 random samples per class to confirm labels visually.
- Check for empty rows, duplicates, and obvious encoding issues.
- Save a 1-paragraph summary to `/docs/datasets/eda.md`.

> Deeper feature-level analysis is intentionally deferred to **M4 (Preprocessing)** and **M5/M6 (Model Selection / Training)**.

### 2.5 Storage and Sharing

- Local download: `data/raw/phishing-emails/`
- Uploaded to S3:
  `s3://email-security-pipeline-datasets/datasets/phishing/`
- Shared with the team via the IAM group described in Section 4.

### 2.6 MLA 9 Citation

Alam, Naser Abdullah. *Phishing Email Dataset.* Kaggle, 2023, www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset.

---

## 3. M2-T2 — Malicious URL Dataset

### 3.1 Selected Sources

Two complementary sources are used:

1. **Malicious URLs Dataset** by *Manu Siddhartha* on Kaggle (primary)
   URL: https://www.kaggle.com/datasets/sid321axn/malicious-urls-dataset
2. **URLhaus** by *abuse.ch* (supplementary, fresh real-world malicious URLs)
   URL: https://urlhaus.abuse.ch/downloads/csv/

### 3.2 Why These Sources

The Kaggle dataset gives a **labeled, ready-to-use file** (~651,000 URLs) covering four classes: benign, phishing, malware, and defacement. URLhaus provides a **continuously updated** real-world feed, which keeps the project relevant against current phishing campaigns.

Key reasons:

- **Labeled and balanced:** the Kaggle dataset is already labeled across 4 classes, removing the need to manually label or merge multiple feeds.
- **No registration required:** PhishTank has paused new user registration, so its API is currently unreliable for new accounts. Kaggle and URLhaus both work without that bottleneck.
- **Volume and diversity:** ~651K URLs across four categories supports both classification and pattern analysis.
- **Real-time supplement:** URLhaus adds fresh malicious URLs daily, helping the model stay representative of current threats.
- **Open access:** both sources are free and licensed for academic use.

### 3.3 Sources Considered but Not Chosen

| Source | Why not chosen |
|---|---|
| **PhishTank API** | New user registration is currently disabled, blocking API access. |
| **OpenPhish Community Feed** | Smaller and less diverse than the Kaggle + URLhaus combination. |
| **Mendeley Malicious URLs (Singh, 2020)** | Larger but harder to integrate quickly; kept as a possible expansion later. |

### 3.4 Light Analysis (M2 Scope Only)

- Total URL count and class distribution.
- Date range of URLhaus entries (recency check).
- Spot-check 10–20 sample URLs across each class.
- Note any duplicates, malformed URLs, or unusual TLD patterns.
- Save a short summary in `/docs/datasets/eda.md`.

### 3.5 Storage and Sharing

- Local download: `data/raw/urls/`
- Uploaded to S3:
  `s3://email-security-pipeline-datasets/datasets/urls/`
- File naming: `kaggle-malicious-urls.csv`, `urlhaus-YYYY-MM-DD.csv`

### 3.6 MLA 9 Citations

Siddhartha, Manu. *Malicious URLs Dataset.* Kaggle, 2021, www.kaggle.com/datasets/sid321axn/malicious-urls-dataset.

abuse.ch. *URLhaus Database.* abuse.ch, 2026, urlhaus.abuse.ch/.

---

## 4. S3 Access for the Team

To share the datasets cleanly and securely, the project uses one IAM group with individual IAM users:

- **Bucket:** `s3://email-security-pipeline-datasets/`
- **IAM Group:** `email-security-team`
- **IAM Users:** one per non-owner team member (4 users), with the AWS account owner using owner credentials
- **Permissions:** `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` scoped to `email-security-pipeline-datasets/*`
- Each member uses their own access key.

This approach is preferred over a single shared IAM user because it provides per-user audit logs (CloudTrail) and key rotation isolation — both required for the DevSecOps milestone (M9). It is also AWS-recommended best practice.

A shared IAM user is technically possible for speed but is documented in the threat model as a known limitation if used.

---

## 5. Deliverables Checklist

- [ ] Phishing email dataset downloaded and uploaded to S3
- [ ] Malicious URL dataset (Kaggle + URLhaus) downloaded and uploaded to S3
- [ ] Light EDA captured in `notebooks/m2_eda.ipynb`
- [ ] Per-dataset `SOURCE.md` saved in `/docs/datasets/`
- [ ] MLA 9 citations added
- [ ] S3 access verified for at least one teammate
- [ ] Notion M2-T1 and M2-T2 marked **Done** with S3 path in Accomplishments

---

## 6. References

- *Phishing Email Dataset.* Kaggle. https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset
- *Malicious URLs Dataset.* Kaggle. https://www.kaggle.com/datasets/sid321axn/malicious-urls-dataset
- *URLhaus.* abuse.ch. https://urlhaus.abuse.ch/
- *OpenPhish Community Feed.* https://openphish.com/feed.txt
- *PhishTank Developer Information.* https://phishtank.org/developer_info.php
