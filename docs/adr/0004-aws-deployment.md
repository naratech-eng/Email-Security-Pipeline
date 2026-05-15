# ADR-0004: AWS deployment topology

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

We need a deployment that is reproducible, cost-aware, and secure enough for a public capstone demo. The system has three main runtime parts: the dashboard (web), the inference API (containerized Python), and the mail server (system services).

## Decision

Deploy on AWS in a single account, single region (`us-east-1` default), with the following topology:

- **Amplify Hosting** for the React dashboard, connected to the GitHub repo, branch-based environments.
- **ECS Fargate** behind an **Application Load Balancer** for the FastAPI service.
- **EC2** (Rocky Linux 9) in a public subnet for Postfix + Dovecot, with an Elastic IP.
- **RDS for PostgreSQL** in a private subnet, single-AZ to start.
- **S3** for datasets, model artifacts, and Terraform state.
- **ECR** for container images.
- **Cognito User Pool** for dashboard auth.
- **WAF** in front of the public ALB.
- **VPC** with public + private subnets across 2 AZs, NAT gateway for egress.
- **CloudWatch** for logs/metrics, **CloudTrail** for audit.

The two clients (dashboard and milter) call the same FastAPI service. Internal traffic from EC2 to ECS goes through an internal ALB.

## Why these choices

- **Fargate** keeps ops minimal and scales naturally with the dashboard's traffic.
- **EC2 for the mail server** is necessary because Postfix needs port 25 and persistent state. Containerizing Postfix is possible but adds complexity for no capstone benefit.
- **RDS over self-hosted Postgres** removes maintenance burden.
- **Single account + single region** keeps the surface small, fits the team size, and is cheaper.
- **Amplify** removes the need to maintain CloudFront + S3 + CI for the static site.

## Consequences

- We must request port 25 limit removal from AWS if we ever need outbound SMTP at volume.
- One NAT gateway is the most expensive idle resource; we accept this cost or schedule `destroy` outside demo windows.
- Anything not in Terraform is considered a bug.
