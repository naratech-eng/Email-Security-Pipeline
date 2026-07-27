# Email Security Pipeline — Analyst Dashboard

Production React SPA (the analyst-facing view of the CYT300 phishing-detection pipeline).
Built with Vite + TypeScript (strict), Tailwind CSS v4, shadcn/ui, react-router, AWS Amplify
(Cognito auth), Recharts, lucide-react, and Framer Motion.

> Being built in slices:
> **1** scaffold, design system, app shell · **2** Cognito auth, roles, avatars ·
> **3 (this)** API client + the shared analysis view · **4** detections workspace and
> detail · **5** Analyze flow · **6** Overview wall · **7** user management.
> Pages not yet built show a themed placeholder, so the shell stays navigable throughout.

## Local setup

Requires Node 24+ (developed on Node 26).

```bash
cd frontend
npm ci                       # or: npm install (first time)
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

The dev server runs on **port 3000** because the Cognito app client's callback URL is
`http://localhost:3000/callback`.

### Environment variables

All config comes from `import.meta.env` — nothing is hardcoded. Copy `.env.example` to
`.env.local` (gitignored) and fill in:

| Variable | Meaning | Where to get it |
| --- | --- | --- |
| `VITE_API_BASE_URL` | FastAPI inference service base URL | dev: `https://esp-api.naratech.xyz` |
| `VITE_COGNITO_USER_POOL_ID` | Cognito user pool id | `terraform output cognito_pool_id` (`infra/envs/dev`) |
| `VITE_COGNITO_CLIENT_ID` | Cognito app client id | `terraform output cognito_client_id` (`infra/envs/dev`) |
| `VITE_COGNITO_REGION` | AWS region of the pool | e.g. `us-east-1` |
| `VITE_APP_ENV` | Top-bar env badge label | `DEV` or `PROD` |

The shell (slice 1) only needs `VITE_APP_ENV`; the Cognito/API vars are validated lazily when
the auth and data slices use them, so you can preview the shell before wiring the full env.

## Data layer & the shared analysis view (slice 3)

Everything that talks to the FastAPI service goes through `src/lib/api.ts`:

- `apiFetch` (`src/auth/authApi.ts`) attaches the Cognito **access token**; only `/health`
  skips it, because that endpoint is public.
- FastAPI's `{"detail": ...}` bodies (string *or* validation array) are flattened into one
  `ApiError` carrying `status` + a readable `message`, so pages render errors directly.
  `isAbortError()` marks requests to drop silently rather than surface.
- Endpoints from the agreed-but-undeployed contract degrade instead of throwing:
  `getDetection()` falls back to scanning the feed when `GET /detections/{id}` 404s, and
  `reviewDetection()` returns `null` when `PATCH /detections/{id}` isn't live yet.
- `analyzeEmail()` enforces the client-side rules before spending a ~40s cold start:
  exactly one of pasted text or file, and ≤ 1 MB (`MAX_EMAIL_BYTES`).

Both API payload shapes are normalized once, in `src/lib/normalize.ts`, into the single
`AnalysisResult` view-model (`src/lib/types.ts`) — `fromDetection()` for a persisted
`DetectionRecord`, `fromAnalyze()` for a manual `POST /analyze/email`. Both routes then
render the same `<ResultDisplay>` (`src/components/analysis/`), which is why a server
detection and a manual analysis read identically; `provenance` is a label only and never
branches layout. Review controls are injected via the `actions` prop by whichever page
holds the permission, keeping the renderer presentational.

Two safety rules live in this layer: URLs and sender domains are **defanged**
(`src/lib/defang.ts` — `hxxp://`, `[.]`) and rendered as plain text, never anchors and
never via `dangerouslySetInnerHTML`; and no message body is ever displayed, because the
pipeline never stores one.

## Build

```bash
npm run build     # tsc -b && vite build → dist/  (zero TS errors)
npm audit         # must report 0 vulnerabilities
npm run preview   # serve the production build locally
```

### react-router advisory note

The T10 spec asked to pin `react-router-dom` at `7.11.0` (it believed 7.12+ introduced
GHSA-qwww-vcr4-c8h2). As of this build the advisory database has moved and there is **no
audit-clean react-router version**:

- `7.11.0` → **14** high advisories affecting `6.0.0–7.17.0`, several client-relevant (XSS via
  open redirect, DoS via route matching, open redirect via backslash in `<Link>`) — all **fixed
  in 7.18.1**.
- `7.18.1` (latest, what we ship) → **1** high advisory, `GHSA-qwww-vcr4-c8h2` (RSC-mode CSRF).

We ship **`^7.18.1`** because it fixes the 14 client-relevant issues. The single residual advisory
concerns **React Server Components (RSC) mode**, which this SPA does not use — it routes with
client-side `createBrowserRouter`, so `GHSA-qwww-vcr4-c8h2` is **not exploitable here**. This is an
accepted, documented exception; re-evaluate when a fully patched react-router release lands.

## Design system

The fixed cyber-SOC palette lives in `src/styles/theme.css` as CSS variables (dark is the
default; `[data-theme="light"]` overrides), mapped into Tailwind v4 utilities via `@theme`.
**Never hardcode hex in components** — reference the tokens (`bg-surface`, `text-verdict-quarantine`,
`text-primary`, …). Cyan glow (`.glow-live`) is reserved for the live indicator and the scanning
animation only. Monospace (`font-mono`) uses JetBrains Mono via `@fontsource` (no CDN fonts).

## Hosting (AWS Amplify)

`amplify.yml` (this directory) is the Amplify Hosting build spec (`appRoot: frontend`, `npm ci` →
`npm run build`, artifacts `dist/`, caches `node_modules` + `~/.npm`).

Configure these **once in the Amplify console** (the build spec must not fight them):

- **Branch → environment**
  - `dev` branch → `esp-dev.naratech.xyz` (dev env vars)
  - `naratech` branch → `esp.naratech.xyz` (prod env vars) — release by merging `dev` → `naratech`
  - Enable per-PR previews on PRs targeting `dev`.
- **SPA rewrite rule** (so client-side routes resolve): rewrite
  `</^[^.]+$|\.(?!(css|js|map|json|png|svg|woff2?|ico)$)([^.]+$)/>` → `/index.html` (200).
