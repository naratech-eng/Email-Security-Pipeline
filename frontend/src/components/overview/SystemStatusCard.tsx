import { CircleCheck, CircleHelp, CircleMinus, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OverviewStats } from '@/lib/types';

/**
 * System status, built ONLY from observations the client actually made.
 *
 * Every row here answers "what did we last see?", never "is that service
 * healthy?" — we have no probe for the latter and inventing one is the exact
 * fabrication this wall must avoid. `/health` is deliberately not consulted: it
 * returns a hardcoded constant with no auth and no database access, so a green
 * "Database: healthy" derived from it would assert something nobody checked.
 * (It also serves the load balancer's target-group check, which is why it stays
 * trivial.)
 *
 * Where each row's evidence comes from:
 *  - **API** — the stats/feed requests themselves. A response is the proof.
 *  - **Database** — the stats payload carries DB-derived values, so receiving
 *    one is proof the API reached Postgres. A null payload means it could not.
 *  - **Mail pipeline** — `newestServerAt`, which the backend computes over the
 *    whole table rather than the window, precisely so a long silence is
 *    distinguishable from "no data in the last 24h".
 *  - **Auth** — the client's own Cognito session. Every call that succeeded
 *    carried its token, so a live session IS the auth-path evidence.
 */

const QUIET_AFTER_MS = 24 * 60 * 60 * 1000;

type Tone = 'ok' | 'quiet' | 'unknown';

const TONE: Record<Tone, { icon: LucideIcon; className: string; srLabel: string }> = {
  ok: { icon: CircleCheck, className: 'text-verdict-clean', srLabel: 'observed' },
  quiet: { icon: CircleMinus, className: 'text-verdict-flag', srLabel: 'quiet' },
  unknown: { icon: CircleHelp, className: 'text-muted-foreground', srLabel: 'unknown' },
};

interface Row {
  label: string;
  tone: Tone;
  /** What we observed, in plain words — never a health claim. */
  detail: string;
}

interface SystemStatusCardProps {
  stats: OverviewStats | null;
  loading: boolean;
  /** True when the aggregate call failed and the wall fell back to the feed. */
  isDegraded: boolean;
}

export function SystemStatusCard({ stats, loading, isDegraded }: SystemStatusCardProps) {
  const { live } = useDetectionsFeed();
  const { user } = useAuth();

  const feedOk = live.fetchedAt !== null && live.error === null;
  const aggregateOk = stats !== null && !isDegraded;

  // The mail pipeline is only assessable from the aggregate path: a 50-row feed
  // window can hold zero server rows while the pipeline is perfectly healthy,
  // so a null here on the degraded path means "can't tell", not "quiet".
  const serverAt = aggregateOk ? stats.newestServerAt : null;
  const serverAgeMs = serverAt ? Date.now() - Date.parse(serverAt) : null;

  const rows: Row[] = [
    {
      label: 'API',
      tone: feedOk || aggregateOk ? 'ok' : 'unknown',
      detail:
        live.fetchedAt !== null
          ? `last response ${formatRelative(new Date(live.fetchedAt).toISOString())}`
          : 'no response yet',
    },
    {
      label: 'Database',
      tone: aggregateOk ? 'ok' : 'unknown',
      detail: aggregateOk
        ? `served aggregates ${formatRelative(stats.generatedAt)}`
        : 'the API could not read it',
    },
    {
      label: 'Mail pipeline',
      tone: !aggregateOk ? 'unknown' : serverAt === null ? 'quiet' : serverAgeMs !== null && serverAgeMs > QUIET_AFTER_MS ? 'quiet' : 'ok',
      detail: !aggregateOk
        ? 'not assessable without the database'
        : serverAt === null
          ? 'no mail-server detection on record'
          : `newest mail-server detection ${formatRelative(serverAt)}`,
    },
    {
      label: 'Auth',
      tone: user ? 'ok' : 'unknown',
      detail: user ? 'session valid for this browser' : 'no active session',
    },
  ];

  return (
    <section
      className="panel-elevated rounded-xl border border-border bg-surface p-4"
      aria-labelledby="status-heading"
    >
      <h2 id="status-heading" className="text-sm font-semibold text-foreground">
        System status
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        What this dashboard last observed — not a health probe.
      </p>

      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => {
            const tone = TONE[row.tone];
            const Icon = tone.icon;
            return (
              <li key={row.label} className="flex items-start gap-2 text-xs">
                <Icon className={cn('mt-0.5 size-4 shrink-0', tone.className)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">
                    {row.label}
                    {/* Status is never colour-alone: the state is spelled out
                        for screen readers and for the light theme, where the
                        verdict hues sit close together. */}
                    <span className="sr-only"> — {tone.srLabel}</span>
                  </p>
                  <p className="text-muted-foreground">{row.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
