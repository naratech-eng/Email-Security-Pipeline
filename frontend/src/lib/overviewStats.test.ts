import { describe, expect, it } from 'vitest';
import { fromStats, fromWindow } from '@/lib/overviewStats';
import type { DetectionRecord, DetectionStatsResponse } from '@/lib/types';

/**
 * The bucketing in `fromWindow` is the code most likely to be subtly wrong and
 * least likely to look wrong on screen: a drifting boundary just makes the
 * chart twitch, and a missing zero-fill just makes a quiet night look busy.
 * These tests pin both.
 */

function record(over: Partial<DetectionRecord> = {}): DetectionRecord {
  return {
    id: 1,
    created_at: '2026-07-27T10:30:00.000Z',
    source: 'server',
    submitted_by: null,
    verdict: 'clean',
    likelihood: 12,
    summary: 's',
    remediation: 'r',
    from_addr: null,
    to_addr: null,
    subject: null,
    email_date: null,
    num_urls: 0,
    attachment_count: 0,
    email_score: null,
    email_model: null,
    email_reason: null,
    email_features: null,
    urls: [],
    ...over,
  };
}

const STATS: DetectionStatsResponse = {
  window_hours: 24,
  window_start: '2026-07-26T20:00:00+00:00',
  bucket_unit: 'hour',
  generated_at: '2026-07-27T20:23:51.802989+00:00',
  total: 3,
  by_verdict: { clean: 1, flag: 1, quarantine: 1 },
  by_source: { server: 2, upload: 1 },
  series: [
    { bucket_start: '2026-07-27T09:00:00+00:00', count: 1 },
    { bucket_start: '2026-07-27T10:00:00+00:00', count: 2 },
  ],
  newest_at: '2026-07-27T10:30:00+00:00',
  newest_server_at: '2026-07-27T10:30:00+00:00',
  reviewed: null,
};

describe('fromStats', () => {
  it('maps the aggregate payload and claims the aggregate basis', () => {
    const out = fromStats(STATS);

    expect(out.basis).toBe('aggregate');
    expect(out.total).toBe(3);
    expect(out.byVerdict).toEqual({ clean: 1, flag: 1, quarantine: 1 });
    expect(out.bySource).toEqual({ server: 2, upload: 1 });
    expect(out.newestServerAt).toBe('2026-07-27T10:30:00+00:00');
    expect(out.generatedAt).toBe(STATS.generated_at);
    expect(out.reviewed).toBeNull();
  });

  it('converts the series to epoch ms in order', () => {
    const out = fromStats(STATS);

    expect(out.series).toEqual([
      { bucketStart: Date.parse('2026-07-27T09:00:00+00:00'), count: 1 },
      { bucketStart: Date.parse('2026-07-27T10:00:00+00:00'), count: 2 },
    ]);
  });

  it.each([
    [24, 'last 24h'],
    [72, 'last 3 days'],
    [168, 'last 7 days'],
  ])('labels a %i-hour window as "%s"', (hours, label) => {
    expect(fromStats({ ...STATS, window_hours: hours }).windowLabel).toBe(label);
  });
});

describe('fromWindow', () => {
  it('tallies verdicts and sources from the loaded rows', () => {
    const out = fromWindow(
      [
        record({ id: 1, verdict: 'clean', source: 'server' }),
        record({ id: 2, verdict: 'quarantine', source: 'upload' }),
        record({ id: 3, verdict: 'quarantine', source: 'server' }),
      ],
      50,
    );

    expect(out.basis).toBe('window');
    expect(out.total).toBe(3);
    expect(out.byVerdict).toEqual({ clean: 1, flag: 0, quarantine: 2 });
    expect(out.bySource).toEqual({ server: 2, upload: 1 });
  });

  it('names the row count as its denominator, never a time span', () => {
    expect(fromWindow([record()], 50).windowLabel).toBe('last 1 detection');
    expect(fromWindow([record(), record()], 50).windowLabel).toBe('last 2 detections');
  });

  it('buckets on absolute boundaries, so repeated polls produce identical buckets', () => {
    // The same rows, derived twice — as two 30s-apart polls would. Nothing in
    // the output may depend on when the derivation ran.
    const rows = [
      record({ id: 1, created_at: '2026-07-27T10:05:00.000Z' }),
      record({ id: 2, created_at: '2026-07-27T10:55:00.000Z' }),
    ];

    const first = fromWindow(rows, 50);
    const second = fromWindow(rows, 50);

    expect(first.series).toEqual(second.series);
    // Both rows fall in the 10:00 hour — the boundary is the hour, not "now".
    expect(first.series).toEqual([
      { bucketStart: Date.parse('2026-07-27T10:00:00.000Z'), count: 2 },
    ]);
  });

  it('zero-fills the gaps so a quiet hour is a zero bar, not an absent one', () => {
    const out = fromWindow(
      [
        record({ id: 1, created_at: '2026-07-27T08:10:00.000Z' }),
        record({ id: 2, created_at: '2026-07-27T11:10:00.000Z' }),
      ],
      50,
    );

    expect(out.series.map((p) => p.count)).toEqual([1, 0, 0, 1]);
    // Contiguous, one hour apart, ascending.
    const starts = out.series.map((p) => p.bucketStart);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i] - starts[i - 1]).toBe(3_600_000);
    }
  });

  it('drops the oldest bucket when the window is saturated', () => {
    // rows.length === limit means the feed hit its cap, so the earliest hour is
    // truncated by the page size rather than genuinely quiet.
    const rows = [
      record({ id: 1, created_at: '2026-07-27T08:10:00.000Z' }),
      record({ id: 2, created_at: '2026-07-27T09:10:00.000Z' }),
      record({ id: 3, created_at: '2026-07-27T10:10:00.000Z' }),
    ];

    const saturated = fromWindow(rows, 3);
    const notSaturated = fromWindow(rows, 50);

    expect(saturated.series.map((p) => p.bucketStart)).toEqual([
      Date.parse('2026-07-27T09:00:00.000Z'),
      Date.parse('2026-07-27T10:00:00.000Z'),
    ]);
    expect(notSaturated.series).toHaveLength(3);
  });

  it('reports newestServerAt only when a server row is actually present', () => {
    const uploadsOnly = fromWindow(
      [record({ source: 'upload', submitted_by: 'analyst@example.com' })],
      50,
    );
    expect(uploadsOnly.newestAt).not.toBeNull();
    expect(uploadsOnly.newestServerAt).toBeNull();

    const withServer = fromWindow(
      [
        record({ id: 1, source: 'upload', created_at: '2026-07-27T11:00:00.000Z' }),
        record({ id: 2, source: 'server', created_at: '2026-07-27T09:00:00.000Z' }),
      ],
      50,
    );
    expect(withServer.newestServerAt).toBe('2026-07-27T09:00:00.000Z');
  });

  it('never claims a server clock it does not have', () => {
    expect(fromWindow([record()], 50).generatedAt).toBeNull();
  });

  it('returns a valid zeroed shape for an empty window', () => {
    const out = fromWindow([], 50);

    expect(out.total).toBe(0);
    expect(out.byVerdict).toEqual({ clean: 0, flag: 0, quarantine: 0 });
    expect(out.series).toEqual([]);
    expect(out.newestAt).toBeNull();
    expect(out.newestServerAt).toBeNull();
  });

  it('ignores rows with an unparsable timestamp instead of poisoning the series', () => {
    const out = fromWindow(
      [record({ id: 1, created_at: 'not-a-date' }), record({ id: 2 })],
      50,
    );

    expect(out.total).toBe(2); // still counted in the tallies
    expect(out.series).toHaveLength(1); // but absent from the chart
    expect(out.series[0].count).toBe(1);
  });
});
