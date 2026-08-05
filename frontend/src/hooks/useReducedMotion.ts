import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** Server/prerender has no media queries; assume motion is allowed. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * True when the user asked the OS to reduce motion — as a subscription.
 *
 * `prefersReducedMotion()` from lib/motion reads `matchMedia` on the spot,
 * which is fine inside an effect or an event handler but not during render:
 * it's an external mutable source, so render becomes impure, and a component
 * that reads it will not re-render when the analyst flips the OS setting
 * mid-session — it stays animated (or stays still) until something unrelated
 * happens to re-render it.
 *
 * `useSyncExternalStore` is the sanctioned way to read exactly this kind of
 * source: render gets a consistent snapshot, and the change event schedules
 * the re-render.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
