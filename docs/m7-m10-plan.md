# M7–M10 Delivery Plan

Plan for the remaining milestones, mapped to the [PRD](prd.md) goals and [MoSCoW](requirements-moscow.md) requirements. M6 is complete: models are trained, validated against PRD §6, serialized, and registered in S3 (`registry.json` + `m6_inference.py`).

**Guiding decision:** the models already exceed all PRD §6 targets, so **M8 is not an ML-retraining milestone** — it is reframed as system tuning + measurement + tests, with one *optional* light ML pass held in reserve for the demo.

## Team & roles

| Member | Role | Focus |
|---|---|---|
| Sanjeewa Narayana | ML Lead / ML Engineer | Inference API, packaging, thresholds, demo |
| Michael Chea | ML Engineer | Extraction, deploy, test suite, CI/CD |
| John Graham Kalluri | Frontend & Security | Dashboard, upload tool, auth, threat model |
| Klara Haxhiaj | Infrastructure | Mail server, RDS, AWS security controls |
| Isaiah Campbell | Research & Data | Testing, measurement, reports |

---

## M7 — Integration with Email Server (Weeks 5–6)

**Goal:** an incoming phishing email is automatically flagged/quarantined, and an operator can upload an email to get a live verdict.
**MoSCoW:** Must M-07, M-08, M-09, M-10 · Should S-01, S-03, S-04, S-07.

### Backend / inference (Sanjeewa, Michael)
- **M7-T1** FastAPI service — `/predict/email`, `/predict/url`, `/health` (Sanjeewa)
- **M7-T2** Containerize service, CPU-only (Sanjeewa)
- **M7-T3** MIME parsing + URL/body extraction → combined verdict (Michael)
- **M7-T7** Push image to **ECR** + deploy to **ECS Fargate** behind **ALB** via Terraform (Michael) — *M-07*
- **M7-T9** content_filter client script (POSTs JSON to API/ALB) (Sanjeewa)
- **M7-T16** Fail-open / circuit-breaker so mail flow never blocks (Sanjeewa) — *S-07*

### Mail integration & storage (Klara)
- **M7-T4** Postfix milter / content_filter hook (inbound mail → API)
- **M7-T5** Quarantine / flagging logic (header tag + quarantine mailbox)
- **M7-T15** RDS Postgres detections store + **schema & Alembic migrations (CI)**, `source = upload | server` — *S-03*

### Dashboard (John) — *M-08, M-10*
- **M7-T10** Design dashboard wireframe
- **M7-T11** Scaffold React + Vite + Tailwind **+ Amplify CI/CD** (auto build + PR previews)
- **M7-T12** Upload tool — paste/upload email → live verdict
- **M7-T13** Detections list (upload + server modes, score + metadata)
- **M7-T14** Cognito sign-in (auth hardened further in M9)

### Verify & document (Isaiah)
- **M7-T6** End-to-end test on staging VM (phishing + benign)
- **M7-T8** M7 integration documentation + report

---

## M8 — System Tuning & Test (Weeks 6–7) — *reframed, no retraining*

**Goal:** improve false-positive / false-negative behaviour vs the M6 baseline through configuration and measurement, and lock in automated tests.
**MoSCoW:** Must M-11 · Should S-04, S-05.

- **M8-T1** Tune & wire flag-vs-quarantine thresholds using M6-T9/T10 (e.g. URL CNN → 0.45 to cut FN); thresholds configurable, not hard-coded (Sanjeewa) — *S-04, M-11*
- **M8-T2** Measure FP rate on a clean corpus (target < 2%) + latency (< 1s upload p95, < 2s server); write the M8 "updated metrics + changes" deliverable (Isaiah) — *M-11*
- **M8-T3** Automated test suite for preprocessing + inference, wired into CI (Michael) — *S-05*
- **M8-T4** *(Optional)* Light ML pass — class-weight / threshold sweep on existing models if the demo needs lower FP; **no full retraining**; skip if T1+T2 already meet targets (Sanjeewa)

---

## M9 — Security & Compliance (Weeks 7–8)

**Goal:** all Must security controls implemented and documented.
**MoSCoW:** Must M-12, M-13 · Should S-06, S-08, S-09, S-10, S-11.

- **M9-T1** Cognito-protected dashboard + signed-token/mTLS auth between milter and API (John) — *M-12*
- **M9-T2** Mail hardening: restricted relay, SPF/DKIM/DMARC in path, least-privilege SGs (Klara) — *M-13*
- **M9-T3** STRIDE threat model (`docs/threat-model.md`), Must controls traced to tasks (John) — *S-06*
- **M9-T4** AWS controls: CloudWatch alarms, WAF on ALB, Secrets Manager, S3 public-block + encryption (Klara) — *S-08/S-09/S-10/S-11*

---

## M10 — Deployment & Evaluation (Weeks 8–9)

**Goal:** full demo on AWS with captured metrics; final report + presentation.
**MoSCoW:** Must M-15, M-16.

- **M10-T1** Full end-to-end demo on AWS (server flag/quarantine + dashboard upload), metrics captured (Sanjeewa) — *M-15*
- **M10-T2** Final report aligned with milestone-guide deliverables (Isaiah) — *M-16*
- **M10-T3** Final presentation + demo deck (John) — *M-16*
- **M10-T4** Reproducibility: `terraform apply` from scratch + `destroy` teardown for cost control (Klara) — *G6*

---

## Cross-cutting (ongoing) — *M-14 + AppSec*

- **CROSS-CI** GitHub Actions CI/CD: lint, test, Trivy (container), tfsec + Checkov (Terraform), pip-audit — required to merge to `main` (Michael)
- **SEC-SAST** Application-code SAST: Bandit, Semgrep, CodeQL, gitleaks, eslint-security — shift-left, merge-blocking, SARIF to GitHub Security (Michael) — *DevSecOps §3.2*
- **SEC-DAST** Dynamic scanning: OWASP ZAP + Schemathesis vs deployed API + dashboard; HIGH blocks promotion to `naratech` (John, in M9) — *DevSecOps §3.3*

> Full tooling, pipeline placement, and gating in [devsecops.md §3.2–3.4](devsecops.md).

---

## Critical path

```
M6 artifacts ─► M7-T1 API ─► M7-T2 container ─► M7-T7 ECS deploy
                   │                                  │
                   ├─► M7-T3 extraction ──────────────┤
                   ├─► M7-T9 filter script ─► M7-T4 Postfix hook ─► M7-T5 quarantine
                   └─► M7-T11 scaffold ─► M7-T12 upload ─► M7-T13 list
                                              │
   M7-T15 RDS store ◄──────────────────────────┘
        │
        ▼
   M7-T6 E2E test ─► M8 tuning ─► M9 security ─► M10 demo + report
```
