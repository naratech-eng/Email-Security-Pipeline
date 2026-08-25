# Data Retention & Privacy Policy (M9-T7)

**Milestone:** M9 — Security & Compliance
**Status:** Implemented — policy defined, technical control live (`retention_purge.py` + scheduled ECS task)

---

## 1. What's actually stored

Verified directly against the schema (`backend/migrations/versions/28d446b7b47d_create_detections_table.py`) and the code that populates it (`backend/main.py`, `backend/mime_parser.py`), not assumed:

| Data | Stored? | Where |
|---|---|---|
| Raw email body text | **No** — deliberate design decision at the migration level | never persisted |
| Attachment content | **No** | never persisted (only `attachment_count`, a number) |
| Subject line | Yes | `detections.subject` |
| From/To addresses | Yes | `detections.from_addr` / `to_addr` |
| Extracted URLs + per-URL verdict/score | Yes | `detections.urls` (JSONB) |
| Email numeric features (urgency score, link count, HTML ratio, word count, avg word length) | Yes — 5 numbers, no text | `detections.email_features` (JSONB) — confirmed by reading `mime_parser.body_features()`, which computes only counts/ratios, never stores a text excerpt |
| Verdict, likelihood, summary, remediation text | Yes | `detections.*` |
| Submitter identity (Cognito `sub`/username, or `source=server` for mail-path) | Yes | `detections.submitted_by`, `submitted_by_sub` |

**Correction to an earlier draft of `docs/threat-model.md`:** that doc previously stated detection logs "retain full email content indefinitely." That overstated the actual exposure — verified against the schema and feature-extraction code above, the body text itself was never stored in the first place. The real gap (addressed by this document) was the *absence of a retention period* for what genuinely is stored: subject lines, sender/recipient addresses, and derived metadata — themselves personal/identifying data, just not full message content.

## 2. Retention decision

**180 days.** Rationale:
- Long enough to support the dashboard's trend/history views and any post-incident review of a flagged sender.
- Short enough that indefinite accumulation of subject lines + addresses (personal data under most definitions, including GDPR's) doesn't become an open-ended liability with no operational purpose past a few months.
- Matches this being a lab deployment handling no regulated real-user data (§4) — a production deployment handling real mail would need a documented business/legal justification for whatever period is chosen, not just "180 felt reasonable."

Configurable via `retention_days` on the `ecs_service` Terraform module (default 180) — not hardcoded, so a real deployment can tune it without a code change.

## 3. Technical control

A scheduled ECS Fargate task (`aws_scheduler_schedule.retention_purge`, `infra/modules/ecs_service/main.tf`) runs daily at 07:00 UTC, executing `backend/retention_purge.py` against the RDS `detections` table:

```sql
DELETE FROM detections WHERE created_at < now() - (%(days)s || ' days')::interval
```

Design notes:
- Reuses the API's own container image (no separate build/ECR pipeline) with the entrypoint overridden to the purge script instead of `uvicorn`, but runs as its **own task definition** (`aws_ecs_task_definition.retention_purge`) — not a per-run `RunTask` override — because ECS `RunTask` overrides don't support routing to a different `logConfiguration`, and a dedicated log group (`/ecs/esp/retention-purge`) matters for finding this job's output without wading through API request logs.
- **Fails loudly**, unlike the rest of this codebase's fail-open convention: `backend/db.py`'s live-request paths fail open because a real caller is waiting on a response and a persistence hiccup shouldn't block scoring. Nobody is waiting on a scheduled maintenance job, so a non-zero exit (visible as a FAILED ECS task + a CloudWatch Logs entry) is the right failure mode — a silent failure here would just mean retention quietly stops happening with nobody the wiser.
- Runs in the private subnets, same security group as the API — no new network exposure.
- Reuses the API's task role rather than a minimal purpose-built one (documented simplification in the Terraform comment) — acceptable for a scheduled job with no internet exposure and no untrusted input, not a real credential-exfiltration path, but a genuine least-privilege deployment would scope this tighter.

## 4. Legal/compliance posture (current scope)

Per `docs/threat-model.md` §5:
- This system does not process regulated personal data of real users. Datasets are public, used for academic purposes.
- A production deployment handling real user mail would need to address GDPR (EU), PIPEDA (Canada), and any sector-specific email-handling rules **before** processing real mail — specifically:
  - A documented legal basis for retaining subject lines/sender addresses (legitimate interest — fraud/security detection — is the likely basis, but that requires its own assessment, not assumed here).
  - A data subject access/deletion request process (a user asking "delete everything about my email address" isn't served by a time-based retention job alone).
  - Breach notification procedures if the `detections` table were ever exposed.
- None of the above is implemented — this document scopes what a real deployment would need, it doesn't claim to have built it. The 180-day purge is the one concrete control that exists today.

## 5. What this does NOT cover

- **Mailbox content itself** (the actual Maildir on the mail server, IMAP-accessible mail) has no retention policy at all — this document only covers the `detections` table. A real deployment would need one.
- **CloudTrail/Config/WAF logs** (M9-T4) have their own lifecycle (90-day Standard-IA transition, 180-day Glacier transition, `infra/modules/security_baseline`) — unrelated to this policy, not duplicated here.
- **Backups**: RDS automated backups (1-day retention — the free-tier maximum; `infra/modules/rds_postgres/main.tf` carries a note to raise it to 7 on a paid account) will contain purged rows until they age out of the backup window — a full data-subject deletion isn't complete until backups age out too. Not addressed by this task.
