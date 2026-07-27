import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_PAGE_SIZE } from '@/lib/api';
import type { DetectionSource, Verdict } from '@/lib/types';

/**
 * The whole `/detections` query contract, in one place (RB-2).
 *
 * The URL is the only filter store — no component reads raw search params, so a
 * shared link, a refresh, and the Back button all reconstruct the same view.
 * Two classes of filter live here and they are NOT interchangeable:
 *
 *  - `server` — verdict, source, limit, offset: the only four params
 *    `GET /detections` accepts (backend/main.py), so these narrow the real
 *    result set.
 *  - `client` — q, from, to: the backend has no search or date filtering, so
 *    these can only narrow the rows already loaded. Callers must disclose that
 *    scope; a zero-result client filter is "no match in the loaded rows", never
 *    "no such mail".
 *
 * Values arrive from strangers' links, so everything is validated on read:
 * unknown verdict/source are dropped (the API 400s on an invalid verdict, which
 * would turn a bad link into an error screen), limit is clamped to the API's
 * own 1–200, and a non-numeric offset falls back to 0.
 */

export const DEFAULT_LIMIT = 50;

const VERDICTS: readonly Verdict[] = ['clean', 'flag', 'quarantine'];
const SOURCES: readonly DetectionSource[] = ['server', 'upload'];

/** Params that reach the API. */
export interface ServerParams {
  verdict?: Verdict;
  source?: DetectionSource;
  limit: number;
  offset: number;
}

/** Filters applied to the loaded window only. */
export interface ClientFilters {
  q: string;
  from: string;
  to: string;
}

export interface QueryPatch {
  /** null clears the filter. */
  verdict?: Verdict | null;
  source?: DetectionSource | null;
  limit?: number;
  q?: string | null;
  from?: string | null;
  to?: string | null;
}

function parseVerdict(raw: string | null): Verdict | undefined {
  return VERDICTS.find((v) => v === raw);
}

function parseSource(raw: string | null): DetectionSource | undefined {
  return SOURCES.find((s) => s === raw);
}

// `Number(null)` and `Number('')` are 0, not NaN — an absent param has to be
// caught before the numeric checks or a missing `limit` clamps to 1.
function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_PAGE_SIZE);
}

function parseOffset(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

/** `YYYY-MM-DD` only — anything else is dropped rather than half-applied. */
function parseDate(raw: string | null): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

export interface DetectionsQuery {
  server: ServerParams;
  client: ClientFilters;
  /** True when viewing the live window (offset 0). */
  isLatest: boolean;
  /**
   * Merge a patch into the query. Changing anything that alters the result set
   * resets `offset` — otherwise switching to `verdict=quarantine` at offset 100
   * lands on an empty page that reads as "no quarantine mail".
   * `replace: true` for keystroke-level edits so typing doesn't stack history.
   */
  setFilters: (patch: QueryPatch, opts?: { replace?: boolean }) => void;
  setPage: (offset: number) => void;
  returnToLatest: () => void;
}

function parseServer(sp: URLSearchParams): ServerParams {
  return {
    verdict: parseVerdict(sp.get('verdict')),
    source: parseSource(sp.get('source')),
    limit: clampLimit(sp.get('limit')),
    offset: parseOffset(sp.get('offset')),
  };
}

function parseClient(sp: URLSearchParams): ClientFilters {
  return {
    q: sp.get('q') ?? '',
    from: parseDate(sp.get('from')),
    to: parseDate(sp.get('to')),
  };
}

/** Serialize, omitting defaults so a shared link carries only real choices. */
function serialize(next: ServerParams & ClientFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (next.verdict) out.set('verdict', next.verdict);
  if (next.source) out.set('source', next.source);
  if (next.limit !== DEFAULT_LIMIT) out.set('limit', String(next.limit));
  if (next.offset > 0) out.set('offset', String(next.offset));
  if (next.q) out.set('q', next.q);
  if (next.from) out.set('from', next.from);
  if (next.to) out.set('to', next.to);
  return out;
}

export function useDetectionsQuery(): DetectionsQuery {
  const [params, setParams] = useSearchParams();

  const server = useMemo<ServerParams>(() => parseServer(params), [params]);
  const client = useMemo<ClientFilters>(() => parseClient(params), [params]);

  // Every write merges from the LATEST params via the functional form, never
  // from this render's closure — otherwise two edits in the same tick (fast
  // typing, a paste) both merge onto the stale value and the first one is lost.
  const write = useCallback(
    (patch: QueryPatch, replace: boolean) => {
      setParams(
        (prev) => {
          const cur = { ...parseServer(prev), ...parseClient(prev) };
          const resetsPage =
            'verdict' in patch || 'source' in patch || 'limit' in patch;
          return serialize({
            verdict: 'verdict' in patch ? (patch.verdict ?? undefined) : cur.verdict,
            source: 'source' in patch ? (patch.source ?? undefined) : cur.source,
            limit: patch.limit ?? cur.limit,
            offset: resetsPage ? 0 : cur.offset,
            q: 'q' in patch ? (patch.q ?? '') : cur.q,
            from: 'from' in patch ? (patch.from ?? '') : cur.from,
            to: 'to' in patch ? (patch.to ?? '') : cur.to,
          });
        },
        { replace },
      );
    },
    [setParams],
  );

  const setFilters = useCallback<DetectionsQuery['setFilters']>(
    (patch, opts) => write(patch, opts?.replace ?? false),
    [write],
  );

  const setPage = useCallback(
    (offset: number) => {
      setParams(
        (prev) =>
          serialize({
            ...parseServer(prev),
            ...parseClient(prev),
            offset: Math.max(0, offset),
          }),
        { replace: false },
      );
    },
    [setParams],
  );

  const returnToLatest = useCallback(() => setPage(0), [setPage]);

  return {
    server,
    client,
    isLatest: server.offset === 0,
    setFilters,
    setPage,
    returnToLatest,
  };
}
