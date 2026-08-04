# M7-T1 — FastAPI Inference Service

**Milestone:** M7 — Integration with Email Server (Phase A)
**Endpoints:** `/predict/email`, `/predict/url`, `/health`
**MoSCoW:** Must M-07 · Depends on: M6-T6 (inference wrapper), M6-T7 (artifact registry)
**Status:** Not started

> **As built (superseded design):** this doc's original plan was for the mail
> filter and dashboard to call `/predict/email` and `/predict/url` directly.
> What actually shipped is a single combined endpoint, `POST /analyze/email`
> ([`backend/main.py`](../backend/main.py)) — it parses the raw/pasted email,
> scores the body text, extracts every URL from the body and scores each one
> in-process (no separate HTTP call), then returns one merged verdict and
> persists one detection row. Both the milter
> ([`phishing_filter.py`](../infra/modules/ec2_mailserver/files/phishing_filter.py))
> and the frontend ([`api.ts`](../frontend/src/lib/api.ts)) only ever call
> `/analyze/email`. `/predict/email` and `/predict/url` still exist in the API
> (still auth-gated) but have no real caller — they're leftover single-model
> endpoints from this earlier design, not part of the live flow. The auth
> model below (§4) *is* accurate for what shipped — see `require_auth` in
> `backend/main.py`.

---

## 1. Objective

Wrap the trained M6 classifiers in a FastAPI service so the operator dashboard (M7-T12, upload mode) and the mail server's `content_filter` (M7-T9, server mode) can both call one HTTP API and get back a verdict. This is the "one backend" half of the architecture's "two clients, one backend" design — everything downstream (dashboard, mail integration, M8 tuning) is blocked on this existing and working.

---

## 2. ⚠️ Fix first — model artifacts aren't reachable from where this service will actually run

The existing inference wrapper (`notebooks/M6/m6_inference.py`) will **not work as-is** inside ECS. Verified directly against the live AWS account before writing this doc:

| What the code does | What's actually true |
|---|---|
| `S3_BASE = 's3://email-security-pipeline-datasets/models/artifacts'` | This bucket is in a **different, unrelated AWS account** (`091957636975`, from the old M2 setup) |
| `_s3_download()` calls `aws s3 cp ... --profile lab-user` | `lab-user` is a **local CLI profile** — it doesn't exist inside an ECS container, which authenticates via its task IAM role automatically |
| ECS task role (`esp-ecs-task-role`, already provisioned) grants `s3:GetObject`/`s3:ListBucket` on | `arn:aws:s3:::esp-models-us-east-1-802531654188` only — a **different bucket, different account** than what the code points at |
| Current contents of `esp-models-us-east-1-802531654188` | **Empty.** Checked directly — zero objects. |

So before `/predict/*` can return anything, this task includes:

1. Upload `email_linearsvc.joblib`, `url_charcnn.keras`, `url_char_vocab.json`, `url_rf.joblib`, and `registry.json` to `s3://esp-models-us-east-1-802531654188/models/artifacts/...` (mirroring the existing key structure documented in `docs/m6-artifact-registry.md`).
2. Update `S3_BASE` in the wrapper to `s3://esp-models-us-east-1-802531654188/models/artifacts`.
3. Replace the `subprocess`-shelling-to-CLI-with-`--profile` download with a plain `boto3.client('s3').download_file(...)` call — this picks up the ECS task role automatically, no profile needed, and works identically for local dev (using whatever profile you `export AWS_PROFILE=...` yourself) and in the container.

---

## 3. The interface you're building on top of (M6-T6, already done)

`notebooks/M6/m6_inference.py` exposes two functions — call these directly from the FastAPI route handlers, don't reimplement scoring logic:

```python
predict_email(text_clean: str, urgency_score=0.0, link_count=0,
              html_ratio=0.0, word_count=0, avg_word_length=0.0) -> dict
# returns {"label": 0|1, "confidence": float, "model": "email_linearsvc"}

predict_url(url: str) -> dict
# returns {"label": 0|1, "confidence": float, "model": "url_charcnn" | "url_rf"}
```

Both use module-level singletons — artifacts load once per process on first call, not per-request. `predict_url` auto-falls-back from Char-CNN to Random Forest if TensorFlow isn't available in the container (a real option worth considering for image size — RF-only is the CPU-fallback path already validated at F1 0.866, meeting the PRD's ≥0.85 target on its own).

---

## 4. Endpoints to build

| Route | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/health` | GET | none | — | `{"status": "ok"}` — liveness probe for the ALB target group (already configured to hit this path every 30s) |
| `/predict/email` | POST | Cognito JWT (dashboard) or signed token (milter) | `{"text": str, "urgency_score"?: float, "link_count"?: int, "html_ratio"?: float, "word_count"?: int, "avg_word_length"?: float}` | `{"verdict": "clean"\|"flag"\|"quarantine", "score": float, "model": str}` |
| `/predict/url` | POST | same | `{"url": str}` | `{"verdict": "clean"\|"flag"\|"quarantine", "score": float, "model": str}` |

The `label`/`confidence` fields from `m6_inference.py` map to `verdict`/`score` — thresholding `confidence` into the three-way `clean`/`flag`/`quarantine` verdict is an M7-T1 decision (a simple two-threshold split is enough for now; M8 owns the real tuning pass against the false-positive target).

Auth is listed for completeness — full Cognito/signed-token enforcement is M7-T14/M9 scope. It's fine for `/health` to stay open and for `/predict/*` to start unauthenticated in local dev, but don't wire the ALB/ECS deploy to the public internet without at least a placeholder auth check, given the fail-open design elsewhere in this system assumes the *mail path* fails open, not that the API is unauthenticated by accident.

---

## 5. How this plugs into infrastructure that already exists

- **Container port:** `8000` (already set in the ECS task definition and both target group configs — don't change it without updating `infra/modules/ecs_service/main.tf` and `infra/modules/alb/main.tf` to match)
- **Health check path:** `/health` (already configured on both target groups)
- **Secrets, injected automatically at container startup** (no code needed to fetch them — they arrive as env vars):
  - `DB_CREDENTIALS_JSON` — JSON string: `{"username", "password", "host", "port", "dbname"}`
  - `JWT_SIGNING_KEY` — raw string
  - `ENV` — `"dev"`
- **Model artifacts:** read via the ECS task role, scoped to `esp-models-us-east-1-802531654188` only (see §2)
- **Current deploy state:** the ECS service (`esp-api` on cluster `esp-cluster`) is live right now, running the placeholder `public.ecr.aws/nginx/nginx:latest` image. Once you have a working image, M7-T7 (Michael) handles the Dockerfile/ECR push/redeploy — you don't need to touch Terraform for this task, just get the FastAPI app itself working locally (`uvicorn main:app --port 8000`) and handed off.

---

## 6. Acceptance criteria

- `GET /health` returns 200 locally and once deployed, the ALB target group shows healthy
- `POST /predict/email` and `/predict/url` return a verdict for both a known-benign and known-phishing sample (use held-out test rows from the M4-T7 frozen splits, not training data)
- Model loading works via `boto3` with no hardcoded local CLI profile
- Artifacts are being read from `esp-models-us-east-1-802531654188`, not the old M2 bucket
- p95 latency locally is comfortably under the PRD's 1s (upload) / 2s (server) targets — full latency validation under load is M8, but this task shouldn't be visibly slow in manual testing

---

## 7. AWS IAM access for whoever picks this up

No per-task policy needed here anymore. The existing team IAM users (`khaxhiaj`, `mchea3`, `jgkalluri`) each have the `PowerUserAccess` managed policy attached directly, which covers everything this task touches (S3 model/dataset buckets, Secrets Manager, ECR, ECS, CloudWatch) and more. Whoever on the team picks up M7-T1 can use their existing credentials as-is — no new user, policy, or access key to provision.
