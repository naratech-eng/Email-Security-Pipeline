/**
 * Per-user acknowledgement mark for the quarantine bell (RB-3).
 *
 * The bell counts quarantine detections whose id is above this mark, so the
 * badge means "quarantine you haven't looked at" and can actually reach zero.
 * Two properties make it trustworthy:
 *
 *  - **Per user.** Keyed by the Cognito `sub`, like the avatar storage keys, so
 *    two accounts on one machine don't inherit each other's state.
 *  - **Monotonic.** The mark only ever moves forward; a poll returning an older
 *    window must not lower it, or previously-acknowledged rows re-alert.
 *
 * It lives in localStorage because the backend has no notification state — a
 * refresh (or reloading the demo) must not resurrect a badge already cleared.
 */

const KEY_PREFIX = 'esp:quarantine-ack:';

function keyFor(sub: string): string {
  return `${KEY_PREFIX}${sub}`;
}

/** The acknowledged high-water id, or 0 when nothing is stored/readable. */
export function readQuarantineAck(sub: string | undefined): number {
  if (!sub) return 0;
  try {
    const raw = window.localStorage.getItem(keyFor(sub));
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  } catch {
    // Private mode / storage disabled — the bell degrades to counting the whole
    // window rather than breaking.
    return 0;
  }
}

/** Advance the mark. Returns the value actually stored (never decreases). */
export function writeQuarantineAck(sub: string | undefined, id: number): number {
  const current = readQuarantineAck(sub);
  const next = Math.max(current, Math.trunc(id));
  if (!sub || next === current) return current;
  try {
    window.localStorage.setItem(keyFor(sub), String(next));
  } catch {
    // Nothing to do — the in-memory mark still holds for this session.
  }
  return next;
}
