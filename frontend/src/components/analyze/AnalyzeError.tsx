import { Link } from 'react-router';
import { AlertTriangle, Clock, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { TIMEOUT_MS } from '@/hooks/useAnalyze';

interface AnalyzeErrorProps {
  /** A deadline abort, as opposed to a request that actually failed. */
  timedOut?: boolean;
  error?: ApiError;
  onRetry: () => void;
}

/**
 * Failure copy, differentiated by cause.
 *
 * The recovery differs in each case, so one generic message would waste the
 * only moment the analyst is paying attention to it: a timeout is retryable
 * and probably fast next time, an expired session is not retryable at all, and
 * an oversize payload needs a different input.
 */
export function AnalyzeError({ timedOut, error, onRetry }: AnalyzeErrorProps) {
  const { title, body, retryable, showDetections } = describe(timedOut, error);

  return (
    <section
      role="alert"
      className="rounded-xl border border-border bg-surface p-5"
      aria-label="Analysis failed"
    >
      <div className="flex items-start gap-3">
        {timedOut ? (
          <Clock className="mt-0.5 size-5 shrink-0 text-[var(--verdict-flag)]" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--verdict-quarantine)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {retryable && (
              <Button size="sm" onClick={onRetry}>
                <RotateCw className="size-4" />
                Retry analysis
              </Button>
            )}
            {showDetections && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/detections">Check detections</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function describe(timedOut: boolean | undefined, error: ApiError | undefined) {
  if (timedOut) {
    return {
      title: `The analysis didn't finish in ${TIMEOUT_MS / 1000} seconds.`,
      // A client-side abort doesn't stop the server, so promising it was
      // "cancelled" would be wrong — and the row may well appear.
      body: 'The models should be warm now, so a retry usually returns in a few seconds. Your email is still here. The analysis may also have completed on the server — it is worth checking detections before resubmitting.',
      retryable: true,
      showDetections: true,
    };
  }

  const status = error?.status ?? 0;

  if (status === 0) {
    return {
      title: "Couldn't reach the analysis service.",
      body: error?.message ?? 'Check your connection and try again.',
      retryable: true,
      showDetections: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: 'Your session expired during the analysis.',
      // Retrying would fail identically until they re-authenticate.
      body: 'Sign in again, then resubmit the email.',
      retryable: false,
      showDetections: false,
    };
  }
  if (status === 413) {
    return {
      title: 'That email was too large to analyse.',
      body: error?.message ?? 'Trim the message and submit again.',
      retryable: false,
      showDetections: false,
    };
  }
  if (status === 422) {
    return {
      title: "The service couldn't parse that message.",
      body: error?.message ?? 'It may not be a raw email. Try exporting it as .eml.',
      retryable: false,
      showDetections: false,
    };
  }
  return {
    title: 'The analysis service returned an error.',
    body: error?.message ?? 'Try again shortly.',
    retryable: true,
    showDetections: false,
  };
}
