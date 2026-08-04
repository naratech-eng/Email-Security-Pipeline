import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DetectionsTrend } from '@/components/overview/DetectionsTrend';
import { RecentActivity } from '@/components/overview/RecentActivity';
import { StatTile } from '@/components/overview/StatTile';
import { SystemStatusCard } from '@/components/overview/SystemStatusCard';
import { VerdictDonut } from '@/components/overview/VerdictDonut';
import { useDetectionsFeed, STALE_AFTER_MS } from '@/feed/DetectionsFeedProvider';
import { useNow } from '@/hooks/useNow';
import { useOverviewStats } from '@/hooks/useOverviewStats';
import { STATS_WINDOWS, type StatsWindow } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { verdictMeta } from '@/lib/verdict';
import { cn } from '@/lib/utils';

/**
 * The Overview wall — orchestration only; every surface owns its own state.
 *
 * Two data sources, deliberately kept distinct:
 *  - **aggregates** (`useOverviewStats`) for the tiles, trend, and donut, so
 *    counts and proportions are real totals rather than a sample of whatever
 *    the feed most recently loaded;
 *  - **the shared feed snapshot** for recent activity, which keeps slice 4's
 *    one-poll invariant intact — this route adds exactly one request.
 *
 * Freshness is deliberately NOT unified: aggregates are stamped with the
 * server's `generatedAt`, the feed with its own client-side `fetchedAt`. Both
 * are honest for their own surface and neither can stand in for the other.
 */

const WINDOW_LABEL: Record<StatsWindow, string> = {
  24: '24h',
  72: '3d',
  168: '7d',
};

export default function Overview() {
  const {
    stats,
    isInitialLoading,
    degradedMessage,
    isDegraded,
    windowHours,
    setWindowHours,
    refresh,
  } = useOverviewStats();
  const { live } = useDetectionsFeed();

  // Re-read the clock every 5s so relative freshness text stays truthful
  // between polls — the same interval FeedStatusBar uses for the same reason.
  const now = useNow();

  const feedAge = live.fetchedAt === null ? null : now - live.fetchedAt;
  const isStale = live.error !== null || (feedAge !== null && feedAge > STALE_AFTER_MS);
  const basis = stats?.windowLabel ?? 'unavailable';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Live detection activity across the mail pipeline and manual analysis.
          </p>
        </div>

        {/* Window selector — the denominator every aggregate tile inherits.
            Disabled while degraded: the fallback derives from the loaded feed
            rows, which the window can't narrow, so an enabled control would
            promise something it cannot do. */}
        <div
          className="flex rounded-lg border border-border bg-surface p-0.5"
          role="group"
          aria-label="Summary window"
          title={isDegraded ? 'Unavailable while summary totals are missing' : undefined}
        >
          {STATS_WINDOWS.map((hours) => (
            <button
              key={hours}
              type="button"
              disabled={isDegraded}
              aria-pressed={windowHours === hours}
              onClick={() => setWindowHours(hours)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                windowHours === hours
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-surface-2',
                isDegraded && 'cursor-not-allowed opacity-40 hover:bg-transparent',
              )}
            >
              {WINDOW_LABEL[hours]}
            </button>
          ))}
        </div>
      </div>

      {/* One freshness line for the whole wall, keyed off the feed snapshot —
          amber past the stale threshold rather than a pulse that keeps claiming
          "live" after the poll stopped succeeding. */}
      <p
        className={cn(
          'text-xs',
          isStale ? 'text-verdict-flag' : 'text-muted-foreground',
        )}
      >
        {live.fetchedAt === null
          ? 'Loading the feed…'
          : isStale
            ? `Stale — feed last updated ${formatRelative(new Date(live.fetchedAt).toISOString())}`
            : `Feed updated ${formatRelative(new Date(live.fetchedAt).toISOString())}`}
        {stats?.generatedAt && ` · summary ${formatRelative(stats.generatedAt)}`}
      </p>

      {/* Degraded banner: the wall is showing a window sample, and says so
          rather than passing it off as a total. */}
      {isDegraded && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-verdict-flag/30 bg-verdict-flag/5 px-3 py-2 text-xs">
          <TriangleAlert className="size-4 shrink-0 text-verdict-flag" aria-hidden />
          <span className="text-muted-foreground">
            {degradedMessage ?? 'Summary totals are unavailable'}. Showing what the{' '}
            {basis} in view supports instead — these are a sample, not totals.
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={refresh}>
            <RotateCw aria-hidden />
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Detections"
          value={stats?.total ?? null}
          basis={basis}
          loading={isInitialLoading}
        />
        <StatTile
          label="Quarantined"
          value={stats?.byVerdict.quarantine ?? null}
          basis={basis}
          loading={isInitialLoading}
          accentVar={verdictMeta('quarantine').colorVar}
          to="/detections?verdict=quarantine"
        />
        <StatTile
          label="Flagged"
          value={stats?.byVerdict.flag ?? null}
          basis={basis}
          loading={isInitialLoading}
          accentVar={verdictMeta('flag').colorVar}
          to="/detections?verdict=flag"
        />
        <StatTile
          label="From mail server"
          value={stats?.bySource.server ?? null}
          basis={basis}
          loading={isInitialLoading}
          to="/detections?source=server"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DetectionsTrend stats={stats} loading={isInitialLoading} />
        </div>
        <VerdictDonut stats={stats} loading={isInitialLoading} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <SystemStatusCard
          stats={stats}
          loading={isInitialLoading}
          isDegraded={isDegraded}
        />
      </div>

      {/* The reviewed-precision tile is intentionally absent: review persistence
          does not exist yet (no column, write path, read path, or endpoint), so
          the stats contract returns `reviewed: null` and there is nothing
          honest to show. It appears on its own once that lands. */}
    </div>
  );
}
