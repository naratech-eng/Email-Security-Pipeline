# M7 T10–T14 — Frontend Build Prompt (Email Security Pipeline dashboard)

This is the complete build specification for the analyst dashboard. It doubles as the
T10 design document. Paste it into your codegen tool of choice, or hand it to a
developer — everything a builder needs is in this one file. Decisions here were made
deliberately (see PR history for M7); do not silently substitute alternatives.

---

## Prompt

Build a production-quality React single-page app in the **`frontend/`** directory of
this repository (repo root already contains `backend/`, `infra/`, `docs/`).

### Stack (fixed — do not substitute)

| Piece | Choice | Notes |
|---|---|---|
| Build tool | Vite | template `react-ts` |
| Language | TypeScript, `strict: true` | no `any` except where a lib forces it |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | class-strategy dark mode |
| Components | shadcn/ui | copy-in components, keep them in `frontend/src/components/ui/` |
| Routing | `react-router-dom` **pinned to 7.11.0** | 7.12+ has GHSA-qwww-vcr4-c8h2 (high); `npm audit` must be clean |
| Auth | `aws-amplify` v6 (Auth category only) | no Amplify UI components — custom pages that match the theme |
| Charts | Recharts | interactive tooltips/hover required |
| Icons | lucide-react | |

### Environment variables (never hardcode — Vite `import.meta.env`)

```
VITE_API_BASE_URL          # dev: https://esp-api.naratech.xyz
VITE_COGNITO_USER_POOL_ID  # currently us-east-1_xMxnEsRE1
VITE_COGNITO_CLIENT_ID     # currently 4rt8f5ds4ch0frl0tcakkohq55
VITE_COGNITO_REGION        # us-east-1
```

Provide `.env.example` with these keys and no values. `.env.local` is gitignored.

---

## Authentication & roles

### Login / Register (custom pages, both themed)

- **Register**: email, password (Cognito policy: min 12 chars, upper+lower+number+symbol
  — surface these rules inline as the user types), and a **role dropdown** with exactly
  three options: `SOC Analyst`, `Security Operator`, `Security Analyst`. Submit via
  Amplify `signUp()` passing the role as a custom attribute `custom:role`.
- **Email verification**: after signUp, show a 6-digit code entry screen
  (`confirmSignUp`), with a resend-code link.
- **Login**: email + password via `signIn()` (SRP), **then an email OTP step on
  every login** (Cognito email MFA). Handle `signIn()` next-steps:
  - `CONFIRM_SIGN_IN_WITH_EMAIL_CODE` → 6-digit OTP entry screen (auto-advance
    boxes, paste support), submit via `confirmSignIn({ challengeResponse })`.
    Show which address the code went to (masked, e.g. `s•••@gmail.com`, from
    `codeDeliveryDetails`). "Didn't get a code?" restarts `signIn()`.
  - `CONFIRM_SIGN_UP` → route to the registration verification screen.
  Wrong/expired code shows an inline error and keeps the user on the OTP screen;
  three failures restart login. The OTP screen must be themed like the rest of
  auth — not a bare form.
- **Forgot password**: `resetPassword()` + `confirmResetPassword()` flow, linked from login.
- Tokens: use `fetchAuthSession()`; send the **access token** as
  `Authorization: Bearer <token>` on every API call. On 401, force re-login.
- Sign-out button in the app shell (`signOut()`).

### Roles → permissions (groups arrive in the JWT as `cognito:groups`)

Cognito group names: `soc-analyst`, `security-operator`, `security-analyst`.

| Capability | soc-analyst | security-operator | security-analyst |
|---|---|---|---|
| Overview page | ✅ | ✅ | ✅ |
| Detections list + detail | ✅ | ✅ | ✅ |
| Analyze page (paste/upload) | ❌ | ✅ | ✅ |
| Mark detection false-positive / confirmed | ❌ | ❌ | ✅ |
| User management page | ❌ | ❌ | ✅ |

- Gate **routes** (redirect to Overview with a toast if unauthorized) and **UI**
  (hide nav items and action buttons the role lacks). Centralize this in one
  `usePermissions()` hook reading the ID token payload — never scatter group-name
  string checks through components.
- A signed-in user with **no group yet** (freshly confirmed, before backend assigns
  the group — see "Backend contract" below) sees a "pending role assignment" screen,
  not a broken app.

---

## Pages

App shell: left sidebar nav (collapsible), top bar with environment badge
(`DEV` / `PROD` from an env var), user email + role chip, theme toggle, sign-out.
- **Global search** in the top bar (senders, subjects, domains) — submitting routes
  to `/detections?q=<term>`; it is a shortcut to the detections filter, not a
  separate search system.
- **Live badge on the Detections nav item**: count of detections that arrived since
  the user last viewed the list (from the same 30s poll — no extra endpoint),
  cleared on visit. Quarantine arrivals also increment a top-bar bell with a small
  dropdown of the latest 5; purely client-side state.

### 1. Overview (`/`) — the SOC wall screen
- Stat tiles: total detections, clean / flag / quarantine counts (last 24h and all-time).
- **Detections over time**: interactive area or bar chart, bucketed hourly/daily,
  stacked by verdict.
- **Verdict split**: donut chart, clickable segments filter → navigates to the
  Detections page with that filter applied.
- Recent activity feed: last 10 detections, one line each (time, verdict badge,
  subject, source), row click → detail.
- **System status card** (replaces a bare strip): per-service rows with green/red
  dots — API (`GET /health`), Database (last `/detections` call succeeded),
  Mail pipeline (most recent `source=server` detection time — stale > 24h shows
  amber "quiet"), Auth (Cognito session valid). Derive every row from calls the
  app already makes — invent no fake "99.99% uptime" numbers; show real timestamps.
- **Reviewed-precision stat tile** (appears once review data exists): of detections
  a Security Analyst has reviewed, the % confirmed vs false-positive — the one
  honest "accuracy" number derivable from live data. Hidden until ≥ 5 reviews.

### 2. Detections (`/detections`) — T13

**This page is primarily a live feed, not an upload log.** The mail server scores
every message the company's mailboxes send or receive — external inbound, internal
user-to-user, and outbound — and each one appears here automatically as a
`source=server` detection with no user action. Manual uploads from the Analyze page
(`source=upload`) are the secondary stream. Treat the design accordingly: the
default view is all sources with a prominent segmented control
(**All / Mail server / Manual uploads**), and new `server` rows arriving via the
poll should animate in (brief highlight) so live traffic is visibly live.

- Table (shadcn DataTable): time, verdict (colored badge), likelihood (small meter),
  subject, from, to, source (`upload`/`server` badge), # URLs. The `to` column is
  how an analyst sees *which company mailbox* received a threat.
- Filters: verdict, source, date range, free-text search (subject/sender). Filter
  state lives in the URL query string so filtered views are shareable.
- **Auto-refresh every 30s** with a subtle "live" pulse indicator and a pause toggle.
  Pause polling when the tab is hidden (`document.visibilityState`).
- Pagination via `limit`/`offset` params.
- **Export CSV** button (security-analyst only): downloads the *currently filtered*
  rows as CSV, generated client-side from the already-fetched data — no backend
  endpoint. Filename `detections-<date>.csv`.
- Row click → **Detail** (`/detections/:id`): full record — verdict + likelihood
  gauge, summary, remediation callout, email metadata (from/to/subject/date),
  email model score + reason + feature breakdown, per-URL cards (url, score,
  verdict, feature table). Render URLs **defanged** (`hxxp://`, `[.]`) — this is a
  phishing tool; never render a clickable malicious link.
- **Status actions** (security-analyst only): "Mark false positive" / "Confirm threat"
  buttons on the detail page, with a confirm dialog and optional note. Calls
  `PATCH /detections/{id}` (see Backend contract). Show current review status as a
  badge in both list and detail.

### 3. Analyze (`/analyze`) — T12, the core demo path
- Two input modes (tabs): **paste raw email** (textarea, monospace) and **upload .eml**
  (drag-and-drop zone + file picker, .eml/.txt only, reject >1 MB client-side).
- Submit → `POST /analyze/email` (multipart: `file`, `source=upload`,
  `submitted_by=<user email>`).
- Result panel: big verdict banner (color-coded), animated likelihood gauge 0–100,
  summary, remediation callout, email-model card (score/reason/features), per-URL
  breakdown cards. Include a "view in detections" link (the backend persists it).
- Loading state matters: scoring can take up to ~40s on a cold model load —
  show a themed scanning animation with elapsed time, not a frozen spinner.
  Timeout messaging after 60s.

### 4. Users (`/users`) — security-analyst only
- Table of Cognito users: email, role group, status (confirmed/unconfirmed), created.
- Actions: change a user's role, disable/enable a user. Confirm dialogs on both.
- Backed by admin endpoints (see Backend contract). If those endpoints 404
  (not deployed yet), show a graceful "coming soon" state — do not crash.

---

## Theme & visual identity

- **Dark cyber-SOC theme by default, light theme available**, toggle persisted to
  `localStorage`, Tailwind class strategy, both themes fully styled.
- **Palette (fixed tokens — wire these as CSS variables / Tailwind theme colors;
  do not improvise other hues).** Cyan is the identity color; violet is a sparing
  secondary; verdict colors are the only other loud colors in the app.

  | Token | Dark (default) | Light |
  |---|---|---|
  | `--background` (app bg) | `#070B14` | `#F6F8FB` |
  | `--surface` (cards/panels) | `#0D1420` | `#FFFFFF` |
  | `--surface-2` (elevated/hover) | `#131C2E` | `#EEF2F8` |
  | `--border` | `#1E2A3F` | `#DCE3EE` |
  | `--foreground` (primary text) | `#E6EDF7` | `#0F1B2D` |
  | `--muted-foreground` | `#8CA0BB` | `#5B6B82` |
  | `--primary` (accent, links, active nav, live pulse) | `#22D3EE` | `#0891B2` |
  | `--primary-foreground` (text on primary) | `#06202A` | `#FFFFFF` |
  | `--secondary` (secondary accent, chart series) | `#A78BFA` | `#7C3AED` |
  | `--verdict-clean` | `#34D399` | `#059669` |
  | `--verdict-flag` | `#FBBF24` | `#B45309` |
  | `--verdict-quarantine` | `#F87171` | `#DC2626` |
  | `--destructive` (errors, dangerous actions) | `#EF4444` | `#DC2626` |
  | `--chart-grid` | `#1E2A3F` | `#E3E9F2` |

  Usage rules: backgrounds layer `background → surface → surface-2`, never pure
  black/white in dark mode. Cyan glow effects (`box-shadow` with `--primary` at low
  alpha) only on the live indicator and the scanning animation — nowhere else.
  Verdict colors appear identically in badges, gauges, chart series, and the donut;
  the lighter dark-mode shades vs darker light-mode shades exist to hold ≥ 4.5:1
  text contrast on their respective backgrounds — keep that pairing.
- Monospace font for emails, URLs, scores, and raw content (JetBrains Mono or
  similar via fontsource — no external CDN fonts).
- Tasteful motion: scanline/pulse on the Analyze scanning state, subtle glow on the
  live indicator, animated count-up on stat tiles, chart enter transitions. A small
  animated "sentinel" mascot (CSS/SVG — e.g., a shield or terminal-face that blinks
  while scanning and reacts to the verdict) on the Analyze page is welcome; keep it
  professional-cute, not clip-art. **No heavy animation libraries** — CSS and SVG
  only; the app must stay snappy.
- Interactive charts everywhere data appears: hover tooltips, clickable segments
  that apply filters.
- Responsive down to tablet; sidebar collapses. Accessibility basics: focus states,
  aria labels on icon buttons, color contrast ≥ 4.5:1 for text in both themes.

---

## API contract (already live)

Base URL: `VITE_API_BASE_URL`. All endpoints below require `Authorization: Bearer`.

### `GET /health` → `{"status":"ok"}` (no auth)

### `GET /detections?limit=&offset=&verdict=&source=` → `DetectionRecord[]`

```ts
interface DetectionRecord {
  id: number;
  created_at: string;          // ISO 8601
  source: "upload" | "server";
  submitted_by: string | null;
  verdict: "clean" | "flag" | "quarantine";
  likelihood: number;          // 0–100
  summary: string;
  remediation: string;
  from_addr: string | null;
  to_addr: string | null;
  subject: string | null;
  email_date: string | null;
  num_urls: number;
  attachment_count: number;
  email_score: number;
  email_model: string;
  email_reason: string;
  email_features: Record<string, number>;
  urls: UrlDetail[];
}
interface UrlDetail {
  url: string;
  model: string;
  score: number;
  reason: string;
  verdict: string;
  likelihood: number;          // 0–100
  features: Record<string, number>;
}
```

### `POST /analyze/email` (multipart: `file` | `text`, `source`, `submitted_by`) → 

```ts
interface AnalyzeResponse {
  verdict: "clean" | "flag" | "quarantine";
  likelihood: number;
  summary: string;
  remediation: string;
  email: { score: number; model: string; reason: string; features: Record<string, number>; verdict: string; likelihood: number };
  urls: UrlDetail[];
  metadata: { from_addr?: string; to_addr?: string; subject?: string; date?: string; num_urls: number; attachment_count: number };
}
```

## Backend contract (agreed, being built in parallel — code against these shapes)

These do **not** exist yet. Build the UI against them; degrade gracefully on 404.

- Auth change: the API will validate **Cognito access tokens** (JWKS) instead of
  the current static secret, and enforce the role matrix server-side.
- **Email MFA at login** is being enabled on the user pool in Terraform (requires
  the Cognito *Essentials* feature plan + `mfa_configuration` with email OTP —
  infra-side change, nothing for the frontend to configure). Until it lands,
  `signIn()` will succeed without the `CONFIRM_SIGN_IN_WITH_EMAIL_CODE` step —
  the login flow must handle both paths (OTP step present or absent) so the app
  works before and after the pool change.
- `POST /users/claim-role` — called once after first sign-in by the frontend;
  backend reads `custom:role` from the verified token and adds the user to the
  matching Cognito group (only if they have no group). Frontend: call it when a
  session has no `cognito:groups`, then refresh the session.
- `PATCH /detections/{id}` body `{ "review_status": "false_positive" | "confirmed", "review_note"?: string }`
  → updated `DetectionRecord` (gains optional `review_status`, `review_note`,
  `reviewed_by`, `reviewed_at` fields — type them as optional now).
- `GET /users`, `PATCH /users/{username}` (role/enabled) — security-analyst only,
  for the Users page.

---

## Hosting & CI (Amplify)

- Add `frontend/amplify.yml` (Amplify Hosting build spec, `appRoot: frontend`):
  `npm ci` → `npm run build`, artifacts `dist/`, cache `node_modules` and `~/.npm`.
- Branch strategy (configured in the Amplify console, spec must not fight it):
  - `dev` branch → **esp-dev.naratech.xyz** (dev env vars)
  - `naratech` branch → **esp.naratech.xyz** (prod env vars) — release by merging
    dev → naratech; per-PR previews enabled on PRs targeting dev.
- SPA routing: include the Amplify rewrite rule
  (`</^[^.]+$|\.(?!(css|js|map|json|png|svg|woff2?|ico)$)([^.]+$)/>` → `/index.html` 200)
  in the docs/README so it's set once in the console.

## Quality bar (non-negotiable)

- `npm run build` passes with zero TS errors; `npm audit` reports **0 vulnerabilities**.
- No secrets, pool IDs, or API URLs hardcoded — env vars only, `.env.example` provided.
- Every data view has loading, error, and empty states (empty states themed, not blank).
- All user-visible content from the API (subjects, senders, URLs) rendered as text —
  never `dangerouslySetInnerHTML`; URLs defanged as noted.
- `frontend/README.md`: local setup (`npm ci`, `.env.local` from example, `npm run dev`
  on port 3000 — Cognito callback expects `http://localhost:3000/callback`),
  build, and the Amplify console steps.

---

## Context for the builder (why this app exists)

CYT300 capstone: an AI phishing-detection pipeline. A Postfix/Dovecot mail server
scores every inbound email via ML models (LinearSVC email classifier + Char-CNN URL
classifier) behind a FastAPI service on ECS Fargate; verdicts tag headers, Sieve
quarantines, and every scored message is persisted to RDS Postgres as a "detection"
(`source=server`). This dashboard is the analyst-facing view of that pipeline plus a
manual analysis tool (`source=upload`). The demo audience is a grading panel — the
Analyze page and the live-updating Detections list are the money shots.

Privacy property worth preserving in the UI: the pipeline **never stores message
bodies** — a detection is metadata (from/to/subject/date), scores, extracted URLs,
and the verdict. So while every internal company email appears in the feed, its
content does not exist anywhere the dashboard can show. Do not add UI that implies
body content is available (no "view message" affordance), and the detail page may
state this explicitly — it is a deliberate data-minimization decision, not a gap.
