# MoSCoW Requirements

Prioritization framework for the Email Security Pipeline. Each requirement is mapped to the milestone it primarily belongs to.

| Priority | Meaning |
|---|---|
| **Must** | Required for the project to be considered successful at the final demo. Non-negotiable. |
| **Should** | Important and expected, but the project still passes without them if blocked. |
| **Could** | Nice to have. Adds polish or stretch capability. |
| **Won't (this release)** | Explicitly out of scope for this capstone. May appear in a future iteration. |

---

## Must Have

| ID | Requirement | Milestone |
|---|---|---|
| M-01 | AWS baseline reviewed and extended as needed, with budget alerts and MFA confirmed on the active account | M2–M3 |
| M-02 | Terraform codifies or provisions VPC, ECS, ALB, RDS, S3, ECR, and Cognito required for the target architecture | M3 |
| M-03 | Rocky Linux 9 EC2 instance running Postfix + Dovecot, reachable on port 25 | M3 |
| M-04 | At least one phishing email dataset and one legitimate email dataset imported and stored in S3 | M2 |
| M-05 | Data preprocessing pipeline produces a clean, labeled feature dataset | M4 |
| M-06 | At least one ML classifier (e.g. Random Forest) trained and evaluated with reported accuracy/precision/recall/F1 | M5–M6 |
| M-07 | Trained model wrapped as a FastAPI service, containerized, pushed to ECR, deployed to ECS Fargate | M6–M7 |
| M-08 | **Dashboard upload tool**: operator can paste/upload an email and get an immediate verdict from the deployed inference API | M7 (early) |
| M-09 | Postfix `content_filter` calls the same inference API; suspicious mail is flagged or quarantined | M7 |
| M-10 | Operator dashboard (Amplify) lists detections from both upload and server modes with score and metadata | M7 / Cross |
| M-11 | Performance tuning round reduces false positives and false negatives versus the baseline | M8 |
| M-12 | Cognito-protected dashboard, mTLS or signed-token auth between milter and inference API | M9 |
| M-13 | Mail server hardening: restricted relay, SPF/DKIM/DMARC validation in path, security groups least-privilege | M9 |
| M-14 | GitHub Actions CI/CD: lint, test, Trivy on container, tfsec + Checkov on Terraform; required to merge to `main` | Cross |
| M-15 | End-to-end demo on AWS with metrics captured | M10 |
| M-16 | Final report and presentation aligned with milestone-guide deliverables | M10 |

## Should Have

| ID | Requirement | Milestone |
|---|---|---|
| S-01 | Dedicated URL classifier (separate from email classifier) integrated into the scoring pipeline | M5–M7 |
| S-02 | Confidence score and feature breakdown shown for each detection in the dashboard | Cross |
| S-03 | Detections stored in RDS Postgres with `source = upload \| server` flag | M7 |
| S-04 | Configurable thresholds for "flag" vs "quarantine" actions | M7–M8 |
| S-05 | Automated test suite for preprocessing and inference | M8 |
| S-06 | Threat model document with STRIDE coverage | M9 |
| S-07 | Fail-open behaviour when the model service is unreachable | M7–M9 |
| S-08 | CloudWatch alarms on 5xx rate and inference latency | M9 |
| S-09 | AWS WAF in front of public ALB with managed rule sets | M9 |
| S-10 | Secrets in AWS Secrets Manager / SSM Parameter Store, never in repo | Cross |
| S-11 | S3 buckets blocked from public access; default encryption + versioning | Cross |

## Could Have

| ID | Requirement | Milestone |
|---|---|---|
| C-01 | Neural model (LSTM or DistilBERT) compared against classical baselines | M5–M6 |
| C-02 | Trend graphs (daily phishing rate, top URL features) | Cross |
| C-03 | Simple alerting (e.g. SNS topic or email) on high-confidence detections | M9–M10 |
| C-04 | AWS Config rules / GuardDuty enabled | M9 |
| C-05 | X-Ray distributed tracing on FastAPI | Cross |
| C-06 | Multi-AZ RDS for the demo window | M10 |
| C-07 | ElastiCache (Redis) cache for repeated URL scores | Cross |

## Won't Have (this release)

| ID | Requirement | Reason |
|---|---|---|
| W-01 | Attachment sandboxing / static analysis | Out of capstone scope |
| W-02 | Multi-tenant or production SaaS deployment | Out of scope |
| W-03 | Outbound DLP filtering | Out of scope |
| W-04 | Mobile client or full webmail UI | Not needed for demo |
| W-05 | Real-time foundation model fine-tuning at scale | Compute and time constraints |

---

## Traceability

Each Must/Should item should be referenced in:
- The matching milestone deliverable
- A test case in the [Test Plan](test-plan.md)
- A dashboard / [Notion task entry](https://www.notion.so/361ee3d2d2cf811890e3c6ea307645f3)
