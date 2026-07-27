import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { verdictMeta } from '@/lib/verdict';
import type { Verdict } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICON: Record<Verdict, typeof ShieldCheck> = {
  clean: ShieldCheck,
  flag: ShieldAlert,
  quarantine: ShieldX,
};

/** Big color-coded verdict header — the first thing an analyst reads. */
export function VerdictBanner({
  verdict,
  summary,
}: {
  verdict: Verdict;
  summary: string;
}) {
  const meta = verdictMeta(verdict);
  const Icon = ICON[verdict] ?? ShieldAlert;

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border p-5',
        'border-[color:var(--v)]/30 bg-[color:var(--v)]/10',
      )}
      style={{ ['--v' as string]: meta.colorVar }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.colorVar} 18%, transparent)` }}
      >
        <Icon className="size-6" style={{ color: meta.colorVar }} aria-hidden />
      </span>
      <div className="min-w-0">
        <p
          className="text-lg font-semibold"
          style={{ color: meta.colorVar }}
        >
          {meta.label}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{summary}</p>
      </div>
    </div>
  );
}
