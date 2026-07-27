import type {
  AnalysisResult,
  AnalyzeResponse,
  DetectionRecord,
} from '@/lib/types';

/**
 * Adapters that map each API payload into the single AnalysisResult view-model.
 * Pure + snapshot-testable — equivalent inputs must produce structurally
 * identical results, which is what guarantees the detail page and the Analyze
 * result render the same (RB-4). `provenance` is label-only.
 */

export function fromDetection(rec: DetectionRecord): AnalysisResult {
  return {
    id: rec.id,
    verdict: rec.verdict,
    likelihood: rec.likelihood,
    summary: rec.summary,
    remediation: rec.remediation,
    email: {
      score: rec.email_score,
      model: rec.email_model,
      reason: rec.email_reason,
      features: rec.email_features ?? {},
    },
    metadata: {
      fromAddr: rec.from_addr,
      toAddr: rec.to_addr,
      subject: rec.subject,
      date: rec.email_date,
      numUrls: rec.num_urls,
      attachmentCount: rec.attachment_count,
    },
    urls: rec.urls ?? [],
    provenance: rec.source === 'server' ? 'server' : 'upload',
    review: rec.review_status
      ? {
          status: rec.review_status,
          note: rec.review_note,
          reviewedBy: rec.reviewed_by,
          reviewedAt: rec.reviewed_at,
        }
      : undefined,
  };
}

export function fromAnalyze(res: AnalyzeResponse): AnalysisResult {
  return {
    // Present only when the backend persisted the row. Everything that needs a
    // stored record — the detections link, review controls — keys off this.
    id: res.detection_id ?? undefined,
    verdict: res.verdict,
    likelihood: res.likelihood,
    summary: res.summary,
    remediation: res.remediation,
    email: {
      score: res.email.score,
      model: res.email.model,
      reason: res.email.reason,
      features: res.email.features ?? {},
    },
    metadata: {
      fromAddr: res.metadata.from_addr ?? null,
      toAddr: res.metadata.to_addr ?? null,
      subject: res.metadata.subject ?? null,
      date: res.metadata.date ?? null,
      numUrls: res.metadata.num_urls,
      attachmentCount: res.metadata.attachment_count,
    },
    urls: res.urls ?? [],
    provenance: 'analyze',
  };
}
