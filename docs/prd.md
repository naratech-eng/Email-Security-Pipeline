# Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Project | Email Security Pipeline — Phishing Email & Malicious URL Classifier |
| Status | Draft v1.0 |
| Owners | Project Lead + core team (5 members) |
| Repo | https://github.com/naratech-eng/Email-Security-Pipeline |

## 1. Problem Statement

Phishing emails and malicious URLs remain a leading initial-access vector for credential theft, malware delivery, and business email compromise. Traditional rule-based filters miss novel and obfuscated phishing patterns, while commercial AI filters are closed and not customizable for academic or small-org environments. Our team needs a transparent, self-hosted pipeline that demonstrates how machine learning can be integrated into a real mail server to detect phishing in near real time.

## 2. Goals

- **G1.** Deliver an **operator dashboard** (AWS Amplify) where a user can upload or paste an email and immediately see a phishing verdict, score, and feature breakdown. *(MVP / demo path)*
- **G2.** Build a **Postfix + Dovecot mail server** on Rocky Linux 9 (EC2) that we control end to end.
- **G3.** Train and evaluate at least one ML classifier that detects phishing emails with measurable accuracy on a public dataset.
- **G4.** Train or extend a classifier that scores URLs found inside emails.
- **G5.** Integrate the same scoring backend into the mail flow so suspicious emails are flagged or quarantined automatically.
- **G6.** Run the full system on **AWS** (Amplify + ECS Fargate + RDS + EC2) provisioned via **Terraform**.
- **G7.** Apply **DevSecOps** practices (CI/CD, IaC scanning, container scanning, secrets management) across the SDLC.
- **G8.** Document the entire pipeline (architecture, threats, decisions, tests) so it can be reproduced.

## 3. Non-Goals

- We are not building a production-grade anti-spam product.
- We are not handling sender reputation services, full DMARC reporting, or large-scale traffic.
- We are not building a mobile client or end-user webmail experience.
- We are not training a foundation model from scratch — fine-tuning or classical ML only.
- We are not deploying multi-account or multi-region AWS — single account, single region (e.g. `us-east-1`).

## 4. Target Users / Personas

| Persona | Role | Needs |
|---|---|---|
| Security Operator (Sam) | Reviews flagged email, runs ad-hoc upload checks | Clear dashboard, upload tool, low false-positive rate |
| Mail Server Admin (Alex) | Runs Rocky Linux mail server on EC2 | Clean integration, logs, easy rollback, IaC-managed config |
| Cloud Engineer (Jordan) | Owns AWS account, Terraform, CI/CD pipeline | Reproducible infra, security baselines, low cost |
| End User (Riley) | Sends/receives email | Legitimate mail must still arrive on time |
| Technical Reviewer | Evaluates the project | Reproducible setup, clear docs, evidence of testing |

## 5. User Stories (high level)

- As a **Security Operator**, I want to upload or paste a suspicious email and immediately see a verdict, confidence score, and which features were suspicious.
- As a **Security Operator**, I want to see all incoming server-flagged emails alongside my upload-checked emails in one filterable list.
- As a **Mail Server Admin**, I want the classifier to fail open (deliver normally) if the model service is down so mail flow is not blocked.
- As a **Cloud Engineer**, I want to spin up or tear down the entire stack with `terraform apply` / `terraform destroy`.
- As a **Cloud Engineer**, I want the CI pipeline to block merges if Terraform, container, or dependency scans find high-severity issues.
- As an **End User**, I want my legitimate email to be delivered without delay and without being quarantined.
- As a **Reviewer**, I want to see test results, threat model, and architecture in one place.

## 6. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Phishing email recall on test set | ≥ 0.90 | Holdout test split |
| Phishing email precision on test set | ≥ 0.90 | Holdout test split |
| URL classifier F1 | ≥ 0.85 | Holdout test split |
| Upload-mode end-to-end latency | < 1 second p95 | Dashboard → ECS → dashboard round trip |
| Server-mode inference latency per email | < 2 seconds | Pipeline benchmark |
| False positive rate on legitimate corpus | < 2% | Enron-like clean corpus |
| Mail flow availability with classifier active | ≥ 99% during demo window | Mail server logs |
| Infrastructure reproducibility | `terraform apply` from scratch succeeds | CI run |
| Pipeline security gates | All scans (tfsec, Checkov, Trivy, pip-audit) pass on `main` | GitHub Actions |
| Documentation completeness | All 10 milestones documented | Manual review |

## 7. Scope

### In scope
- AWS account with VPC, ECS Fargate, ALB, RDS, S3, ECR, Cognito, CloudWatch, CloudTrail
- Rocky Linux 9 EC2 mail server (Postfix + Dovecot)
- Email + URL feature extraction
- Classical ML models (SVM, Random Forest, Logistic Regression) and one neural baseline (LSTM or DistilBERT)
- FastAPI inference service in a container, deployed to ECS
- React dashboard on AWS Amplify with **upload tool** and **flagged-email list**
- Terraform modules for all infrastructure
- GitHub Actions CI/CD with security scanning gates
- Logging, metrics, alarms, and DevSecOps controls
- Documentation site (this GitBook), [Notion workspace](https://www.notion.so/361ee3d2d2cf811890e3c6ea307645f3), GitHub repo

### Out of scope
- Outbound mail filtering, DLP, encryption-at-rest beyond defaults
- Multi-tenant SaaS deployment
- Mobile apps

## 8. Assumptions

- We have an AWS account with admin rights for the duration of the project.
- A spending limit / budget alert is configured to avoid runaway cost.
- Public datasets (Kaggle phishing corpus, PhishTank, OpenPhish, Enron) are usable for academic purposes.
- Team has Python, basic Linux admin, and basic AWS skills; one member owns Terraform.
- We can demo on a small pilot mailbox set, not a real production user base.
- AWS port 25 throttling is acceptable; we only need inbound mail for the demo, not outbound at volume.

## 9. Constraints

- 8–10 week delivery window.
- 4–6 person team with mixed roles.
- All infrastructure must be reproducible via Terraform from the repo.
- All code and docs are public on GitHub.
- Stay within free tier where possible; t4g/t3.micro and Fargate Spot acceptable for non-demo time.

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dataset class imbalance | Medium | High | Use stratified sampling, SMOTE if needed |
| Model service outage breaks mail flow | Low | High | Fail-open design, timeout + circuit breaker |
| Server misconfiguration causes open relay | Low | Critical | Restrict relay, enable SPF/DKIM/DMARC checks |
| False positives quarantine real mail | Medium | High | Tunable threshold, "flag" mode before "quarantine" mode |
| AWS bill exceeds budget | Medium | Medium | Budget alerts, scheduled `terraform destroy` outside demo windows |
| Team member unavailability | Medium | Medium | Cross-training, project lead reassigns tasks |
| AWS quota / port 25 limits | Medium | Medium | Submit limit increase early; have local fallback for SMTP demo |

## 11. Open Questions

- AWS region: `us-east-1` (cheapest + most services) or `ca-central-1` (lower latency for the team)? *(Default: `us-east-1`)*
- Do we need to support attachments analysis in the first version? *(Default: no, URL + headers + body only)*
- Cognito only, or also support a guest demo link with rate limits? *(Default: Cognito only)*
- Dashboard framework: React + Vite, or Next.js? *(Default: React + Vite for simplicity)*

## 12. References

- Project brief (`project-details.md`)
- Notion workspace: https://www.notion.so/361ee3d2d2cf811890e3c6ea307645f3
- Repo: https://github.com/naratech-eng/Email-Security-Pipeline
