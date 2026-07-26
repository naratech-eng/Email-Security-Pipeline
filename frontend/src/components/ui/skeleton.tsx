import { cn } from '@/lib/utils';

/** Layout-preserving loading placeholder. Use instead of spinners for cold loads. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      {...props}
    />
  );
}

export { Skeleton };
