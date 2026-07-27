import { FeatureBreakdown } from './FeatureBreakdown';
import type { AnalysisResult } from '@/lib/types';

/** Email-track model breakdown: model, score, reason, and feature bars. */
export function EmailModelCard({ email }: { email: AnalysisResult['email'] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Email model</h3>
        {email.model && (
          <span className="font-mono text-xs text-muted-foreground">
            {email.model}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="font-mono text-sm text-foreground">
            {email.score != null ? email.score.toFixed(4) : 'unavailable'}
          </p>
        </div>
      </div>

      {email.reason && (
        <p className="mt-3 text-sm text-muted-foreground">{email.reason}</p>
      )}

      {Object.keys(email.features).length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Feature breakdown
          </p>
          <FeatureBreakdown features={email.features} />
        </div>
      )}
    </section>
  );
}
