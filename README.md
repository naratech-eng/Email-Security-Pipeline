# Email Security Pipeline

> AI-powered phishing email and malicious URL classifier, running end-to-end on AWS.
> Two ways to score mail — an analyst dashboard and a live Postfix/Dovecot mail server — sharing one FastAPI inference service, with every piece provisioned by Terraform.

[![Terraform Apply](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/terraform-apply.yml/badge.svg)](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/terraform-apply.yml)
[![Backend Tests](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/backend-tests.yml)
[![SAST + Dependency Scan](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/sast.yml/badge.svg)](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/sast.yml)
[![DAST Nightly](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/dast-nightly.yml/badge.svg)](https://github.com/naratech-eng/Email-Security-Pipeline/actions/workflows/dast-nightly.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=naratech-eng_Email-Security-Pipeline&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=naratech-eng_Email-Security-Pipeline)

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.9-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Terraform](https://img.shields.io/badge/Terraform-1.10-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20RDS%20%7C%20Amplify-232F3E?logo=amazonwebservices&logoColor=white)](https://aws.amazon.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ECS%20Fargate-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## The problem

Phishing is still the most common entry point for serious security incidents. Most detection lives inside a mail provider you don't control, gives no explanation for its verdicts, and offers an analyst no way to interrogate a suspicious message after the fact.

This project builds the whole path instead — ingestion, feature extraction, classification, storage, and an analyst UI — so a verdict can be traced from raw `.eml` to the specific signals that produced it.

## What it does

| | |
|---|---|
| **Upload & detect** | Paste or upload an email in the dashboard, get a verdict, likelihood score, and a per-feature breakdown of why. |
| **Live mail scoring** | A self-hosted Postfix + Dovecot server on Rocky Linux 9 scores every inbound message through a Postfix `content_filter` before delivery. |
| **Shared inference** | Both paths hit the same FastAPI service on ECS Fargate — one model, one code path, no drift between demo and production behaviour. |
| **Detection history** | Every verdict is persisted to RDS PostgreSQL with its provenance, queryable from the dashboard. |

## Architecture

![Architecture](docs/images/proposal-architecture.png)

Two ingestion paths converge on a single inference service:

```
Analyst  ──►  Amplify (React SPA)  ──►  Public ALB  ──┐
                                                      ├──►  ECS Fargate (FastAPI)  ──►  RDS PostgreSQL
Internet ──►  EC2 Postfix/Dovecot  ──►  Internal ALB ─┘              │
              (content_filter)                                       └──►  S3 (model artifacts)
```

Design decisions worth calling out:

- **The mail server is EC2, not a container.** Postfix needs port 25 and persistent state; containerising it adds complexity for no practical gain. ([ADR-0004](docs/adr/0004-aws-deployment.md))
- **Outbound mail relays through SES.** AWS blocks outbound TCP/25 from EC2, and a fresh domain has no sending reputation — SES owns the IP reputation and DKIM-signs on the way out. ([`ses_relay`](infra/modules/ses_relay/main.tf))
- **No NAT gateway.** Five VPC interface endpoints cover ECR, Secrets Manager, CloudWatch Logs and Cognito at roughly NAT's price without the single point of egress.
- **The mail filter fails open.** A DNS hiccup or a scoring timeout must never bounce legitimate mail — persistence is a record-keeping nice-to-have, not a reason to fail the request the caller is waiting on.

Full detail in [Architecture](docs/architecture.md) and [Infrastructure](docs/infrastructure-terraform.md).

## Machine learning

Two independent tracks, selected after a comparison harness run across candidate models:

| Track | Model | F1 | Notes |
|---|---|---|---|
| Email | LinearSVC over TF-IDF + engineered features | ≈ 0.99 | Chosen for accuracy at near-zero inference cost |
| URL | Character-level CNN | ≈ 0.97 | Learns lexical patterns without hand-crafted rules |
| URL (fallback) | Random Forest | — | CPU-only path when the CNN is unavailable |

Feature engineering covers urgency signals, link counts, sender/reply-to mismatch, attachment shape, and authentication results (SPF/DKIM/DMARC) computed on the mail server itself — so a live message carries the same features the training corpus did.

See [Model Selection](docs/machine-learning.md) and [Model Comparison](docs/m5-t5-model-comparison.md).

## DevSecOps

Security controls run on every pull request rather than as an end-of-project audit:

| Stage | Controls |
|---|---|
| **Pre-commit** | gitleaks (blocks secrets before a commit exists), private-key detection, Terraform fmt |
| **SAST** | Semgrep, Bandit, CodeQL, SonarCloud quality gate |
| **Dependencies** | pip-audit, npm audit, Dependabot, Trivy image scanning |
| **IaC** | `terraform validate`, tfsec, Checkov (HIGH severity blocking) |
| **DAST** | ZAP active scan, Schemathesis API fuzzing, testssl.sh against ALB and mail server, swaks relay/spoof-rejection tests |
| **Runtime** | WAF on the public ALB, CloudTrail, AWS Config, GuardDuty-style alarming via SNS |

Promotion to the protected branch is gated on a clean nightly DAST run. Trade-offs that were accepted rather than solved are written down in [Security Decisions](docs/security-decisions.md) — including the ones that are still open.

See [DevSecOps](docs/devsecops.md) and [Threat Model](docs/threat-model.md).

## Tech stack

**Backend** FastAPI · Python 3.13 · scikit-learn · psycopg 3 · Alembic
**Frontend** React 19 · Vite 8 · Tailwind · AWS Amplify Hosting
**Data** PostgreSQL 16 (RDS) · S3 (datasets, models, logs)
**Infra** Terraform 1.10 · ECS Fargate · ALB · Cognito · Route53 · ACM · KMS · Secrets Manager
**Mail** Postfix · Dovecot · OpenDKIM · OpenDMARC · policyd-spf · Amazon SES
**CI/CD** GitHub Actions with OIDC (no long-lived AWS keys)

## Repository structure

```
├── backend/            FastAPI inference service
│   ├── main.py           API routes, auth, prediction endpoints
│   ├── inference.py      Model loading and scoring
│   ├── db.py             Detections persistence (fails open by design)
│   ├── mime_parser.py    .eml parsing and feature extraction
│   └── migrations/       Alembic schema migrations
├── frontend/           React SPA (analyst dashboard)
├── infra/
│   ├── envs/dev/         Root module for the dev environment
│   ├── modules/          16 modules: network, ecs_service, rds_postgres,
│   │                     ec2_mailserver, ses_relay, cognito, waf,
│   │                     security_baseline, github_oidc, …
│   └── bootstrap/        Remote state bucket + lock
├── notebooks/          Data cleaning, feature engineering, model selection
├── models/             Trained artifacts (LinearSVC, char-CNN, vocab)
├── docs/               Architecture, ADRs, threat model, runbooks
└── .github/workflows/  12 CI/CD and security workflows
```

## Documentation

**Product** — [PRD](docs/prd.md) · [MoSCoW Requirements](docs/requirements-moscow.md) · [Roadmap](docs/roadmap.md)

**Engineering** — [Architecture](docs/architecture.md) · [Infrastructure](docs/infrastructure-terraform.md) · [Test Plan](docs/test-plan.md) · [Destroy/Rebuild Runbook](docs/runbook-destroy-rebuild.md)

**Security** — [DevSecOps](docs/devsecops.md) · [Threat Model](docs/threat-model.md) · [Security Decisions](docs/security-decisions.md) · [Data Retention & Privacy](docs/data-retention-privacy.md)

**Machine Learning** — [Model Selection](docs/machine-learning.md) · [Model Comparison](docs/m5-t5-model-comparison.md) · [Deep-Learning Track](docs/m5-t7-t8-deep-learning.md) · [Feature Matrix](docs/data/feature-matrix.md)

**Decisions** — [ADR-0001 Record decisions](docs/adr/0001-record-architecture-decisions.md) · [ADR-0002 Stack](docs/adr/0002-stack-choices.md) · [ADR-0003 Models](docs/adr/0003-model-strategy.md) · [ADR-0004 AWS](docs/adr/0004-aws-deployment.md) · [ADR-0005 DevSecOps](docs/adr/0005-devsecops-pipeline.md)

## Contributing

### Setup

```bash
git clone https://github.com/naratech-eng/Email-Security-Pipeline.git
cd Email-Security-Pipeline
pip install pre-commit && pre-commit install
```

**Installing the hooks is not optional.** gitleaks runs before a commit is created — it is the only control that *prevents* a secret from reaching this public repository rather than reporting it afterwards. A credential pushed to a public repo must be treated as compromised and rotated, even if the commit is later removed.

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

### Branching

```
feature/* or dev-<name>  ──►  dev  ──►  naratech
```

- `dev` is the integration branch. **Open pull requests against `dev`.**
- `naratech` is protected and reached only by promoting `dev` — never by targeting it directly.
- Merging to `dev` auto-applies Terraform to the dev environment, so infra changes land live on merge.

### Before you open a PR

- Run `terraform fmt -recursive` if you touched `infra/`
- Terraform plans run from the `dev` branch — planning from a stale branch that predates a module produces a destructive plan
- Add an [ADR](docs/adr/) for any decision that would be hard to reconstruct from the diff
- If you accept a trade-off rather than fixing it, record it in [Security Decisions](docs/security-decisions.md) so the gap reads as a decision, not an oversight

### Commit style

Conventional Commits — `fix(rds):`, `feat(api):`, `chore(ci):`. Explain *why* in the body; the diff already shows what.

## Status

Actively developed. The system runs on AWS with the dashboard, inference API, and mail server all live. Known trade-offs — including the CI role's broad permissions and compliance being treated as documentation rather than a build target — are tracked openly in [Security Decisions](docs/security-decisions.md).

## License

No license file is present yet, which under default copyright means all rights are reserved and others may not reuse this code. If you want it to be usable or forkable, add a `LICENSE` (MIT and Apache-2.0 are the usual choices).
