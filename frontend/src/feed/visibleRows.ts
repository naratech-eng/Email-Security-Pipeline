import type { ClientFilters } from '@/hooks/useDetectionsQuery';
import type { DetectionRecord } from '@/lib/types';

/**
 * Apply the client-only filters (free text + date range) to a loaded window.
 *
 * This is deliberately ONE derivation: the table body, the row count, and (in a
 * later PR) the CSV export all read the same function, so the file can never
 * disagree with the screen. It narrows only the rows already fetched — the API
 * has no search or date parameters — which is why callers must show the
 * loaded-window denominator alongside any count derived from it.
 */
export function visibleRows(
  rows: DetectionRecord[],
  { q, from, to }: ClientFilters,
): DetectionRecord[] {
  const needle = q.trim().toLowerCase();
  // Dates are inclusive: `to=2026-07-26` keeps everything on the 26th.
  const fromMs = from ? Date.parse(`${from}T00:00:00`) : null;
  const toMs = to ? Date.parse(`${to}T23:59:59.999`) : null;

  return rows.filter((row) => {
    if (needle) {
      const haystack = `${row.subject ?? ''} ${row.from_addr ?? ''} ${row.to_addr ?? ''}`;
      if (!haystack.toLowerCase().includes(needle)) return false;
    }
    if (fromMs !== null || toMs !== null) {
      const at = Date.parse(row.created_at);
      if (Number.isNaN(at)) return false;
      if (fromMs !== null && at < fromMs) return false;
      if (toMs !== null && at > toMs) return false;
    }
    return true;
  });
}

/** True when a client-only filter is narrowing the loaded window. */
export function hasClientFilters({ q, from, to }: ClientFilters): boolean {
  return Boolean(q || from || to);
}
