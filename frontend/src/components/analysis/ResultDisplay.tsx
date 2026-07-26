import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { VerdictBanner } from './VerdictBanner';
import { LikelihoodGauge } from './LikelihoodGauge';
import { MetadataCard } from './MetadataCard';
import { RemediationCard } from './RemediationCard';
import { EmailModelCard } from './EmailModelCard';
import { UrlCard } from './UrlCard';
import { formatDateTime } from '@/lib/format';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import type { AnalysisResult, Provenance, ReviewStatus } from '@/lib/types';

const PROVENANCE_LABEL: Record<Provenance, string> = {
  server: 'Mail server',
  upload: 'Manual upload',
  analyze: 'This analysis',
};

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  false_positive: 'Marked false positive',
  confirmed: 'Confirmed threat',
};

interface ResultDisplayProps {
  result: AnalysisResult;
  /**
   * Review controls, "view in detections", etc. Injected by the page that owns
   * the permission to show them — the renderer itself stays presentational.
   */
  actions?: ReactNode;
}

/**
 * The single renderer for an analysis, server-side detection or manual Analyze
 * alike (RB-4). Both routes feed it one normalized `AnalysisResult`, so verdict,
 * scoring, remediation, and URL breakdowns can never drift between the two.
 * Sections with no data collapse rather than rendering empty shells.
 */
export function ResultDisplay({ result, actions }: ResultDisplayProps) {
  const { email, metadata, urls, review } = result;
  const hasEmailTrack =
    email.score != null ||
    Boolean(email.model) ||
    Boolean(email.reason) ||
    Object.keys(email.features).length > 0;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{PROVENANCE_LABEL[result.provenance]}</Badge>
        {result.id != null && (
          <span className="font-mono text-xs text-muted-foreground">
            detection #{result.id}
          </span>
        )}
        {review?.status && (
          <Badge variant={review.status === 'confirmed' ? 'quarantine' : 'clean'}>
            {REVIEW_LABEL[review.status]}
          </Badge>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <VerdictBanner verdict={result.verdict} summary={result.summary} />
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <motion.section
          variants={fadeInUp}
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-5"
        >
          <LikelihoodGauge value={result.likelihood} verdict={result.verdict} />
        </motion.section>

        <motion.div variants={fadeInUp}>
          <MetadataCard metadata={metadata} />
        </motion.div>
      </div>

      <motion.div variants={fadeInUp}>
        <RemediationCard remediation={result.remediation} />
      </motion.div>

      {hasEmailTrack && (
        <motion.div variants={fadeInUp}>
          <EmailModelCard email={email} />
        </motion.div>
      )}

      <motion.section variants={fadeInUp} className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Extracted URLs{' '}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            ({urls.length})
          </span>
        </h3>
        {urls.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface/50 p-5 text-sm text-muted-foreground">
            No URLs were found in this email.
          </p>
        ) : (
          <div className="grid gap-3">
            {urls.map((url, i) => (
              <UrlCard key={`${url.url}-${i}`} url={url} />
            ))}
          </div>
        )}
      </motion.section>

      {review?.reviewedBy && (
        <motion.p variants={fadeInUp} className="text-xs text-muted-foreground">
          Reviewed by{' '}
          <span className="font-mono text-foreground">{review.reviewedBy}</span> on{' '}
          {formatDateTime(review.reviewedAt)}
          {review.note && <> — “{review.note}”</>}
        </motion.p>
      )}
    </motion.div>
  );
}
