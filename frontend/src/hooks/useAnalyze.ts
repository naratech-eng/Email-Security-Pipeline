import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, analyzeEmail, isAbortError } from '@/lib/api';
import { fromAnalyze } from '@/lib/normalize';
import type { EmailInput } from '@/lib/emailInput';
import type { AnalysisResult } from '@/lib/types';

/**
 * The whole Analyze lifecycle in one value.
 *
 * A discriminated union rather than a set of booleans, because the bugs worth
 * designing out are the *combinations*: loading true while a result is showing,
 * an error rendered under a running scan, a retry that lost what was typed.
 * Those states simply can't be constructed here.
 */
export type AnalyzeState =
  | { kind: 'idle' }
  | { kind: 'scanning'; startedAt: number }
  | { kind: 'timedOut'; elapsedMs: number }
  | { kind: 'failed'; error: ApiError }
  | { kind: 'done'; result: AnalysisResult };

/**
 * Cold model loads take ~40s. 60s is where we reassure, NOT where we give up:
 * aborting at 60 would kill runs that were about to succeed, and the analyst
 * would have waited a full minute for nothing.
 */
export const REASSURE_MS = 60_000;
/** Past this, continuing costs more attention than the result is worth. */
export const TIMEOUT_MS = 90_000;

/** Distinguishes "the deadline fired" from "the analyst pressed Cancel". */
const TIMEOUT_REASON = 'esp:analyze-timeout';

export interface UseAnalyze {
  state: AnalyzeState;
  /** Milliseconds since submit — drives the elapsed readout while scanning. */
  elapsedMs: number;
  submit: (input: EmailInput) => Promise<void>;
  cancel: () => void;
  /** Re-run the last submission; the input is retained across failures. */
  retry: () => void;
  /** Back to an empty composer, clearing the previous result. */
  reset: () => void;
  /** What was last submitted, kept so a timeout never discards the analyst's work. */
  lastInput: EmailInput | null;
}

export function useAnalyze(): UseAnalyze {
  const [state, setState] = useState<AnalyzeState>({ kind: 'idle' });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastInput, setLastInput] = useState<EmailInput | null>(null);

  // In a ref, not in state: cancel() and the unmount cleanup must both reach
  // the same controller, and a state update wouldn't be visible to a cleanup
  // closure captured on an earlier render.
  const controllerRef = useRef<AbortController | null>(null);

  // Abort in flight work if the analyst navigates away, so a resolving promise
  // never sets state on an unmounted component.
  useEffect(() => () => controllerRef.current?.abort(), []);

  // Elapsed time is derived from a timestamp rather than counted up, because a
  // backgrounded tab throttles timers — a counter would silently under-report
  // exactly when the analyst is away and most wants an accurate number.
  useEffect(() => {
    if (state.kind !== 'scanning') return;
    const { startedAt } = state;
    setElapsedMs(Date.now() - startedAt);
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [state]);

  const run = useCallback(async (input: EmailInput) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = Date.now();

    setLastInput(input);
    setElapsedMs(0);
    setState({ kind: 'scanning', startedAt });

    const timeout = window.setTimeout(() => {
      controller.abort(TIMEOUT_REASON);
    }, TIMEOUT_MS);

    try {
      const res = await analyzeEmail({
        ...(input.mode === 'paste' ? { text: input.text } : { file: input.file }),
        signal: controller.signal,
      });
      setState({ kind: 'done', result: fromAnalyze(res) });
    } catch (err) {
      if (isAbortError(err)) {
        // Two very different things arrive here. A deadline abort is a failure
        // the analyst must see; a cancel is something they chose, and showing
        // an error for it would be wrong.
        if (controller.signal.reason === TIMEOUT_REASON) {
          setState({ kind: 'timedOut', elapsedMs: Date.now() - startedAt });
        } else {
          setState({ kind: 'idle' });
        }
        return;
      }
      setState({
        kind: 'failed',
        error:
          err instanceof ApiError
            ? err
            : new ApiError(0, 'Something went wrong running the analysis.'),
      });
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const submit = useCallback(
    async (input: EmailInput) => {
      // No scanning -> scanning transition. A second request during a cold
      // start would queue behind the first, doubling the wait and writing a
      // second detections row for one analyst action.
      if (controllerRef.current) return;
      await run(input);
    },
    [run],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    // Same single-flight guard as submit: retry is only reachable from a
    // settled state today, but sharing the rule keeps that from silently
    // becoming untrue and orphaning an in-flight controller.
    if (controllerRef.current || !lastInput) return;
    void run(lastInput);
  }, [lastInput, run]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setLastInput(null);
    setElapsedMs(0);
    setState({ kind: 'idle' });
  }, []);

  return { state, elapsedMs, submit, cancel, retry, reset, lastInput };
}
