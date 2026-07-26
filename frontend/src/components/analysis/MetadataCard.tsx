import { defangText } from '@/lib/defang';
import { formatDateTime } from '@/lib/format';
import type { AnalysisResult } from '@/lib/types';

/**
 * Email metadata — from/to/subject/date plus URL and attachment counts.
 * Addresses are defanged (domains never render live) and everything is plain
 * text. Message bodies are deliberately absent: the pipeline never stores them.
 */
export function MetadataCard({ metadata }: { metadata: AnalysisResult['metadata'] }) {
  const rows: [string, string][] = [
    ['From', metadata.fromAddr ? defangText(metadata.fromAddr) : '—'],
    ['To', metadata.toAddr ? defangText(metadata.toAddr) : '—'],
    ['Subject', metadata.subject || '—'],
    ['Date', formatDateTime(metadata.date)],
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-foreground">Email metadata</h3>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate font-mono text-sm text-foreground" title={value}>
              {value}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted-foreground">URLs extracted</dt>
          <dd className="font-mono text-sm text-foreground">{metadata.numUrls}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Attachments</dt>
          <dd className="font-mono text-sm text-foreground">{metadata.attachmentCount}</dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Message bodies are never stored — a detection holds metadata, scores, and
        extracted URLs only.
      </p>
    </section>
  );
}
