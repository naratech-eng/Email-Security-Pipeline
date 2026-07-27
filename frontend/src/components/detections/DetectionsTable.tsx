import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { defangText } from '@/lib/defang';
import { formatDateTime, formatRelative } from '@/lib/format';
import { verdictMeta } from '@/lib/verdict';
import { cn } from '@/lib/utils';
import type { DetectionRecord, ReviewStatus } from '@/lib/types';

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  false_positive: 'False positive',
  confirmed: 'Confirmed',
};

/** Verdict-coloured likelihood meter. The number stays visible beside the bar —
 *  the bar alone would encode severity in colour and width only. */
function LikelihoodCell({ value, verdict }: { value: number; verdict: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = verdictMeta(verdict).colorVar;

  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-foreground">{pct}</span>
    </span>
  );
}

interface DetectionsTableProps {
  rows: DetectionRecord[];
  /** Ids that arrived on the latest poll — marked with a static left border. */
  arrivals: number[];
}

/**
 * The detections feed table (RB-4).
 *
 * A plain semantic `<table>`: eight fixed columns, one sort dimension (the
 * backend's own newest-first ordering), no virtualization — react-table would
 * add a dependency and earn nothing here, while the native table gets keyboard
 * and screen-reader behaviour for free.
 *
 * Two safety rules this component enforces:
 *  - sender addresses are DEFANGED and rendered as text; nothing in a row is a
 *    live link to attacker-controlled content (this is a phishing tool)
 *  - the only link is the drill-down to `/detections/:id` — a real `<Link>`, so
 *    middle-click, Cmd-click, and keyboard focus all work. The row-level click
 *    is convenience on top, never the only affordance.
 *
 * No `aria-live` here: the freshness region in `FeedStatusBar` announces
 * changes, and marking the body live would make a screen reader re-read every
 * cell on every poll.
 */
export function DetectionsTable({ rows, arrivals }: DetectionsTableProps) {
  const navigate = useNavigate();
  const showReview = rows.some((row) => row.review_status);

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, id: number) {
    // The subject cell's <Link> handles its own navigation (and modifier-clicks).
    if ((event.target as HTMLElement).closest('a')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    navigate(`/detections/${id}`);
  }

  return (
    // Columns stay put at small widths and the table scrolls instead: verdict,
    // source, and URL count are the triage signals, so hiding them is worse
    // than a horizontal scroll.
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <caption className="sr-only">
          Scored mail, newest first. Select a row to open its full analysis.
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Time
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              Verdict
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              Likelihood
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              Subject
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              From
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              To
            </th>
            <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
              Source
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground"
            >
              URLs
            </th>
            {showReview && (
              <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Review
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = verdictMeta(row.verdict);
            const isNew = arrivals.includes(row.id);

            return (
              <tr
                // Stable key so a poll updates rows in place and never steals
                // focus from a row the analyst is tabbed onto.
                key={row.id}
                onClick={(event) => onRowClick(event, row.id)}
                className={cn(
                  'cursor-pointer border-b border-border/60 last:border-b-0 transition-colors hover:bg-surface-2',
                  // Static border, not an animation: under reduced motion (and
                  // in a throttled background tab) an animated cue never plays.
                  isNew && 'border-l-2 border-l-primary bg-primary/[0.03]',
                )}
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  <span title={formatDateTime(row.created_at)}>
                    {formatRelative(row.created_at)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <LikelihoodCell value={row.likelihood} verdict={row.verdict} />
                </td>
                <td className="max-w-[22rem] px-3 py-2.5">
                  <Link
                    to={`/detections/${row.id}`}
                    className="block truncate text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    title={row.subject ?? undefined}
                  >
                    {row.subject || '(no subject)'}
                  </Link>
                </td>
                {/* Defanged, plain text — never an anchor. */}
                <td className="max-w-[16rem] px-3 py-2.5">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {row.from_addr ? defangText(row.from_addr) : '—'}
                  </span>
                </td>
                <td className="max-w-[14rem] px-3 py-2.5">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {row.to_addr ? defangText(row.to_addr) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline">
                    {row.source === 'server' ? 'Mail server' : 'Upload'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                  {row.num_urls}
                </td>
                {showReview && (
                  <td className="px-3 py-2.5">
                    {row.review_status ? (
                      <Badge
                        variant={row.review_status === 'confirmed' ? 'quarantine' : 'clean'}
                      >
                        {REVIEW_LABEL[row.review_status]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
