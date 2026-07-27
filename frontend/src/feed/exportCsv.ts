import type { ClientFilters, ServerParams } from '@/hooks/useDetectionsQuery';
import type { DetectionRecord } from '@/lib/types';

/**
 * CSV export of the RENDERED rows (RB-5).
 *
 * Two properties make the file defensible as evidence:
 *
 *  - **It is the snapshot, not a new query.** The caller passes the same
 *    `visibleRows` derivation the table body rendered, so the file cannot
 *    disagree with the screen. No fetch happens here.
 *  - **It states its own coverage.** `GET /detections` returns no total, so the
 *    frontend genuinely cannot know whether the window is the whole result set.
 *    The `#` header lines carry the window, the filters, the snapshot time, and
 *    an explicit partial-coverage note, because a CSV that leaves the app loses
 *    every contextual cue the screen had.
 *
 * Spreadsheets treat the leading `#` lines as data rows — one "delete top rows"
 * step for the analyst, in exchange for a caveat that can't be separated from
 * the data. For a file that may end up in an incident record, that's the right
 * side of the trade.
 */

const COLUMNS = [
  'id',
  'created_at',
  'verdict',
  'likelihood',
  'subject',
  'from_addr',
  'to_addr',
  'source',
  'num_urls',
  'attachment_count',
  'email_score',
  'email_model',
  'review_status',
] as const;

/**
 * Quote every field, and neutralise formula injection: subjects and sender
 * addresses are attacker-controlled text, and Excel executes `=`/`+`/`-`/`@`
 * leading cells from a CSV.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw = String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export interface ExportContext {
  /** The rows on screen, in render order. */
  rows: DetectionRecord[];
  /** Rows in the loaded window before client-side filters. */
  loadedCount: number;
  fetchedAt: number | null;
  server: ServerParams;
  client: ClientFilters;
  /** True when the window is full, so more rows almost certainly exist. */
  atWindowEdge: boolean;
}

/** Human-readable description of what was applied, for the file header. */
export function describeFilters({ server, client }: Pick<ExportContext, 'server' | 'client'>): string {
  const parts: string[] = [];
  if (server.verdict) parts.push(`verdict=${server.verdict} (server)`);
  if (server.source) parts.push(`source=${server.source} (server)`);
  if (client.q) parts.push(`search="${client.q}" (loaded rows only)`);
  if (client.from) parts.push(`from=${client.from} (loaded rows only)`);
  if (client.to) parts.push(`to=${client.to} (loaded rows only)`);
  return parts.length ? parts.join(' · ') : 'none';
}

export function buildDetectionsCsv(ctx: ExportContext): string {
  const snapshotAt = ctx.fetchedAt ? new Date(ctx.fetchedAt).toISOString() : 'unknown';
  const coverage = ctx.atWindowEdge
    ? 'PARTIAL — the loaded window was full, so more matching detections almost certainly exist beyond it'
    : 'the loaded window only, which may not be every matching detection (the API returns no total)';

  const lines = [
    '# Email Security Pipeline — detections export (rendered view)',
    `# rows=${ctx.rows.length} of ${ctx.loadedCount} loaded · window=offset ${ctx.server.offset}, limit ${ctx.server.limit}`,
    `# filters: ${describeFilters(ctx)}`,
    `# snapshot fetched ${snapshotAt} · exported ${new Date().toISOString()}`,
    `# coverage: ${coverage}`,
    // Addresses are exported raw (not defanged) so they stay usable for
    // escalation and pivoting; extracted URLs are deliberately not exported.
    '# note: sender/recipient values are raw; leading =+-@ are prefixed with an apostrophe',
    COLUMNS.join(','),
  ];

  for (const row of ctx.rows) {
    lines.push(COLUMNS.map((col) => cell(row[col])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export function csvFilename(now = new Date()): string {
  const [date] = now.toISOString().split('T');
  return `detections-${date}.csv`;
}

/** Trigger the browser download. Client-side only — no endpoint involved. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
