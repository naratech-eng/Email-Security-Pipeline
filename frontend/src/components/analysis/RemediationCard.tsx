import { LifeBuoy } from 'lucide-react';

/** The "what to do about it" callout. Renders nothing when the API sent no text. */
export function RemediationCard({ remediation }: { remediation: string }) {
  if (!remediation?.trim()) return null;

  return (
    <section className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <LifeBuoy className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Recommended action</h3>
        <p className="mt-1 text-sm text-muted-foreground">{remediation}</p>
      </div>
    </section>
  );
}
