import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ExternalLink, FileText, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultDisplay } from '@/components/analysis/ResultDisplay';
import { ReviewActions } from '@/components/analysis/ReviewActions';
import { EmailComposer } from '@/components/analyze/EmailComposer';
import { ScanningState } from '@/components/analyze/ScanningState';
import { AnalyzeError } from '@/components/analyze/AnalyzeError';
import { usePermissions } from '@/auth/usePermissions';
import { useAnalyze } from '@/hooks/useAnalyze';
import { inputSize, type EmailInput } from '@/lib/emailInput';
import { fadeInUp } from '@/lib/motion';

/**
 * M7-T12 — the core demo path: submit an email, wait out the cold model, read
 * the verdict.
 *
 * The page is orchestration only. Rendering belongs to the shared
 * `ResultDisplay` that the detections drill-down also uses, so a live analysis
 * and a stored detection can never drift apart visually; the lifecycle belongs
 * to `useAnalyze`.
 */
export default function Analyze() {
  const { state, elapsedMs, submit, cancel, retry, reset, lastInput } = useAnalyze();
  const { canReviewDetections } = usePermissions();

  const scanning = state.kind === 'scanning';
  const finished = state.kind === 'done';
  const recoverable = state.kind === 'timedOut' || state.kind === 'failed';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Analyze</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a suspicious email for scoring. Results are recorded against your account and
          kept separate from the mail-server feed.
        </p>
      </header>

      {state.kind === 'timedOut' && <AnalyzeError timedOut onRetry={retry} />}
      {state.kind === 'failed' && <AnalyzeError error={state.error} onRetry={retry} />}

      {/* Once a verdict is on screen the composer collapses to a strip: the
          analyst keeps sight of what they submitted without the form competing
          with the result for the viewport. */}
      {finished && lastInput ? (
        <SubmissionStrip label={describeInput(lastInput)} onReset={reset} />
      ) : (
        // Shown when idle, and again under an error — a failed run keeps the
        // input, so the analyst corrects and resubmits instead of retyping.
        // The key remounts it when the run outcome changes, which is what
        // re-seeds the draft from `lastInput`.
        !scanning && (
          <EmailComposer
            key={recoverable ? 'retry' : 'fresh'}
            onSubmit={(input) => void submit(input)}
            busy={false}
            initialInput={recoverable ? lastInput : null}
          />
        )
      )}

      {scanning && <ScanningState elapsedMs={elapsedMs} onCancel={cancel} />}

      {finished && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          {state.result.id == null && <NotPersistedNote />}
          <ResultDisplay
            result={state.result}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {/* Both affordances need a stored row to point at. Rendering
                    them without an id would promise a record we can't name. */}
                {state.result.id != null && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/detections/${state.result.id}`}>
                        <ExternalLink className="size-4" />
                        View in detections
                      </Link>
                    </Button>
                    {canReviewDetections && (
                      <ReviewActions detectionId={state.result.id} onReviewed={() => {}} />
                    )}
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="size-4" />
                  Analyze another
                </Button>
              </div>
            }
          />
        </motion.div>
      )}

    </div>
  );
}

function SubmissionStrip({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <FileText className="size-4 shrink-0" />
        <span className="truncate font-mono text-xs">{label}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw className="size-4" />
        Analyze another
      </Button>
    </div>
  );
}

/**
 * Persistence fails open by design, so a result can be valid while unsaved.
 * Staying silent would let the analyst assume it was recorded.
 */
function NotPersistedNote() {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-[var(--verdict-flag)]">
      <Info className="mt-px size-3.5 shrink-0" />
      This analysis wasn&apos;t saved to detections, so it can&apos;t be reviewed or linked. The
      verdict below is still valid.
    </p>
  );
}

function describeInput(input: EmailInput): string {
  const bytes = inputSize(input);
  const size = bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
  return input.mode === 'file' ? `${input.file.name} · ${size}` : `Pasted email · ${size}`;
}
