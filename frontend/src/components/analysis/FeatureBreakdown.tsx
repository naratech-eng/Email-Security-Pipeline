import { cn } from '@/lib/utils';

/**
 * Generic feature renderer for a Record<string, number>. Feature-agnostic so
 * new model signals from the backend appear automatically (RB-4). Collapses to
 * nothing when there are no features.
 *
 * Model features mix scales — probabilities and ratios in [0,1] alongside raw
 * counts (`word_count: 138`, `hyphen_count: 1`, `entropy: 3.81`). Scaling one
 * shared bar to the largest value flattens every ratio to a sliver and implies
 * the biggest count is some maximum, so a bar is drawn only for fractional
 * values in [0,1], where 1.0 is a real ceiling. Integers are counts — a
 * `hyphen_count` of 1 is not "100%" — so they render as the number alone.
 */
export function FeatureBreakdown({
  features,
  className,
}: {
  features: Record<string, number>;
  className?: string;
}) {
  const entries = Object.entries(features ?? {});
  if (entries.length === 0) return null;

  return (
    <dl className={cn('grid gap-2', className)}>
      {entries.map(([key, value]) => {
        const ratio =
          !Number.isInteger(value) && Math.abs(value) <= 1 ? Math.abs(value) : null;
        return (
          <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <dt className="truncate font-mono text-xs text-muted-foreground">
                {key}
              </dt>
              {ratio !== null && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
              )}
            </div>
            <dd className="font-mono text-xs tabular-nums text-foreground">
              {Number.isInteger(value) ? value : value.toFixed(3)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
