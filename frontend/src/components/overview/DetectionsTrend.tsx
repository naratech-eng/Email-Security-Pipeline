import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { prefersReducedMotion } from '@/lib/motion';
import type { OverviewStats } from '@/lib/types';

/**
 * Detection volume over time — one series, so no legend (the heading names it).
 *
 * Buckets arrive pre-computed on absolute wall-clock boundaries (server-side on
 * the aggregate path, `fromWindow` on the degraded one) and already zero-filled.
 * This component does no time math at all: any bucketing done here would run on
 * every render and re-introduce exactly the drift the fixed boundaries prevent.
 *
 * Volume only, deliberately. The stats contract returns one count per bucket,
 * not a per-verdict breakdown, so a stacked verdict chart would have to invent
 * the split. Verdict identity and its click-through live on the donut, where
 * the numbers are real.
 */

interface DetectionsTrendProps {
  stats: OverviewStats | null;
  loading: boolean;
}

interface Point {
  bucketStart: number;
  count: number;
}

function TrendTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  unit: 'hour' | 'day';
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const when = new Date(point.bucketStart);
  const label =
    unit === 'hour'
      ? when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })
      : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {point.count.toLocaleString()} detection{point.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function DetectionsTrend({ stats, loading }: DetectionsTrendProps) {
  const data = stats?.series ?? [];

  // Daily buckets whenever the span is wider than ~2 days; drives tick labels
  // and the tooltip's date format.
  const unit: 'hour' | 'day' = useMemo(() => {
    if (data.length < 2) return 'hour';
    return data[1].bucketStart - data[0].bucketStart >= 86_400_000 ? 'day' : 'hour';
  }, [data]);

  const tick = (value: number) => {
    const d = new Date(value);
    return unit === 'hour'
      ? d.toLocaleTimeString(undefined, { hour: 'numeric' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <section
      className="panel-elevated rounded-xl border border-border bg-surface p-4"
      aria-labelledby="trend-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="trend-heading" className="text-sm font-semibold text-foreground">
          Detections over time
        </h2>
        <p className="text-xs text-muted-foreground">
          {stats ? stats.windowLabel : 'unavailable'}
        </p>
      </div>

      <div className="mt-3 h-48">
        {loading ? (
          <Skeleton className="size-full rounded-lg" />
        ) : data.length === 0 ? (
          <div className="flex size-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-xs text-muted-foreground">
              {stats ? 'No detections in this window.' : 'Couldn’t load the trend.'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              {/* Recessive grid: horizontal only, so the bars carry the eye. */}
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="bucketStart"
                tickFormatter={tick}
                stroke="var(--chart-grid)"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                width={44}
                stroke="var(--chart-grid)"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<TrendTooltip unit={unit} />}
                cursor={{ fill: 'var(--surface-2)' }}
              />
              <Bar
                dataKey="count"
                fill="var(--primary)"
                // Rounded data-end anchored to the baseline.
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                isAnimationActive={!prefersReducedMotion()}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
