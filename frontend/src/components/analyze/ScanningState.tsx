import { motion } from 'framer-motion';
import { Ban, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultSkeleton } from '@/components/analysis/ResultSkeleton';
import { REASSURE_MS } from '@/hooks/useAnalyze';
import { DURATION, EASE, prefersReducedMotion } from '@/lib/motion';

interface ScanningStateProps {
  elapsedMs: number;
  onCancel: () => void;
}

/**
 * The cold-start wait.
 *
 * A spinner reads as "broken" within about eight seconds, and this wait is ~40.
 * So the surface shows things that are actually true — time elapsed, what the
 * service is doing, what "normal" looks like — and never a percentage, because
 * the backend reports no progress and a fabricated bar would be a lie the
 * analyst can't audit.
 */
export function ScanningState({ elapsedMs, onCancel }: ScanningStateProps) {
  const reduced = prefersReducedMotion();
  const seconds = Math.floor(elapsedMs / 1000);
  const phase = phaseFor(elapsedMs);
  const overdue = elapsedMs >= REASSURE_MS;

  return (
    <section className="space-y-5" aria-label="Analysis in progress">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-5">
        {/* The sweep is the affordance; the counter is the information. Under
            reduced-motion the sweep goes away and nothing is lost. */}
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '400%' }}
            transition={{ duration: 2.4, ease: EASE.inOut, repeat: Infinity }}
          />
        )}

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Radar className={reduced ? 'size-5 text-primary' : 'size-5 animate-pulse text-primary'} />
            <div>
              <p className="text-sm font-medium text-foreground">{phase}</p>
              <p className="text-xs text-muted-foreground">
                {overdue
                  ? 'Taking longer than usual — still analysing, not stuck.'
                  : 'First analysis after an idle period loads the models — usually 30–45 seconds.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="font-mono text-lg tabular-nums text-foreground"
              aria-label={`${seconds} seconds elapsed`}
            >
              {formatElapsed(seconds)}
            </span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Ban className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* The result settles into this layout instead of jumping into it. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.base }}
      >
        <ResultSkeleton />
      </motion.div>
    </section>
  );
}

/**
 * Named phases advanced on a time heuristic. Honest only because they're never
 * presented as measured progress — they describe what the service does in this
 * order (parse, extract URLs, score), not how far along it is.
 */
function phaseFor(elapsedMs: number): string {
  if (elapsedMs < 2_000) return 'Uploading message…';
  if (elapsedMs < 6_000) return 'Parsing headers and body…';
  if (elapsedMs < 12_000) return 'Extracting URLs…';
  return 'Scoring against the detection models…';
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
