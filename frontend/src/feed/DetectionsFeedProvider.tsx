import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError, isAbortError, listDetections } from '@/lib/api';
import {
  DEFAULT_LIMIT,
  useDetectionsQuery,
  type ServerParams,
} from '@/hooks/useDetectionsQuery';
import type { DetectionRecord } from '@/lib/types';

/**
 * The single source of feed truth (RB-1). One interval, one request per cycle,
 * one immutable snapshot — the detections table, the nav arrival badge, and the
 * top-bar quarantine bell all DERIVE from it and never fetch.
 *
 * It has to live above the routed page: the bell renders in `TopBar` and the
 * badge in the nav, both siblings of `<Outlet/>`, so a page-local hook could
 * not feed them. Separate fetchers would interleave and let the bell describe a
 * different feed than the table — the drift this slice exists to remove.
 *
 * Two reads, both owned here so nothing else imports `listDetections`:
 *  - the live poll, always `offset: 0`, repeated every 30s
 *  - `page`, a one-shot read when the analyst pages away from the live window
 */

const POLL_MS = 30_000;
/** Older than this and the snapshot is labelled stale rather than current. */
export const STALE_AFTER_MS = POLL_MS * 2;

export interface FeedSnapshot {
  /** Rows from the last SUCCESSFUL response — never cleared by a failure. */
  rows: DetectionRecord[];
  /** When those rows arrived. Freshness is measured from this, never from now. */
  fetchedAt: number | null;
  /** The params that produced these rows. */
  params: ServerParams;
  /** Last failure, held separately from rows (RB-7). */
  error: ApiError | null;
}

interface FeedContextValue {
  /** The live window (offset 0) — what the chrome always reflects. */
  live: FeedSnapshot;
  /** Non-null only while the analyst is paged away from the live window. */
  page: FeedSnapshot | null;
  /** True during the very first load, before any rows exist. */
  isInitialLoading: boolean;
  /** Ids in `live` newer than anything rendered before — drives the highlight. */
  arrivals: number[];
  isPaused: boolean;
  setPaused: (paused: boolean) => void;
  refreshNow: () => void;
}

const FeedContext = createContext<FeedContextValue | null>(null);

function emptySnapshot(params: ServerParams): FeedSnapshot {
  return { rows: [], fetchedAt: null, params, error: null };
}

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, 'Feed update failed.');
}

function highestId(rows: DetectionRecord[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0);
}

export function DetectionsFeedProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { server } = useDetectionsQuery();

  // Filters belong to the Detections route. Elsewhere the chrome still needs a
  // feed, so poll the default unfiltered window rather than inheriting whatever
  // query another route happens to carry.
  const onDetections = pathname.startsWith('/detections');
  const liveParams = useMemo<ServerParams>(
    () =>
      onDetections
        ? { verdict: server.verdict, source: server.source, limit: server.limit, offset: 0 }
        : { limit: DEFAULT_LIMIT, offset: 0 },
    [onDetections, server.limit, server.source, server.verdict],
  );
  // Stable identity for effect deps — the object is rebuilt on every render.
  const liveKey = `${liveParams.verdict ?? ''}|${liveParams.source ?? ''}|${liveParams.limit}`;

  const [live, setLive] = useState<FeedSnapshot>(() => emptySnapshot(liveParams));
  const [page, setPage] = useState<FeedSnapshot | null>(null);
  const [arrivals, setArrivals] = useState<number[]>([]);
  const [isPaused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const [tick, setTick] = useState(0);

  const paramsRef = useRef(liveParams);
  paramsRef.current = liveParams;
  const maxSeenRef = useRef<number | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);
  const pageAbortRef = useRef<AbortController | null>(null);

  const fetchLive = useCallback(async () => {
    liveAbortRef.current?.abort();
    const controller = new AbortController();
    liveAbortRef.current = controller;
    const params = paramsRef.current;

    try {
      const rows = await listDetections({ ...params, signal: controller.signal });

      // What counts as "new": ids above the high-water mark. `id` is an integer
      // primary key, so the comparison is exact; `created_at` can tie.
      const mark = maxSeenRef.current;
      setArrivals(mark === null ? [] : rows.filter((r) => r.id > mark).map((r) => r.id));

      // Seed on the first successful response WITHOUT flagging anything, and
      // only advance while the tab is visible — otherwise a poll landing out of
      // sight consumes arrivals nobody saw.
      if (mark === null || document.visibilityState === 'visible') {
        maxSeenRef.current = Math.max(mark ?? 0, highestId(rows));
      }

      setLive({ rows, fetchedAt: Date.now(), params, error: null });
    } catch (err) {
      if (isAbortError(err)) return;
      // Keep the rows and their original fetchedAt: stale-but-visible beats a
      // blank table, as long as the UI says which it is.
      setLive((prev) => ({ ...prev, error: toApiError(err) }));
    }
  }, []);

  // Load immediately on mount, on a filter change, and on manual refresh —
  // deliberately NOT gated on visibility. A page opened in a background tab
  // must still have rows when the analyst switches to it, and a filter change
  // must not wait out the remainder of the current tick.
  useEffect(() => {
    void fetchLive();
  }, [fetchLive, liveKey, tick]);

  // Only the REPEAT is gated: no point burning requests on a tab nobody is
  // looking at, and browsers throttle hidden timers anyway.
  useEffect(() => {
    if (isPaused || hidden) return;
    const id = window.setInterval(() => void fetchLive(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchLive, hidden, isPaused]);

  // Returning to a visible tab does exactly one catch-up fetch, rather than
  // trusting a throttled interval to have kept up.
  const wasHiddenRef = useRef(hidden);
  useEffect(() => {
    if (wasHiddenRef.current && !hidden) void fetchLive();
    wasHiddenRef.current = hidden;
  }, [fetchLive, hidden]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Paging away from the live window is a one-shot read, still owned here.
  useEffect(() => {
    if (!onDetections || server.offset <= 0) {
      setPage(null);
      return;
    }
    pageAbortRef.current?.abort();
    const controller = new AbortController();
    pageAbortRef.current = controller;
    const params: ServerParams = { ...paramsRef.current, offset: server.offset };

    listDetections({ ...params, signal: controller.signal })
      .then((rows) => setPage({ rows, fetchedAt: Date.now(), params, error: null }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setPage((prev) =>
          prev
            ? { ...prev, error: toApiError(err) }
            : { ...emptySnapshot(params), error: toApiError(err) },
        );
      });

    return () => controller.abort();
  }, [liveKey, onDetections, server.offset]);

  useEffect(() => () => liveAbortRef.current?.abort(), []);

  const value = useMemo<FeedContextValue>(
    () => ({
      live,
      page,
      isInitialLoading: live.fetchedAt === null && live.error === null,
      arrivals,
      isPaused,
      setPaused,
      refreshNow: () => setTick((t) => t + 1),
    }),
    [arrivals, isPaused, live, page],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useDetectionsFeed(): FeedContextValue {
  const ctx = useContext(FeedContext);
  if (!ctx) {
    throw new Error('useDetectionsFeed must be used inside <DetectionsFeedProvider>.');
  }
  return ctx;
}
