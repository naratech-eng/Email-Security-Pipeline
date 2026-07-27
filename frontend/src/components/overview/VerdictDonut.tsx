import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { prefersReducedMotion } from '@/lib/motion';
import { verdictMeta } from '@/lib/verdict';
import type { OverviewStats, Verdict } from '@/lib/types';

/**
 * Verdict split for the window, as a donut plus a labelled, clickable legend.
 *
 * **The legend is not decoration.** Running the palette through a CVD check,
 * the light theme's `flag` (#b45309) and `quarantine` (#dc2626) separate by
 * ΔE 9.9 for normal vision and 2.8 under deuteranopia — below the readable
 * floor. The palette is fixed by the design spec and not ours to change, so
 * identity has to be carried by the written label and count beside each swatch,
 * never by the arc colour alone.
 *
 * Counts sit beside percentages for the same reason RB-7 asks for it: "75%" is
 * a confident-sounding way to say "3 of 4".
 */

const ORDER: Verdict[] = ['quarantine', 'flag', 'clean'];

interface VerdictDonutProps {
  stats: OverviewStats | null;
  loading: boolean;
}

interface Slice {
  verdict: Verdict;
  label: string;
  count: number;
  color: string;
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const pct = total > 0 ? Math.round((slice.count / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-2 text-foreground">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        {slice.label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
        {slice.count.toLocaleString()}{' '}
        <span className="text-muted-foreground">({pct}%)</span>
      </p>
    </div>
  );
}

export function VerdictDonut({ stats, loading }: VerdictDonutProps) {
  const navigate = useNavigate();

  const slices: Slice[] = ORDER.map((verdict) => {
    const meta = verdictMeta(verdict);
    return {
      verdict,
      label: meta.label,
      count: stats?.byVerdict[verdict] ?? 0,
      color: meta.colorVar,
    };
  });
  const total = stats?.total ?? 0;
  const drawn = slices.filter((s) => s.count > 0);

  return (
    <section
      className="panel-elevated rounded-xl border border-border bg-surface p-4"
      aria-labelledby="verdict-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="verdict-heading" className="text-sm font-semibold text-foreground">
          Verdicts
        </h2>
        <p className="text-xs text-muted-foreground">
          {stats ? stats.windowLabel : 'unavailable'}
        </p>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="size-32 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ) : !stats ? (
        <p className="mt-6 text-xs text-muted-foreground">
          Couldn’t load the verdict split.
        </p>
      ) : total === 0 ? (
        <p className="mt-6 text-xs text-muted-foreground">
          No detections to break down in this window.
        </p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          {/* Fixed dimensions, not ResponsiveContainer: as a flex item with no
              intrinsic size, the container measured 0 on first paint and the
              arcs never drew. The donut is a fixed-size mark, so there is
              nothing to make responsive. */}
          <div className="shrink-0">
            <PieChart width={128} height={128}>
                <Pie
                  data={drawn}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={64}
                  // A 2px surface gap between segments so adjacent arcs read as
                  // separate even when their hues are close.
                  paddingAngle={2}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={!prefersReducedMotion()}
                  onClick={(entry: unknown) =>
                    navigate(`/detections?verdict=${(entry as Slice).verdict}`)
                  }
                  className="cursor-pointer focus:outline-none"
                >
                  {drawn.map((slice) => (
                    <Cell key={slice.verdict} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
            </PieChart>
          </div>

          {/* Labelled legend — the load-bearing identity channel, not the colour. */}
          <ul className="w-full flex-1 space-y-1">
            {slices.map((slice) => {
              const pct = total > 0 ? Math.round((slice.count / total) * 100) : 0;
              return (
                <li key={slice.verdict}>
                  <button
                    type="button"
                    onClick={() => navigate(`/detections?verdict=${slice.verdict}`)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-foreground">{slice.label}</span>
                    <span className="ml-auto font-mono tabular-nums text-foreground">
                      {slice.count.toLocaleString()}
                    </span>
                    <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
