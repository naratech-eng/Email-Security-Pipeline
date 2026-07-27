import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, prefersReducedMotion, transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/**
 * One number on the wall, with the denominator it was measured against.
 *
 * The tile can render three genuinely different things and must never blur them:
 *  - a value + its basis label ("412 · last 24h")
 *  - a real zero, which is an answer ("we looked and found none")
 *  - `unavailable`, which is not ("we don't know") — rendered as an em dash,
 *    never as 0, because a failed request that draws a 0 turns an outage into a
 *    quiet night.
 */

interface StatTileProps {
  label: string;
  /** Null renders the unavailable state — reserve it for "we don't know". */
  value: number | null;
  /** The denominator this number was measured against, e.g. "last 24h". */
  basis: string;
  loading?: boolean;
  /** Verdict token CSS var, when the tile carries a verdict identity. */
  accentVar?: string;
  /** Makes the whole tile a link into the filtered feed. */
  to?: string;
  className?: string;
}

/** Counts up to `value` on mount; snaps instantly under reduced motion. */
function useCountUp(value: number | null): number | null {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value === null) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const from = 0;
    const start = performance.now();
    const ms = DURATION.countUp * 1000;
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      // Ease-out so the number decelerates into its final value.
      setShown(Math.round(from + (value - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return value === null ? null : shown;
}

export function StatTile({
  label,
  value,
  basis,
  loading = false,
  accentVar,
  to,
  className,
}: StatTileProps) {
  const shown = useCountUp(value);

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      {loading ? (
        <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <p
          className={cn(
            'mt-1 font-mono text-3xl font-semibold tabular-nums',
            accentVar ? 'text-[color:var(--accent-token)]' : 'text-foreground',
            value === null && 'text-muted-foreground',
          )}
          style={accentVar ? ({ '--accent-token': accentVar } as React.CSSProperties) : undefined}
        >
          {/* The final value is always in the DOM even mid-animation, so a
              screen reader never reads a transient number. */}
          {value === null ? '—' : (shown ?? value).toLocaleString()}
        </p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {value === null ? 'unavailable' : basis}
      </p>
    </>
  );

  const shell = cn(
    'panel-elevated rounded-xl border border-border bg-surface px-4 py-3',
    to && 'transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.base}
    >
      {to && value !== null ? (
        <Link to={to} className={cn(shell, 'block')} aria-label={`${label}: ${value}, ${basis}`}>
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </motion.div>
  );
}
