import { useState } from 'react';
import { ShieldOff, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError, isAbortError, reviewDetection } from '@/lib/api';
import type { DetectionRecord, ReviewStatus } from '@/lib/types';

const COPY: Record<ReviewStatus, { action: string; title: string; blurb: string }> = {
  false_positive: {
    action: 'Mark false positive',
    title: 'Mark this detection as a false positive?',
    blurb:
      'The verdict stays on the record — this flags that the model was wrong, for triage and model review.',
  },
  confirmed: {
    action: 'Confirm threat',
    title: 'Confirm this detection as a real threat?',
    blurb: 'This records analyst confirmation of the verdict on the detection.',
  },
};

interface ReviewActionsProps {
  detectionId: number;
  /** Called with the updated record so the page can re-render the review badge. */
  onReviewed: (record: DetectionRecord) => void;
}

/**
 * Analyst-only review controls, injected into `ResultDisplay` via its `actions`
 * slot — the page decides whether to render them, the renderer stays read-only.
 * `PATCH /detections/{id}` is not deployed yet: a null result means "not live",
 * which we say plainly rather than showing a failure the analyst can't act on.
 */
export function ReviewActions({ detectionId, onReviewed }: ReviewActionsProps) {
  const [pending, setPending] = useState<ReviewStatus | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function close() {
    if (!submitting) setPending(null);
  }

  async function submit(status: ReviewStatus) {
    setSubmitting(true);
    try {
      const updated = await reviewDetection(detectionId, {
        review_status: status,
        review_note: note.trim() || undefined,
      });
      if (!updated) {
        toast.info('Review isn’t live yet — the backend endpoint is still being built.');
      } else {
        onReviewed(updated);
        toast.success(
          status === 'confirmed' ? 'Threat confirmed.' : 'Marked as a false positive.',
        );
      }
      setPending(null);
      setNote('');
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error(err instanceof ApiError ? err.message : 'Could not save that review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setPending('false_positive')}>
        <ShieldOff aria-hidden />
        {COPY.false_positive.action}
      </Button>
      <Button size="sm" variant="destructive" onClick={() => setPending('confirmed')}>
        <ShieldX aria-hidden />
        {COPY.confirmed.action}
      </Button>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[pending].title}</DialogTitle>
                <DialogDescription>{COPY[pending].blurb}</DialogDescription>
              </DialogHeader>

              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Note (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Why is this the right call?"
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </label>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant={pending === 'confirmed' ? 'destructive' : 'default'}
                  onClick={() => submit(pending)}
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : COPY[pending].action}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
