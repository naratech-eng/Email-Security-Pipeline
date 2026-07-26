/**
 * Typed client for the FastAPI inference service. Every call goes through
 * `apiFetch` (Cognito access token as Bearer) except `/health`, which is public.
 *
 * Two rules this layer owns so the pages never repeat them:
 *  - FastAPI errors (`{detail: string}` or a validation array) are flattened into
 *    one `ApiError` with a readable message, so a page can render it directly.
 *  - Endpoints the backend has not deployed yet (`PATCH /detections/{id}`,
 *    `GET /detections/{id}`) degrade instead of throwing — the UI is built ahead
 *    of the agreed contract and must not crash on 404.
 */
import { apiFetch } from '@/auth/authApi';
import { apiBaseUrl } from '@/lib/env';
import type {
  AnalyzeResponse,
  DetectionRecord,
  DetectionSource,
  ReviewStatus,
  Verdict,
} from '@/lib/types';

/** Client-side email size cap (spec: reject >1 MB before it reaches the API). */
export const MAX_EMAIL_BYTES = 1024 * 1024;

/** Accepted upload extensions — matches the Analyze spec (.eml / .txt only). */
export const ACCEPTED_EMAIL_EXTENSIONS = ['.eml', '.txt'] as const;

/** Backend page cap for `GET /detections` (`limit` is validated 1–200). */
export const MAX_PAGE_SIZE = 200;

/** A failed API call. `status` is 0 when the request never reached the service. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  /** True when the service was unreachable (DNS, CORS, offline, aborted socket). */
  get isTransport(): boolean {
    return this.status === 0;
  }

  /** True when the caller's token is missing, expired, or lacks the role. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** True for an aborted request — callers should drop it, not surface an error. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function flattenDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' ? (d as { msg?: string }).msg : null))
      .filter((m): m is string => Boolean(m));
    if (msgs.length) return msgs.join('; ');
  }
  return null;
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText || `Request failed with ${res.status}`;
  try {
    const body: unknown = await res.json();
    const detail =
      body && typeof body === 'object' ? (body as { detail?: unknown }).detail : null;
    message = flattenDetail(detail) ?? message;
  } catch {
    // Non-JSON body (ALB/HTML error page) — keep the status text.
  }
  return new ApiError(res.status, message);
}

/** One authenticated JSON round-trip. Aborts propagate; everything else is ApiError. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, init);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, 'Could not reach the analysis service. Check your connection.');
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ health -- */

export interface HealthResponse {
  status: string;
}

/**
 * `GET /health` — public, so this bypasses `apiFetch` (no token fetch on a call
 * the Overview wall polls). Throws `ApiError` like every other call.
 */
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/health`, { signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, 'Analysis service is unreachable.');
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as HealthResponse;
}

/* -------------------------------------------------------------- detections -- */

export interface ListDetectionsParams {
  limit?: number;
  offset?: number;
  /** Server-side filter — client-only filters (q, date range) stay in the page. */
  verdict?: Verdict;
  source?: DetectionSource;
  signal?: AbortSignal;
}

/** `GET /detections` — one page of the feed, newest first (backend ordering). */
export function listDetections({
  limit = 50,
  offset = 0,
  verdict,
  source,
  signal,
}: ListDetectionsParams = {}): Promise<DetectionRecord[]> {
  const query = new URLSearchParams({
    limit: String(Math.min(limit, MAX_PAGE_SIZE)),
    offset: String(offset),
  });
  if (verdict) query.set('verdict', verdict);
  if (source) query.set('source', source);
  return request<DetectionRecord[]>(`/detections?${query}`, { signal });
}

/** How many list pages `getDetection` will walk before giving up. */
const DETAIL_LOOKUP_PAGES = 5;

/**
 * One detection by id. `GET /detections/{id}` is not in the backend yet, so on
 * 404/405 this falls back to scanning the feed (bounded to
 * `DETAIL_LOOKUP_PAGES` × `MAX_PAGE_SIZE` rows). Returns null when the id is not
 * found — a deep link to an old or invalid id is a UI state, not an error.
 */
export async function getDetection(
  id: number,
  signal?: AbortSignal,
): Promise<DetectionRecord | null> {
  try {
    return await request<DetectionRecord>(`/detections/${id}`, { signal });
  } catch (err) {
    const missingRoute =
      err instanceof ApiError && (err.status === 404 || err.status === 405);
    if (!missingRoute) throw err;
  }

  for (let page = 0; page < DETAIL_LOOKUP_PAGES; page += 1) {
    const rows = await listDetections({
      limit: MAX_PAGE_SIZE,
      offset: page * MAX_PAGE_SIZE,
      signal,
    });
    const hit = rows.find((row) => row.id === id);
    if (hit) return hit;
    if (rows.length < MAX_PAGE_SIZE) break; // reached the end of the feed
  }
  return null;
}

export interface ReviewPayload {
  review_status: ReviewStatus;
  review_note?: string;
}

/**
 * `PATCH /detections/{id}` (agreed contract, not deployed yet). Returns null
 * when the route is absent so the caller can say "review isn't live yet"
 * instead of showing a failure the analyst cannot act on.
 */
export async function reviewDetection(
  id: number,
  payload: ReviewPayload,
  signal?: AbortSignal,
): Promise<DetectionRecord | null> {
  try {
    return await request<DetectionRecord>(`/detections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) return null;
    throw err;
  }
}

/* ----------------------------------------------------------------- analyze -- */

export interface AnalyzeInput {
  /** Pasted raw email. Mutually exclusive with `file`. */
  text?: string;
  /** Uploaded `.eml` / `.txt`. Mutually exclusive with `text`. */
  file?: File;
  /** Cognito username of the submitter, recorded on the persisted detection. */
  submittedBy?: string | null;
  signal?: AbortSignal;
}

/** Bytes in a string as UTF-8 — the same measure the backend applies. */
function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * `POST /analyze/email` (multipart). Always `source=upload` — `server` belongs to
 * the mail content filter, never the dashboard. Enforces the exactly-one-input
 * and 1 MB rules client-side so an obviously bad payload never costs a cold start.
 */
export function analyzeEmail({
  text,
  file,
  submittedBy,
  signal,
}: AnalyzeInput): Promise<AnalyzeResponse> {
  const pasted = text?.trim();
  if (pasted && file) {
    return Promise.reject(
      new ApiError(400, 'Submit either pasted text or a file, not both.'),
    );
  }
  if (!pasted && !file) {
    return Promise.reject(
      new ApiError(400, 'Paste a raw email or choose an .eml file to analyze.'),
    );
  }

  const size = file ? file.size : utf8Bytes(pasted!);
  if (size > MAX_EMAIL_BYTES) {
    return Promise.reject(
      new ApiError(
        413,
        `That email is ${(size / 1024 / 1024).toFixed(1)} MB — the limit is 1 MB.`,
      ),
    );
  }

  const form = new FormData();
  if (file) form.set('file', file, file.name);
  else form.set('text', pasted!);
  form.set('source', 'upload');
  if (submittedBy) form.set('submitted_by', submittedBy);

  // No Content-Type header — the browser sets the multipart boundary.
  return request<AnalyzeResponse>('/analyze/email', { method: 'POST', body: form, signal });
}
