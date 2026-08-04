# Security Decisions & Compliance — M9-T6

**Purpose:** a single index of every significant security decision made in this project, with the reasoning and where to find the full detail. This is deliberately a *pointer* document, not a duplicate — `docs/threat-model.md`, `docs/devsecops.md`, and `docs/data-retention-privacy.md` already carry the full rationale for most of these; repeating it here would just be one more place for it to go stale. Read this first to know *what* was decided and *why*, then follow the link for the *how*.

**Milestone:** M9 — Security & Compliance (PRD S-06 and neighbors). **Status:** current as of 2026-08-04.

---

## 1. Authentication & Access Control

| Decision | Why | Detail |
|---|---|---|
| Two auth paths on the inference API: static signed token (mail filter) or Cognito access token (dashboard) | The mail filter is a server-to-server caller with no human to log in; the dashboard has real analysts. One `require_auth` dependency handles both rather than two separate auth stacks | `backend/main.py` `require_auth`, M9-T1 |
| Static pre-shared key for milter→API, not mTLS or short-lived tokens | Accepted capstone-scope simplification. mTLS/short-lived tokens were the original `SEC-T1` framing; a long-lived key rotated via Secrets Manager was judged sufficient given the internal-ALB-only network path (not internet-reachable) | `docs/threat-model.md` §3 ("Unauthenticated calls to the inference API") |
| Detection row attribution comes from the verified caller identity, never a client-supplied field | A client-supplied `source`/`submitted_by` let any authenticated caller (or a fuzzer with a valid token) write into the wrong feed under any name — tightened after finding this during M7 | `backend/main.py` `derive_provenance`, M7-T13 |
| Dashboard requires Cognito login; no anonymous access to any protected route | Standard SPA auth gating (`RequireAuth`) | `frontend/src/auth/guards.tsx`, M9-T1 |

## 2. Network & Transport

| Decision | Why | Detail |
|---|---|---|
| Internal ALB (mail↔API) is VPC-private, plain HTTP; public ALB (dashboard/API) is TLS-only | TLS terminates once at the boundary that actually crosses a trust boundary (public internet); the internal path never leaves the VPC | `infra/modules/alb`, checkov-documented inline |
| Mail server: port 25 receive-only, no relay; port 587 authenticated-submission-only | Prevents this server becoming an open relay for spam | `docs/threat-model.md` §3, M9-T2, verified nightly by `mail-relay-test` (M9-T5) |
| Let's Encrypt real certificate on the mail server, not just self-signed | Self-signed certs silently break real mail clients (opaque "cannot connect" failures) — found and documented in `docs/m7-t4-t6-mail-filter-testing.md` §5 | M7-T17 |
| Inbound SPF/DKIM/DMARC validation added (`opendkim`/`opendmarc`/`policyd-spf`), soft-fail mode | Without it, the `has_spf`/`has_dkim` ML features were always 0 for live mail regardless of actual sender authentication — a real, quiet gap found while auditing M9. Soft-fail (never hard-rejects at SMTP time) matches the project's fail-open principle (S-07) | M9-T0 |
| WAF (managed rule sets) on the public ALB, currently COUNT mode not BLOCK | Same "observe before block" pattern as the ZAP passive baseline — a first deploy needs to be watched for false positives before it can reject real traffic | M9-T4, `infra/modules/waf` |

## 3. Secrets & Credentials

| Decision | Why | Detail |
|---|---|---|
| All runtime secrets (DB credentials, JWT signing key, SES SMTP creds) in Secrets Manager, injected as env vars at container/instance startup — never committed | Standard secrets hygiene | SEC-T3 |
| CI→AWS via GitHub OIDC + IAM role, no static AWS keys anywhere | No long-lived cloud credentials to leak from CI | `infra/modules/github_oidc`, `docs/devsecops.md` §5 |
| CI role has `AdministratorAccess`, not a scoped least-privilege policy | Explicit, acknowledged capstone-lab trade-off — CI needs to apply every module in a single lab account; the role is still OIDC-gated to this repo only. Flagged for tightening before any real deployment | `infra/modules/github_oidc/main.tf` (inline `#checkov:skip=CKV_AWS_274`) |
| GitHub native secret scanning (push protection) is the enforced gate; gitleaks (full git-history scan) is not yet implemented | Real, acknowledged gap versus the intended defense-in-depth — not glossed over | `docs/devsecops.md` §3.2 |

## 4. Data Handling & Privacy

| Decision | Why | Detail |
|---|---|---|
| Raw email body/attachment content is never persisted to the `detections` table — only subject, addresses, extracted URLs, and 5 numeric features | Deliberate privacy/storage decision made at the schema level, before M9 even started | `backend/migrations/versions/28d446b7b47d_...py`, verified against `mime_parser.body_features()` |
| 180-day retention on the `detections` table, enforced by a daily scheduled purge | Balances dashboard history/trend value against unbounded accumulation of personal data (subject lines, addresses) with no operational purpose past a few months | M9-T7, `docs/data-retention-privacy.md` |
| RDS encrypted at rest (KMS) and in transit, private-subnet + SG isolated, IAM DB auth | Standard data-at-rest/in-transit protection for the one table that holds anything sensitive | M7 infra |
| Compliance is treated as a documentation exercise for the capstone, not a build target | No regulated real-user data is processed; a real deployment would need actual GDPR/PIPEDA compliance work (legal basis review, subject access/deletion process, breach notification) that this project explicitly does not build | `docs/threat-model.md` §5, `docs/data-retention-privacy.md` §4 |

## 5. Monitoring & Detection

| Decision | Why | Detail |
|---|---|---|
| CloudTrail (multi-region) + AWS Config baseline + CloudWatch alarms (ALB 5xx/latency, RDS CPU/connections), all feeding one SNS topic | AWS-native, always-on observability with a single place to subscribe alerts | M9-T4 |
| **GuardDuty and Security Hub are NOT enabled — permanently, not pending** | Both 403 with `SubscriptionRequiredException` when called directly against this AWS account with `AdministratorAccess` credentials — an account-subscription block common on education/credit AWS accounts, reproduced outside CI/Terraform to rule out an IAM or code issue. No retry or code change fixes this; it needs a different account tier | M9-T4, `docs/devsecops.md` §6 |
| DAST (ZAP passive+active, Schemathesis fuzzing, testssl.sh, swaks mail tests) runs nightly and gates promotion to `naratech` on HIGH findings | Shift-right coverage against the live deployed system, not just static analysis | M9-T5, `docs/devsecops.md` §3.3 |
| Authenticated dashboard ZAP scan is manual (`workflow_dispatch`), not scheduled | Cognito access tokens are short-lived (~1hr) and a real user's password isn't going into CI as a stored secret — a dedicated service account was considered and rejected in favor of using a real logged-in session | M9-T5, `zap-dashboard-auth.yml` |

## 6. Known, Accepted Gaps (consolidated)

Everything below is a genuine gap — listed here once, in one place, rather than left scattered across individual docs where it's easy to lose track of what's actually still open going into a grading review:

| Gap | Why it's still open | Where tracked |
|---|---|---|
| GuardDuty / Security Hub disabled | Permanent AWS account-tier limitation, not fixable in this project | `docs/devsecops.md` §6 |
| WAF in COUNT mode, not blocking | Pending a baseline run confirming no false positives against real traffic | `infra/modules/waf` (`block_mode` var) |
| No rate-limiting on the public ALB/WAF | Not configured — a volumetric attack is bounded only by the 2MB body cap and normal AWS limits | `docs/threat-model.md` §6 |
| gitleaks / CodeQL / SonarCloud not implemented | Real gap versus the intended SAST defense-in-depth (§3.2) — Bandit/pip-audit/npm audit cover what exists today | `docs/devsecops.md` §3.2 |
| Mail server EC2 has no ongoing OS patch cadence | `package_update`/`package_upgrade` run once at boot; nothing re-patches afterward | `docs/threat-model.md` §4 |
| Retention policy covers only the `detections` table | Mailbox content on the mail server has no retention policy; purged rows persist in RDS's 7-day backup window regardless | `docs/data-retention-privacy.md` §5 |
| This threat model's team review | M9-T3's own acceptance criterion — needs an actual teammate, not something a code change closes | `docs/threat-model.md` §4 |

## 7. Where to look for more

- **Full threat model + STRIDE analysis + controls checklist:** `docs/threat-model.md`
- **Full DevSecOps pipeline (SAST/DAST/IaC scanning, branching, secrets, runtime controls):** `docs/devsecops.md`
- **Data retention/privacy policy detail:** `docs/data-retention-privacy.md`
- **Mail filter testing + known limitations (e.g. attachments not scanned):** `docs/m7-t4-t6-mail-filter-testing.md`
