import type {
  DetectionRecord,
  DetectionSource,
  DetectionStatsResponse,
  OverviewStats,
  Verdict,
} from '@/lib/types';

/**
 * Adapters that produce the ONE `OverviewStats` view-model the Overview wall
 * reads, from either of its two possible sources.
 *
 * Kept out of `normalize.ts` deliberately: that module exists to guarantee a
 * stored detection and a live analyze result render identically through
 * `ResultDisplay`. Aggregates have no such parity contract and no shape in
 * common with `AnalysisResult`, so mixing them would blur the boundary rather
 * than share anything.
 *
 * The two sources make DIFFERENT claims, and `basis` is what records which:
 *  - `fromStats`  — real window-scoped totals from `GET /detections/stats`.
 *  - `fromWindow` — a degraded read of the shared feed's loaded rows, used when
 *    the aggregate call fails but the feed still has data. Every figure it
 *    produces is a sample of the most recent N rows, which is why its
 *    `windowLabel` names the row count instead of a time span.
 *
 * Both are pure — same inputs, same output, no clock reads except the one
 * explicitly passed in — so the bucketing can be tested for stability.
 */

const HOUR_MS = 3_600_000;

// Spread-before-payload so a backend that ever omits a key yields 0 rather
// than undefined, without the tiles having to guard every read.
const EMPTY_VERDICTS: Record<Verdict, number> = { clean: 0, flag: 0, quarantine: 0 };
const EMPTY_SOURCES: Record<DetectionSource, number> = { server: 0, upload: 0 };

function windowLabelFor(hours: number): string {
  if (hours <= 24) return 'last 24h';
  if (hours < 168) return `last ${Math.round(hours / 24)} days`;
  return 'last 7 days';
}

/** The aggregate path: the wall may state real totals over a real time window. */
export function fromStats(res: DetectionStatsResponse): OverviewStats {
  return {
    basis: 'aggregate',
    windowLabel: windowLabelFor(res.window_hours),
    total: res.total,
    byVerdict: { ...EMPTY_VERDICTS, ...res.by_verdict },
    bySource: { ...EMPTY_SOURCES, ...res.by_source },
    series: res.series.map((p) => ({
      bucketStart: Date.parse(p.bucket_start),
      count: p.count,
    })),
    newestAt: res.newest_at,
    newestServerAt: res.newest_server_at,
    generatedAt: res.generated_at,
    reviewed: null,
  };
}

/** Floor to an absolute hour boundary — never relative to "now". */
function bucketOf(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

/**
 * The degraded path: derive what we can from the rows the shared feed already
 * loaded, and label everything with the row count so no figure reads as a total.
 *
 * `limit` is the page size the feed requested. When the window came back full,
 * its oldest bucket is truncated by the cap rather than genuinely small, so it
 * is dropped — rendering a partial bucket beside complete ones draws a cliff
 * that reads as "traffic stopped" when it only means "the window ended here".
 */
export function fromWindow(rows: DetectionRecord[], limit: number): OverviewStats {
  const byVerdict = { ...EMPTY_VERDICTS };
  const bySource = { ...EMPTY_SOURCES };
  const counts = new Map<number, number>();
  let newestAt: number | null = null;
  let newestServerAt: number | null = null;

  for (const row of rows) {
    byVerdict[row.verdict] = (byVerdict[row.verdict] ?? 0) + 1;
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;

    const at = Date.parse(row.created_at);
    if (Number.isNaN(at)) continue;

    const bucket = bucketOf(at);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);

    if (newestAt === null || at > newestAt) newestAt = at;
    if (row.source === 'server' && (newestServerAt === null || at > newestServerAt)) {
      newestServerAt = at;
    }
  }

  const series: OverviewStats['series'] = [];
  if (counts.size > 0) {
    const buckets = [...counts.keys()].sort((a, b) => a - b);
    // Zero-fill: an absent hour must render as a zero bar, or the axis
    // compresses and a quiet night reads as continuous activity.
    let first = buckets[0];
    const last = buckets[buckets.length - 1];
    if (rows.length >= limit && buckets.length > 1) first += HOUR_MS;
    for (let at = first; at <= last; at += HOUR_MS) {
      series.push({ bucketStart: at, count: counts.get(at) ?? 0 });
    }
  }

  return {
    basis: 'window',
    windowLabel: `last ${rows.length} detection${rows.length === 1 ? '' : 's'}`,
    total: rows.length,
    byVerdict,
    bySource,
    series,
    newestAt: newestAt === null ? null : new Date(newestAt).toISOString(),
    // Null here means "not knowable from this window" — a burst of analyst
    // uploads can push every server row out of it while the pipeline is fine.
    newestServerAt:
      newestServerAt === null ? null : new Date(newestServerAt).toISOString(),
    // No server clock on this path, so freshness has to come from the feed
    // snapshot's own `fetchedAt` rather than from the data.
    generatedAt: null,
    reviewed: null,
  };
}
