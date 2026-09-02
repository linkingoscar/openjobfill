export type RunFailureCode =
  | 'mapping_missing'
  | 'mapping_low_confidence'
  | 'site_rule_stale'
  | 'adapter_not_matched'
  | 'adapter_not_handled'
  | 'write_error'
  | 'verification_mismatch'
  | 'verification_unreadable'
  | 'attachment_unverified'
  | 'page_changed'
  | 'resume_changed'
  | 'safety_blocked'
  | 'ai_timeout'
  | 'ai_invalid_response';

export interface RedactedFieldFailure {
  fieldFingerprint?: string;
  semanticKey?: string;
  fieldType?: string;
  code: RunFailureCode;
  source?: string;
  confidence?: number;
  strategy?: string;
}

export interface RunSummary {
  id: string;
  hostname: string;
  pageFingerprint?: string;
  resumeId: string;
  resumeUpdatedAt: number;
  scannedCount: number;
  plannedCount: number;
  highConfidenceCount: number;
  reviewRequiredCount: number;
  manualTaskCount: number;
  verifiedCount: number;
  failedCount: number;
  aiMappingCount: number;
  manualCorrectionCount: number;
  attachmentStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MISMATCH' | 'UNREADABLE' | 'NOT_HANDLED';
  failures: RedactedFieldFailure[];
  startedAt: number;
  durationMs: number;
}

const SENSITIVE_KEYS = /phone|email|idCard|passport|name|address|description|answer|selfEvaluation|family|emergency/i;

export function sanitizeDiagnosticValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticValue);
  if (typeof value !== 'object') return typeof value === 'string' ? '[redacted]' : value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key) || /value|text|content|raw/i.test(key)) {
      result[key] = '[redacted]';
      continue;
    }
    result[key] = sanitizeDiagnosticValue(item);
  }
  return result;
}

export function stableAutoFillRate(summary: Pick<RunSummary, 'plannedCount' | 'verifiedCount' | 'manualCorrectionCount'>): number {
  if (summary.plannedCount <= 0) return 0;
  return Math.max(0, summary.verifiedCount - summary.manualCorrectionCount) / summary.plannedCount;
}

export function buildLocalQualityDashboard(runs: RunSummary[]): {
  totalRuns: number;
  byHost: Record<string, { runs: number; verifiedRate: number; failureRate: number }>;
  failureCodes: Record<RunFailureCode, number>;
  recentDegradedHosts: string[];
} {
  const byHost: Record<string, { runs: number; verified: number; planned: number; failed: number }> = {};
  const failureCodes = {} as Record<RunFailureCode, number>;
  for (const run of runs) {
    const host = byHost[run.hostname] ||= { runs: 0, verified: 0, planned: 0, failed: 0 };
    host.runs += 1; host.verified += run.verifiedCount; host.planned += run.plannedCount; host.failed += run.failedCount;
    for (const failure of run.failures) failureCodes[failure.code] = (failureCodes[failure.code] || 0) + 1;
  }
  const normalizedHosts: Record<string, { runs: number; verifiedRate: number; failureRate: number }> = {};
  for (const [hostname, value] of Object.entries(byHost)) {
    normalizedHosts[hostname] = {
      runs: value.runs,
      verifiedRate: value.planned ? value.verified / value.planned : 0,
      failureRate: value.planned ? value.failed / value.planned : 0,
    };
  }
  const recentDegradedHosts = Object.entries(normalizedHosts).filter(([, value]) => value.runs >= 2 && value.failureRate > 0.15).sort((a, b) => b[1].failureRate - a[1].failureRate).map(([host]) => host);
  return { totalRuns: runs.length, byHost: normalizedHosts, failureCodes, recentDegradedHosts };
}
