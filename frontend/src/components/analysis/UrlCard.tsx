import { Badge } from '@/components/ui/badge';
import { FeatureBreakdown } from './FeatureBreakdown';
import { verdictMeta } from '@/lib/verdict';
import { defangUrl } from '@/lib/defang';
import type { UrlDetail } from '@/lib/types';

/**
 * A single extracted URL. The URL is DEFANGED and rendered as plain text —
 * never a clickable anchor (this is a phishing tool).
 */
export function UrlCard({ url }: { url: UrlDetail }) {
  const meta = verdictMeta(url.verdict);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Defanged, non-clickable, wraps on overflow */}
        <code className="min-w-0 break-all font-mono text-xs text-foreground">
          {defangUrl(url.url)}
        </code>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Likelihood{' '}
          <span className="font-mono text-foreground">{Math.round(url.likelihood)}</span>
        </span>
        {url.model && (
          <span className="text-muted-foreground">
            Model <span className="font-mono text-foreground">{url.model}</span>
          </span>
        )}
      </div>

      {url.reason && (
        <p className="mt-2 text-xs text-muted-foreground">{url.reason}</p>
      )}

      {Object.keys(url.features ?? {}).length > 0 && (
        <div className="mt-3">
          <FeatureBreakdown features={url.features} />
        </div>
      )}
    </section>
  );
}
