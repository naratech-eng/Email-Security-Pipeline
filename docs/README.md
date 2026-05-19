# Email Security Pipeline

> AI-powered phishing email and malicious URL classifier on AWS. Two ways to score email: an upload-and-detect dashboard, and a Postfix + Dovecot mail server on Rocky Linux 9 (EC2). One backend on ECS Fargate, all infrastructure in Terraform.

## What this project is

Phishing remains one of the most common entry points for serious security incidents. This capstone delivers an end-to-end system that:

1. Lets a security operator **upload or paste an email** in a web dashboard and immediately see a phishing verdict, score, and feature breakdown.
2. Receives real mail through a self-hosted **Postfix + Dovecot** stack on **Rocky Linux 9 (EC2)** and scores every message before delivery.
3. Shares one **FastAPI inference service** (deployed to **ECS Fargate**) between both modes.
4. Runs entirely on **AWS**, provisioned with **Terraform**, with **DevSecOps** controls baked into every pull request.

## Documentation map

### Product
- [Product Requirements (PRD)](prd.md)
- [MoSCoW Requirements](requirements-moscow.md)
- [Roadmap](roadmap.md)

### Engineering
- [Architecture](architecture.md)
- [Infrastructure (Terraform)](infrastructure-terraform.md)
- [DevSecOps](devsecops.md)
- [Threat Model](threat-model.md)
- [Test Plan](test-plan.md)

### Decisions
- [Architecture Decision Records](adr/0001-record-architecture-decisions.md)

## Repository

[github.com/naratech-eng/Email-Security-Pipeline](https://github.com/naratech-eng/Email-Security-Pipeline)

## Project Management

- [Notion workspace](https://www.notion.so/361ee3d2d2cf811890e3c6ea307645f3)

## Course context

CYT300 Capstone — deliverables are split into 10 milestones across a Research phase and a Deployment phase. See the [Roadmap](roadmap.md) for the milestone-to-week mapping.


KLaras content.