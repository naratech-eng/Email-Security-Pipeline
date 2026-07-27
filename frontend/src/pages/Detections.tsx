import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DetectionsTable } from '@/components/detections/DetectionsTable';
import { ExportCsvButton } from '@/components/detections/ExportCsvButton';
import { FeedStatusBar } from '@/components/detections/FeedStatusBar';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import { hasClientFilters, visibleRows } from '@/feed/visibleRows';
import { useDetectionsQuery } from '@/hooks/useDetectionsQuery';
import { verdictMeta } from '@/lib/verdict';
import { cn } from '@/lib/utils';
import type { DetectionSource, Verdict } from '@/lib/types';

const SOURCE_TABS: { label: string; value: DetectionSource | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Mail server', value: 'server' },
  { label: 'Manual uploads', value: 'upload' },
];

const VERDICT_CHIPS: Verdict[] = ['quarantine', 'flag', 'clean'];

/**
 * The Detections workspace — slice 4, PR 1 (state spine).
 *
 * This page owns NO fetching: rows come from the shared feed snapshot that the
 * shell's provider polls, and every filter lives in the URL via
 * `useDetectionsQuery()`. The row rendering here is deliberately minimal — the
 * semantic eight-column table lands in the next PR — so this pass can be
 * verified on the behaviors that are hard to retrofit: one poll, honest
 * freshness, validated URL state, and a frozen view past page 1.
 */
export default function Detections() {
  const { server, client, isLatest, setFilters, setPage, returnToLatest } =
    useDetectionsQuery();
  const { live, page, isInitialLoading, arrivals, refreshNow } = useDetectionsFeed();

  // The search field owns its own text and writes to the URL on a short debounce.
  // Binding the input straight to `client.q` makes React reset the field to the
  // still-echoing URL value between keystrokes, which drops characters when you
  // type fast or paste. The URL stays the shareable store; the field stays local.
  const [qDraft, setQDraft] = useState(client.q);
  const qDraftRef = useRef(qDraft);
  qDraftRef.current = qDraft;

  // Adopt external changes to `q` (Back/Forward, the clear button, a pasted link)
  // without clobbering what the analyst is mid-way through typing.
  useEffect(() => {
    if (client.q !== qDraftRef.current) setQDraft(client.q);
  }, [client.q]);

  useEffect(() => {
    if (qDraft === client.q) return;
    const id = window.setTimeout(() => setFilters({ q: qDraft }, { replace: true }), 250);
    return () => window.clearTimeout(id);
  }, [client.q, qDraft, setFilters]);

  // Past page 1 the analyst is mid-task, so they read the frozen page snapshot
  // while the live poll keeps the chrome (and the new-arrival count) current.
  const snapshot = isLatest ? live : (page ?? { ...live, rows: [] });
  const rows = useMemo(() => visibleRows(snapshot.rows, client), [client, snapshot.rows]);
  const narrowed = hasClientFilters(client);
  const loadedCount = snapshot.rows.length;
  const atWindowEdge = loadedCount === server.limit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Detections</h1>
          <p className="text-sm text-muted-foreground">
            Every message the mail server scores lands here automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportCsvButton
            rows={rows}
            loadedCount={loadedCount}
            fetchedAt={snapshot.fetchedAt}
            server={server}
            client={client}
            atWindowEdge={atWindowEdge}
          />

          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={server.source === tab.value}
                onClick={() => setFilters({ source: tab.value ?? null })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  server.source === tab.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-surface-2',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <FeedStatusBar />

      {!isLatest && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Viewing rows {server.offset + 1}–{server.offset + loadedCount}. This page stays
            still while you work
            {arrivals.length > 0 && ` — ${arrivals.length} newer detection${arrivals.length === 1 ? '' : 's'} arrived`}
            .
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={returnToLatest}>
            <ArrowDown aria-hidden />
            Return to latest
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {VERDICT_CHIPS.map((verdict) => {
          const meta = verdictMeta(verdict);
          const active = server.verdict === verdict;
          return (
            <button
              key={verdict}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters({ verdict: active ? null : verdict })}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-[color:var(--v)]/40 bg-[color:var(--v)]/10 text-[color:var(--v)]'
                  : 'border-border text-muted-foreground hover:bg-surface-2',
              )}
              style={{ ['--v' as string]: meta.colorVar }}
            >
              {meta.label}
            </button>
          );
        })}

        {/* Client-only filters. The placeholder names their scope, because the
            API has no search or date params and a zero result here means "not in
            the loaded rows", never "no such mail". */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder={`Search the ${loadedCount} loaded rows`}
            className="h-8 w-56 text-xs"
            aria-label={`Search the ${loadedCount} loaded rows by subject or address`}
          />
          <Input
            type="date"
            value={client.from}
            onChange={(e) => setFilters({ from: e.target.value })}
            className="h-8 w-36 text-xs"
            aria-label="From date (loaded rows only)"
          />
          <Input
            type="date"
            value={client.to}
            onChange={(e) => setFilters({ to: e.target.value })}
            className="h-8 w-36 text-xs"
            aria-label="To date (loaded rows only)"
          />
        </div>
      </div>

      {narrowed && (
        <p className="text-xs text-muted-foreground">
          {rows.length} of {loadedCount} loaded rows match
          {server.verdict && ` · verdict=${server.verdict} applied server-side`}
          {server.source && ` · source=${server.source} applied server-side`}. Search and
          date filters narrow only the rows already loaded.
        </p>
      )}

      {isInitialLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
          {snapshot.error && loadedCount === 0 ? (
            <TriangleAlert className="size-6 text-verdict-flag" aria-hidden />
          ) : (
            <ShieldAlert className="size-6 text-muted-foreground" aria-hidden />
          )}
          <p className="text-sm text-muted-foreground">
            {/* An unreachable feed must never read as an empty one — zero rows
                plus an error means "we don't know", not "there's nothing". */}
            {snapshot.error && loadedCount === 0
              ? `Couldn’t load the feed — ${snapshot.error.message}`
              : narrowed
                ? `No match in the ${loadedCount} loaded rows. Clear the search or load more rows.`
                : 'No detections in this window yet.'}
          </p>
          {snapshot.error && loadedCount === 0 ? (
            <Button variant="outline" size="sm" onClick={refreshNow}>
              <RotateCw aria-hidden />
              Try again
            </Button>
          ) : (
            narrowed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQDraft('');
                  setFilters({ q: null, from: null, to: null });
                }}
              >
                Clear search filters
              </Button>
            )
          )}
        </div>
      ) : (
        <DetectionsTable rows={rows} arrivals={arrivals} />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page size {server.limit}
          {atWindowEdge && ' · more rows likely exist beyond this window'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={server.offset === 0}
            onClick={() => setPage(Math.max(0, server.offset - server.limit))}
          >
            <ArrowLeft aria-hidden />
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!atWindowEdge}
            onClick={() => setPage(server.offset + server.limit)}
          >
            Older
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
