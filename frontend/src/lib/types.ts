/**
 * API + normalized types for the detection/analysis surfaces.
 * API shapes mirror backend/main.py (DetectionRecord, AnalyzeResponse, UrlDetail);
 * AnalysisResult is the single normalized view-model the shared ResultDisplay
 * renders, so a server detection and a manual Analyze result read identically.
 */

export type Verdict = 'clean' | 'flag' | 'quarantine';
export type DetectionSource = 'upload' | 'server';
export type Provenance = 'server' | 'upload' | 'analyze';
export type ReviewStatus = 'false_positive' | 'confirmed';

/** A scored URL — same shape from both the detections list and analyze. */
export interface UrlDetail {
  url: string;
  model: string;
  score: number;
  reason: string;
  verdict: string;
  likelihood: number; // 0–100
  features: Record<string, number>;
}

/** GET /detections row (flat email_* fields). */
export interface DetectionRecord {
  id: number;
  created_at: string;
  source: DetectionSource;
  submitted_by: string | null;
  verdict: Verdict;
  likelihood: number;
  summary: string;
  remediation: string;
  from_addr: string | null;
  to_addr: string | null;
  subject: string | null;
  email_date: string | null;
  num_urls: number;
  attachment_count: number;
  email_score: number | null;
  email_model: string | null;
  email_reason: string | null;
  email_features: Record<string, number> | null;
  urls: UrlDetail[];
  // Optional review fields (backend contract, not built yet — type as optional).
  review_status?: ReviewStatus;
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

/** POST /analyze/email response (nested email{} + metadata{}). */
export interface AnalyzeResponse {
  verdict: Verdict;
  likelihood: number;
  summary: string;
  remediation: string;
  email: {
    score: number;
    model: string;
    reason: string;
    features: Record<string, number>;
    verdict: string;
    likelihood: number;
  };
  urls: UrlDetail[];
  metadata: {
    from_addr?: string;
    to_addr?: string;
    subject?: string;
    date?: string;
    num_urls: number;
    attachment_count: number;
  };
  /**
   * Row id of the stored detection. Null when persistence failed open — the
   * analysis is still valid, but there's no saved row to link to or review.
   */
  detection_id?: number | null;
}

/** The normalized model the shared ResultDisplay renders. */
export interface AnalysisResult {
  id?: number; // present for persisted detections
  verdict: Verdict;
  likelihood: number;
  summary: string;
  remediation: string;
  email: {
    score: number | null;
    model: string | null;
    reason: string | null;
    features: Record<string, number>;
  };
  metadata: {
    fromAddr?: string | null;
    toAddr?: string | null;
    subject?: string | null;
    date?: string | null;
    numUrls: number;
    attachmentCount: number;
  };
  urls: UrlDetail[];
  /** Label only — never drives layout, only a small source chip + review affordances. */
  provenance: Provenance;
  review?: {
    status?: ReviewStatus;
    note?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
}
