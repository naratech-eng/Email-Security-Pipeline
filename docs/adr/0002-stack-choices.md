# ADR-0002: Stack choices

- **Status:** Accepted (revised 2026-05-15 for AWS deployment)
- **Date:** 2026-05-15

## Context

The brief calls for an open-source email server, ML pipeline, inference API, and an operator dashboard. We are deploying on AWS with Terraform and adopting DevSecOps practices, and we want a dashboard-first MVP path before integrating with Postfix.

## Decision

| Layer | Choice | Reason |
|---|---|---|
| Cloud | AWS | Required by team direction; broadest service catalog |
| Frontend hosting | AWS Amplify Hosting | Git-based deploys, branch envs, free TLS, easy Cognito integration |
| Frontend framework | React + Vite + Tailwind | Lightweight, fast cold start, fits a small team |
| Auth | Amazon Cognito (User Pool) | Native to Amplify, JWT we can validate at the API |
| Backend runtime | ECS Fargate | No servers to manage, easy autoscale, fits a single container API |
| Backend framework | FastAPI + Uvicorn (Python 3.11+) | Async, typed, large ML ecosystem |
| Container registry | Amazon ECR | Native, image scanning included |
| Mail server OS | Rocky Linux 9 (EC2) | RHEL-compatible CentOS successor, official AWS AMI, drop-in for the brief |
| MTA | Postfix | Required tool family, well-documented `content_filter` mechanism |
| IMAP | Dovecot | Standard companion to Postfix |
| Database | Amazon RDS for PostgreSQL | Managed, encrypted, easy backups |
| Object storage | Amazon S3 | Datasets, model artifacts, Terraform state |
| Secrets | AWS Secrets Manager + SSM Parameter Store | Native, IAM-bound |
| Networking | VPC, ALB, WAF, CloudFront (optional) | Standard AWS web tier |
| ML | scikit-learn (baseline), PyTorch + Hugging Face DistilBERT (stretch) | Fast iteration first, neural only if needed |
| IaC | Terraform | Mature, multi-cloud-friendly, great AWS coverage |
| CI/CD | GitHub Actions | Free for public repos, OIDC to AWS, no extra service |
| Security scanning | tfsec, Checkov, Trivy, pip-audit, Dependabot, GitHub secret scanning | Layered DevSecOps gates |
| Observability | CloudWatch Logs/Metrics/Alarms, X-Ray (optional) | Native, no extra agent |
| Audit | CloudTrail, AWS Config | Required for any serious deployment |
| Docs | GitBook from `/docs/` | Polished doc site, syncs from GitHub |
| Project mgmt | Notion + GitHub Issues | Notion for narrative + dashboards, GitHub for code-linked work |

## Alternatives considered

- **Lambda instead of ECS:** rejected for ML inference because cold-start time and memory limits hurt model loading. ECS Fargate is a better fit.
- **Amplify-managed backend (AppSync / API Gateway + Lambda):** would couple us tightly to Amplify and complicate model packaging.
- **EKS:** overkill for a single service.
- **Amazon Linux 2023:** great option, but Rocky stays closer to the CentOS expectation in the brief.

## Consequences

- All choices are open source or commodity AWS services.
- Switching from SQLite to RDS upfront removes a later migration step.
- We accept moderate AWS spend; we offset with budget alarms and `terraform destroy` outside demo windows.
