import { Pause, Play, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDetectionsFeed, STALE_AFTER_MS } from '@/feed/DetectionsFeedProvider';
import { useNow } from '@/hooks/useNow';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Freshness strip for the live feed (RB-7). Everything here derives from the
 * snapshot's own `fetchedAt` / `error`, never from "now" — a paused or failed
 * poll must read as stale rather than current, while the rows stay on screen.
 *
 * Accessibility: the status text is the ONLY live region (putting `aria-live` on
 * the row container would make a screen reader re-read every cell each poll),
 * the pulse is decorative, and pause is a real toggle button.
 */
export function FeedStatusBar({ className }: { className?: string }) {
  const { live, isPaused, setPaused, refreshNow } = useDetectionsFeed();

  // Re-read the clock every 5s so "updated N seconds ago" stays honest
  // between polls.
  const now = useNow();

  const age = live.fetchedAt === null ? null : now - live.fetchedAt;
  const isStale =
    live.error !== null || isPaused || (age !== null && age > STALE_AFTER_MS);
  const still = useReducedMotion();

  let status: string;
  if (live.fetchedAt === null) {
    status = live.error ? `Feed unavailable — ${live.error.message}` : 'Loading the feed…';
  } else if (live.error) {
    status = `Showing rows from ${formatRelative(new Date(live.fetchedAt).toISOString())} — last update failed (${live.error.message})`;
  } else if (isPaused) {
    status = `Paused — rows from ${formatRelative(new Date(live.fetchedAt).toISOString())}`;
  } else {
    status = `${live.rows.length} rows · updated ${formatRelative(new Date(live.fetchedAt).toISOString())}`;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2',
        className,
      )}
    >
      <span className="flex items-center gap-2">
        {isStale ? (
          <TriangleAlert className="size-3.5 text-verdict-flag" aria-hidden />
        ) : (
          <span
            className={cn(
              'size-2 rounded-full bg-verdict-clean',
              !still && 'animate-pulse',
            )}
            aria-hidden
          />
        )}
        <span
          className={cn('text-xs', isStale ? 'text-verdict-flag' : 'text-muted-foreground')}
          aria-live="polite"
          aria-atomic="true"
        >
          {status}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshNow}
          title="Refresh now"
          aria-label="Refresh the feed now"
        >
          <RotateCw aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isPaused}
          onClick={() => setPaused(!isPaused)}
        >
          {isPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {isPaused ? 'Resume live updates' : 'Pause live updates'}
        </Button>
      </div>
    </div>
  );
}
