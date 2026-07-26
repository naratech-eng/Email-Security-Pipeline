/**
 * Centralized Framer Motion tokens. Every animated surface in the app pulls its
 * durations/easings from here so motion stays consistent and dial-downable.
 *
 * Motion is used ONLY where it clarifies a state change (loading, scanning,
 * count-up, enter/exit, transitions) — never decoration. Honor reduced-motion
 * everywhere via `prefersReducedMotion()` (and the global CSS guard in theme.css).
 */
import type { Transition, Variants } from 'framer-motion';

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  countUp: 0.7,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const transitions = {
  base: { duration: DURATION.base, ease: EASE.out } satisfies Transition,
  fast: { duration: DURATION.fast, ease: EASE.out } satisfies Transition,
} as const;

/** Standard fade-in-up used for cards, panels, and page content. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transitions.base },
};

/** Stagger container for lists/grids of entering children. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
