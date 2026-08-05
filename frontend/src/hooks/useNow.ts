import { useEffect, useState } from 'react';

/**
 * The current wall-clock time as a piece of state, re-read on an interval.
 *
 * Freshness text ("updated 12 seconds ago", the stale-feed threshold) is a
 * function of *when it is now*, which changes without any prop or state
 * changing. Reading `Date.now()` straight from a render body expresses that
 * badly: render stops being a pure function of its inputs, so two renders with
 * identical props can disagree, and nothing actually schedules the re-render
 * that keeps the text truthful — the components that did this each had to run
 * a throwaway `useState` ticker beside it to force one.
 *
 * Holding "now" in state collapses both halves into one honest input: the
 * interval is what advances it, and render just reads it.
 *
 * @param intervalMs how often to re-read the clock (default 5s, the feed's
 *   freshness cadence).
 */
export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
