# ADR-0005: DevSecOps pipeline

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The capstone milestone guide highlights DevSecOps, application threat modeling, and risk management as expected outcomes. We must show those practices in our own SDLC, not just in the product features.

## Decision

Use **GitHub Actions** as the single pipeline tool, with security gates required for merging to `main`.

Pipeline stages:

1. **Static checks**
   - `ruff` lint and `black --check` for Python
   - `eslint` and `prettier --check` for the frontend
   - Markdown lint on `docs/`
2. **Unit tests**
   - `pytest` on backend
   - `vitest` on frontend
3. **Security scans (blocking on high severity)**
   - **tfsec** and **Checkov** on Terraform
   - **Trivy** on the built container image and on the repo filesystem
   - **pip-audit** on Python dependencies
   - **GitHub secret scanning** + **Dependabot** alerts
4. **Build**
   - Build FastAPI container, tag with commit SHA, push to ECR
5. **Plan (PR only)**
   - `terraform plan` against the dev workspace, posted as a PR comment
6. **Apply (main only)**
   - `terraform apply` against dev/prod workspaces using OIDC-issued AWS credentials
   - ECS deploy via the new image tag
   - Amplify auto-deploys from the same merge

OIDC: GitHub Actions assumes an AWS IAM role via OIDC, no static AWS keys in the repo.

## Why these choices

- One tool keeps configuration in one place.
- Free for public repos.
- OIDC + IAM role is the modern, secret-less way to deploy to AWS from CI.
- All gates are open source.

## Consequences

- Every pull request takes longer because of the scan stage; this is acceptable for safety.
- We must maintain ignore lists for known/accepted findings (tracked as ADRs or repo-level `.checkov.yml` / `.tfsec` configs).
- Failing a security gate blocks merges. The team needs a triage process for high-severity findings.
