import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDetectionStats, isAbortError, type StatsWindow } from '@/lib/api';
import { fromStats, fromWindow } from '@/lib/overviewStats';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import type { OverviewStats } from '@/lib/types';

/**
 * The Overview wall's aggregate source, with an honest degraded path.
 *
 * Two rules this hook exists to keep:
 *
 *  1. **Only the summary tiles fetch.** Recent activity reads the shared
 *     `DetectionsFeedProvider` snapshot — slice 4's one-poll invariant means we
 *     add exactly one new request to this route, never a second row query.
 *  2. **Failure is not emptiness.** When `/detections/stats` is unreachable or
 *     the deployed backend predates it, we fall back to deriving what the
 *     already-loaded feed window supports and mark the result `basis: 'window'`
 *     so every tile can say what it is actually showing. If BOTH are gone,
 *     `stats` is null — "we don't know" — and the tiles render unavailable
 *     rather than zeros.
 */

/** Matches the feed's own cadence so the wall's two sources stay in step. */
const POLL_MS = 30_000;

/** Why the wall is on the degraded path — each is a different sentence. */
export type DegradedReason = 'not-deployed' | 'db-unavailable' | 'request-failed';

const DEGRADED_COPY: Record<DegradedReason, string> = {
  'not-deployed': 'Summary totals aren’t available from this API build yet',
  'db-unavailable': 'The API couldn’t read the detections database',
  'request-failed': 'The summary request failed',
};

export interface OverviewStatsState {
  /** Null only when neither the aggregate nor the feed window can answer. */
  stats: OverviewStats | null;
  /** True during the very first load, before anything can be rendered. */
  isInitialLoading: boolean;
  /** Why aggregates are missing, or null when they aren't. */
  degradedReason: DegradedReason | null;
  /** One sentence naming what's missing — already phrased for display. */
  degradedMessage: string | null;
  /** True when the wall is running on the feed window instead of real totals. */
  isDegraded: boolean;
  windowHours: StatsWindow;
  setWindowHours: (hours: StatsWindow) => void;
  refresh: () => void;
}

export function useOverviewStats(initial: StatsWindow = 24): OverviewStatsState {
  const { live } = useDetectionsFeed();
  const [windowHours, setWindowHours] = useState<StatsWindow>(initial);
  const [aggregate, setAggregate] = useState<OverviewStats | null>(null);
  const [reason, setReason] = useState<DegradedReason | null>(null);
  const [isInitialLoading, setInitialLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Guards a late response from a superseded window/poll overwriting a newer one.
  const genRef = useRef(0);

  useEffect(() => {
    const generation = (genRef.current += 1);
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const res = await getDetectionStats({ windowHours, signal: controller.signal });
        if (cancelled || generation !== genRef.current) return;
        if (res.kind === 'ok') {
          setAggregate(fromStats(res.data));
          setReason(null);
        } else {
          // Not zero detections — no answer at all. Degrade, never render 0.
          setAggregate(null);
          setReason(res.kind);
        }
      } catch (err) {
        if (cancelled || isAbortError(err) || generation !== genRef.current) return;
        setAggregate(null);
        setReason('request-failed');
      } finally {
        if (!cancelled && generation === genRef.current) setInitialLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [windowHours, tick]);

  // Poll on the feed's cadence, and stop while the tab is hidden — a background
  // tab polling an aggregate nobody is reading is pure load.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const stats = useMemo<OverviewStats | null>(() => {
    if (aggregate) return aggregate;
    // Degraded: derive from the rows the shared feed already holds. Only worth
    // doing when it actually has some — an empty window would assert "0
    // detections" on the strength of a failed request.
    if (live.rows.length > 0) return fromWindow(live.rows, live.params.limit);
    return null;
  }, [aggregate, live.params.limit, live.rows]);

  return {
    stats,
    isInitialLoading: isInitialLoading && stats === null,
    degradedReason: aggregate === null ? reason : null,
    degradedMessage: aggregate === null && reason ? DEGRADED_COPY[reason] : null,
    isDegraded: aggregate === null && stats !== null,
    windowHours,
    setWindowHours: useCallback((hours: StatsWindow) => setWindowHours(hours), []),
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}
