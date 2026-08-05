import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, FileSearch, RotateCw, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultDisplay } from '@/components/analysis/ResultDisplay';
import { ResultSkeleton } from '@/components/analysis/ResultSkeleton';
import { ReviewActions } from '@/components/analysis/ReviewActions';
import { usePermissions } from '@/auth/usePermissions';
import { ApiError, getDetection, isAbortError } from '@/lib/api';
import { fromDetection } from '@/lib/normalize';
import { formatDateTime } from '@/lib/format';
import type { DetectionRecord } from '@/lib/types';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; record: DetectionRecord }
  | { phase: 'missing' }
  | { phase: 'error'; message: string };

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-surface px-8 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * One detection, rendered by the shared `ResultDisplay` — the same component the
 * Analyze page will use, so a server-scored email and a manual analysis read
 * identically. Review controls are injected as actions, analyst-only.
 */
export default function DetectionDetail() {
  const { id } = useParams();
  const location = useLocation();
  const detectionId = Number(id);
  const valid = Number.isInteger(detectionId) && detectionId > 0;
  const { canReviewDetections } = usePermissions();

  // Return to the filtered list the analyst came from (RB-6), falling back to
  // the bare feed for a deep link that carries no origin. Only same-app list
  // paths are honoured — router state is user-controllable via history.
  const fromState = (location.state as { from?: unknown } | null)?.from;
  const backTo =
    typeof fromState === 'string' && fromState.startsWith('/detections')
      ? fromState
      : '/detections';
  const cameFromFilteredList = backTo !== '/detections';

  const [reloadKey, setReloadKey] = useState(0);

  // Which request the phase below describes. Keying the settled outcome lets
  // both "loading" and "missing" be *derived* rather than written into state
  // from the effect body: navigating to a new id, or hitting retry, changes the
  // key, which is by itself enough to read as loading again. Writing them
  // instead meant every id change rendered once with the previous detection's
  // data still on screen before the effect could reset it.
  const requestKey = `${detectionId}:${reloadKey}`;
  const [outcome, setOutcome] = useState<{ key: string; state: State } | null>(null);

  const state: State = !valid
    ? { phase: 'missing' }
    : outcome?.key === requestKey
      ? outcome.state
      : { phase: 'loading' };

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();

    getDetection(detectionId, controller.signal)
      .then((record) =>
        setOutcome({
          key: requestKey,
          state: record ? { phase: 'ready', record } : { phase: 'missing' },
        }),
      )
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setOutcome({
          key: requestKey,
          state: {
            phase: 'error',
            message:
              err instanceof ApiError ? err.message : 'Could not load this detection.',
          },
        });
      });

    return () => controller.abort();
  }, [detectionId, valid, requestKey]);

  const onReviewed = useCallback(
    (record: DetectionRecord) => {
      setOutcome({ key: requestKey, state: { phase: 'ready', record } });
    },
    [requestKey],
  );

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to={backTo}>
            <ArrowLeft aria-hidden />
            {cameFromFilteredList ? 'Back to filtered feed' : 'Detections'}
          </Link>
        </Button>
        <h1 className="mt-1 text-xl font-semibold text-foreground">
          {valid ? `Detection #${detectionId}` : 'Detection'}
        </h1>
        {state.phase === 'ready' && (
          <p className="text-xs text-muted-foreground">
            Scored {formatDateTime(state.record.created_at)}
            {state.record.submitted_by && (
              <> · submitted by {state.record.submitted_by}</>
            )}
          </p>
        )}
      </div>

      {state.phase === 'loading' && <ResultSkeleton />}

      {state.phase === 'ready' && (
        <ResultDisplay
          result={fromDetection(state.record)}
          actions={
            canReviewDetections ? (
              <ReviewActions detectionId={state.record.id} onReviewed={onReviewed} />
            ) : undefined
          }
        />
      )}

      {state.phase === 'missing' && (
        <EmptyPanel
          icon={FileSearch}
          title="Detection not found"
          description={
            // Two different situations, and only one is recoverable by the
            // analyst: the row may simply be deeper than the lookup scans, or it
            // may be genuinely past the horizon until GET /detections/{id} ships.
            'That id isn’t in the most recent detections. It may sit deeper in the feed than this lookup reaches, or the link may be wrong — filters and paging on the list don’t affect this view.'
          }
          action={
            <Button asChild variant="outline">
              <Link to={backTo}>
                {cameFromFilteredList ? 'Back to filtered feed' : 'Back to detections'}
              </Link>
            </Button>
          }
        />
      )}

      {state.phase === 'error' && (
        <EmptyPanel
          icon={TriangleAlert}
          title="Couldn’t load this detection"
          description={state.message}
          action={
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              <RotateCw aria-hidden />
              Try again
            </Button>
          }
        />
      )}
    </div>
  );
}
