# Roadmap

This roadmap aligns the 10 project milestones with concrete deliverables, owners, and exit criteria.

## Phase Overview

| Phase | Milestones | Focus |
|---|---|---|
| Research | M1 – M5 | Understand the problem, gather data, design the system |
| Deployment | M6 – M10 | Build, integrate, secure, deploy, evaluate |

## Milestone Plan

### M1 — Understanding Phishing Threats ✅ Complete
- Deliverables: Threat research write-up
- Exit: Team can describe phishing types, URL tactics, and detection approaches confidently

### M2 — Dataset Collection ✅ Complete
- Deliverables: Datasets imported, dataset README
- Exit: At least one phishing email dataset, one URL dataset, one clean email dataset are versioned and documented
- **Outcome:** phishing-email dataset (~82.5k rows) and malicious-URL dataset (~651k) imported to S3 and documented; see [Dataset EDA](datasets/eda.md).

### M3 — AWS Foundation + Email Server (Rocky Linux on EC2) ✅ Complete
- Deliverables:
  - Existing AWS baseline from M2 reviewed and reused, especially IAM and the datasets S3 bucket
  - Terraform codifies or extends the required AWS foundation for later milestones
  - Rocky Linux 9 EC2 instance running Postfix + Dovecot
  - Setup runbook in `docs/`
  - Budget alerts and MFA confirmed for the active AWS account
- Exit: Terraform can reproduce or extend the agreed infra baseline, and the Rocky Linux mail server successfully sends and receives test emails between two local accounts
- **Outcome:** Terraform baseline live; Postfix + Dovecot mail server verified (local delivery works, open-relay rejected). See the [destroy/rebuild runbook](runbook-destroy-rebuild.md).

### M4 — Data Preprocessing ✅ Complete
- Deliverables: Preprocessing pipeline, processed dataset, feature documentation
- Exit: Reproducible script that produces a feature matrix from raw data
- **Outcome:** reproducible pipeline produced the email feature matrix (82,078 rows) and 11-feature URL matrix (641,119 rows), exported as stratified train/test splits. See the [Feature Matrix](data/feature-matrix.md).

### M5 — ML Model Selection ✅ Complete
- Deliverables: Model comparison table, selection rationale
- Exit: A primary model is selected with clear justification
- **Outcome:** benchmarked 11 models across both tracks via a shared harness. Selected
  **LinearSVC** for email (F1 ≈ 0.99) and a **character-level CNN** for URLs (F1 ≈ 0.97), with
  Random Forest as a CPU fallback. DistilBERT was evaluated and rejected (a 0.4% gain for ~258×
  the cost). See [Model Selection](machine-learning.md).

### M6 — Model Training & Testing
- Deliverables: Trained model artifacts, evaluation report (accuracy, precision, recall, F1, ROC-AUC)
- Exit: Test metrics meet targets in PRD §6 or have a documented improvement plan
- Scope: freeze the M4-T7 splits; train + serialize the email LinearSVC (+ TF-IDF vectorizer), the
  URL char-CNN (+ char-vocab), and the RF fallback; evaluate vs PRD targets with threshold tuning;
  package a per-track `predict()` interface; and store versioned artifacts in S3 for M7.
- Note: the char-CNN trains on GPU (Colab) but **serves on CPU**, so no AWS GPU is needed.

### M7 — Inference Service + Dashboard Upload (Phase A) and Mail Integration (Phase B)
- **Phase A (first half of M7):** FastAPI on ECS Fargate, Amplify dashboard with upload tool calling `/score`
- **Phase B (second half of M7):** Postfix `content_filter` calls the same `/score`, detections appear in dashboard alongside upload-mode results
- Exit: Both upload mode and server mode produce detections visible in the dashboard

### M8 — Performance Tuning
- Deliverables: Updated metrics post-tuning, list of changes made
- Exit: False positive and false negative rates improved versus M6 baseline

### M9 — Security & Compliance
- Deliverables: Threat model, security controls checklist, compliance discussion
- Exit: All "Must" controls in `docs/threat-model.md` are implemented and documented

### M10 — Deployment & Evaluation
- Deliverables: Full end-to-end demo on AWS with captured metrics
- Exit: Project meets PRD success metrics or documents gap with mitigation plan

## Suggested Weekly Cadence

| Week | Milestones | Parallel tracks |
|---|---|---|
| 1 | M1 | Form team, scope, research |
| 2 | M2 + M3 (start) | Datasets in S3 • AWS baseline established • Terraform scaffold starts |
| 3 | M3 (finish) + M4 + M5 | EC2 mail server up • preprocessing • model selection • dashboard skeleton scaffolded |
| 4–5 | M6 + M7 Phase A | Train models • deploy FastAPI to ECS • dashboard upload tool live |
| 5–6 | M7 Phase B | Postfix `content_filter` integrated; detections from both modes flow to RDS + dashboard |
| 6–7 | M8 | Tune model, add trend charts, CI security gates active |
| 7–8 | M9 | WAF, Cognito, hardening, threat model verification |
| 8–9 | M10 | Final demo on AWS, metrics captured |

## Parallel Tracks

Four tracks run concurrently from week 2 onward:

| Track | Owner role | Output |
|---|---|---|
| **Cloud / Infra** | Infrastructure | Terraform modules, AWS account hardening, CI/CD pipeline |
| **Mail Server** | Infrastructure | Postfix + Dovecot on Rocky Linux EC2, content_filter |
| **ML** | ML Engineer + Research & Data | Datasets, preprocessing, model training, evaluation |
| **Frontend / Backend** | Frontend & Security + ML Engineer | FastAPI inference service, Amplify dashboard, upload tool |

## Tracking

- Backlog and weekly assignments live in [Notion](https://www.notion.so/361ee3d2d2cf811890e3c6ea307645f3)
- Issues and PRs live in **GitHub**: https://github.com/naratech-eng/Email-Security-Pipeline
- Documentation lives in **GitBook**, sourced from `/docs/` in the repo
