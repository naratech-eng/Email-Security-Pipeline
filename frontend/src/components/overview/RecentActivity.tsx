import { Link } from 'react-router';
import { ArrowRight, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import { formatRelative } from '@/lib/format';
import { verdictMeta } from '@/lib/verdict';

/** How many of the live window's newest rows the wall shows. */
const ROWS = 6;

/**
 * The newest detections, read straight from the shared feed snapshot.
 *
 * This component does NOT fetch. Slice 4 made `DetectionsFeedProvider` the sole
 * owner of `listDetections`, so the table, the nav badge, the quarantine bell,
 * and this list all derive from one 30s poll and can never disagree about what
 * the feed contains.
 *
 * A failed poll keeps the last good rows on screen (the snapshot holds `rows`
 * and `error` separately by design) — the freshness line elsewhere on the wall
 * says how old they are. Only a failure with nothing ever loaded renders as an
 * error, because that is the one case where we genuinely have nothing to show.
 */
export function RecentActivity() {
  const { live, isInitialLoading } = useDetectionsFeed();
  const rows = live.rows.slice(0, ROWS);
  const nothingEverLoaded = live.error !== null && live.rows.length === 0;

  return (
    <section
      className="panel-elevated rounded-xl border border-border bg-surface p-4"
      aria-labelledby="activity-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activity-heading" className="text-sm font-semibold text-foreground">
          Recent activity
        </h2>
        <Link
          to="/detections"
          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </div>

      {isInitialLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : nothingEverLoaded ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <TriangleAlert className="size-5 text-verdict-flag" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Couldn’t load the feed — {live.error?.message}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            No detections yet — the pipeline populates this as mail is scored.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => {
            const meta = verdictMeta(row.verdict);
            return (
              <li key={row.id}>
                <Link
                  to={`/detections/${row.id}`}
                  className="flex items-center gap-3 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.colorVar }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground">
                      {row.subject || '(no subject)'}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {row.from_addr || 'unknown sender'}
                    </p>
                  </div>
                  {/* Verdict named, not just coloured — the swatch alone cannot
                      carry identity in the light theme. */}
                  <span
                    className="shrink-0 text-[11px] font-medium"
                    style={{ color: meta.colorVar }}
                  >
                    {meta.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelative(row.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link to="/detections">
            Open the detections feed
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
    </section>
  );
}
