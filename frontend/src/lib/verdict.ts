import type { Verdict } from '@/lib/types';

interface VerdictMeta {
  label: string;
  /** Badge variant name (see components/ui/badge). */
  badge: 'clean' | 'flag' | 'quarantine';
  /** CSS var for the verdict token, for gauges/accents. */
  colorVar: string;
}

const META: Record<Verdict, VerdictMeta> = {
  clean: { label: 'Clean', badge: 'clean', colorVar: 'var(--verdict-clean)' },
  flag: { label: 'Flagged', badge: 'flag', colorVar: 'var(--verdict-flag)' },
  quarantine: {
    label: 'Quarantine',
    badge: 'quarantine',
    colorVar: 'var(--verdict-quarantine)',
  },
};

const FALLBACK: VerdictMeta = {
  label: 'Unknown',
  badge: 'flag',
  colorVar: 'var(--muted-foreground)',
};

export function verdictMeta(verdict: string): VerdictMeta {
  return META[verdict as Verdict] ?? FALLBACK;
}
