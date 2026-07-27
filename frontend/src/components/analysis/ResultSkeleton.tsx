import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder shaped like `ResultDisplay`, so the detail page and the
 * Analyze result settle into the layout instead of jumping into it.
 */
export function ResultSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading analysis">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
