# Roadmap

This roadmap aligns the 10 capstone milestones (see `milestone-guide.md`) with concrete deliverables, owners, and exit criteria.

## Phase Overview

| Phase | Milestones | Focus |
|---|---|---|
| Research | M1 – M5 | Understand the problem, gather data, design the system |
| Deployment | M6 – M10 | Build, integrate, secure, deploy, evaluate |

## Milestone Plan

### M1 — Understanding Phishing Threats
- Deliverables: Research presentation, no formal report required
- Exit: Team can describe phishing types, URL tactics, and detection approaches confidently

### M2 — Dataset Collection
- Deliverables: Datasets imported, dataset README, presentation + report
- Exit: At least one phishing email dataset, one URL dataset, one clean email dataset are versioned and documented

### M3 — AWS Foundation + Email Server (Rocky Linux on EC2)
- Deliverables:
  - Terraform modules for VPC, ECS skeleton, RDS, S3, ECR, Cognito
  - Rocky Linux 9 EC2 instance running Postfix + Dovecot
  - Setup runbook in `docs/`
  - Budget alerts and MFA configured
- Exit: `terraform apply` produces a working VPC + EC2 mail server; test emails flow between two local accounts

### M4 — Data Preprocessing
- Deliverables: Preprocessing pipeline, processed dataset, feature documentation
- Exit: Reproducible script that produces a feature matrix from raw data

### M5 — ML Model Selection
- Deliverables: Model comparison table, selection rationale, presentation + report
- Exit: A primary model is selected with clear justification

### M6 — Model Training & Testing
- Deliverables: Trained model artifact, evaluation report (accuracy, precision, recall, F1)
- Exit: Test metrics meet targets in PRD §6 or have a documented improvement plan

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
- Deliverables: Final demo, final report, final presentation
- Exit: Project meets PRD success metrics or documents gap with mitigation plan

## Suggested Weekly Cadence

| Week | Milestones | Parallel tracks |
|---|---|---|
| 1 | M1 | Form team, scope, research |
| 2 | M2 + M3 (start) | Datasets in S3 • AWS account + Terraform skeleton |
| 3 | M3 (finish) + M4 + M5 | EC2 mail server up • preprocessing • model selection • dashboard skeleton scaffolded |
| 4–5 | M6 + M7 Phase A | Train models • deploy FastAPI to ECS • dashboard upload tool live |
| 5–6 | M7 Phase B | Postfix `content_filter` integrated; detections from both modes flow to RDS + dashboard |
| 6–7 | M8 | Tune model, add trend charts, CI security gates active |
| 7–8 | M9 | WAF, Cognito, hardening, threat model verification |
| 8–9 | M10 | Final demo on AWS, report, presentation |

## Parallel Tracks

Four tracks run concurrently from week 2 onward:

| Track | Owner role | Output |
|---|---|---|
| **Cloud / Infra** | Infrastructure | Terraform modules, AWS account hardening, CI/CD pipeline |
| **Mail Server** | Infrastructure | Postfix + Dovecot on Rocky Linux EC2, content_filter |
| **ML** | ML Engineer + Research & Data | Datasets, preprocessing, model training, evaluation |
| **Frontend / Backend** | Frontend & Security + ML Engineer | FastAPI inference service, Amplify dashboard, upload tool |

## Tracking

- Backlog and weekly assignments live in **Notion**
- Issues and PRs live in **GitHub**: https://github.com/naratech-eng/Email-Security-Pipeline
- Documentation lives in **GitBook**, sourced from `/docs/` in the repo
