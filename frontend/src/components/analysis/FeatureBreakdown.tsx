import { cn } from '@/lib/utils';

/**
 * Generic feature renderer for a Record<string, number>. Feature-agnostic so
 * new model signals from the backend appear automatically (RB-4). Collapses to
 * nothing when there are no features.
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

  const max = Math.max(1, ...entries.map(([, v]) => Math.abs(v)));

  return (
    <dl className={cn('grid gap-2', className)}>
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <dt className="truncate font-mono text-xs text-muted-foreground">
              {key}
            </dt>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${(Math.abs(value) / max) * 100}%` }}
              />
            </div>
          </div>
          <dd className="font-mono text-xs tabular-nums text-foreground">
            {Number.isInteger(value) ? value : value.toFixed(3)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
