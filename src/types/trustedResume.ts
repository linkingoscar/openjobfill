import type { StandardResume } from './resume';

export type FieldEvidenceType = 'text-range' | 'page-region' | 'manual' | 'derived' | 'site-input';

export interface FieldEvidence {
  type: FieldEvidenceType;
  fileId?: string;
  page?: number;
  text?: string;
  start?: number;
  end?: number;
  locator?: string;
}

export type FieldMetaSource =
  | 'manual'
  | 'local-parser'
  | 'ai-parser'
  | 'json-import'
  | 'derived'
  | 'site-learned';

export interface FieldMeta {
  source: FieldMetaSource;
  confidence?: number;
  evidence?: FieldEvidence[];
  confirmed: boolean;
  locked: boolean;
  confirmedAt?: number;
  updatedAt: number;
  /** Explicit opt-out without deleting a fact from the profile. */
  autoFillEnabled?: boolean;
}

export interface ResumeVariantContext {
  company?: string;
  role?: string;
  jobFamily?: string;
  jdSnapshotId?: string;
}

export interface ResumeVariantOrdering {
  /** Stores only stable record IDs so master fact edits still flow into variants. */
  projects?: string[];
  experiences?: string[];
}

export interface ResumeV5 extends StandardResume {
  schemaVersion: 5;
  fieldMeta: Record<string, FieldMeta>;
  parentResumeId?: string;
  variantType?: 'master' | 'job-variant';
  variantContext?: ResumeVariantContext;
  /** Job variants persist only content fields that intentionally override the parent. */
  variantOverrides?: string[];
  /** Reordering is sidecar metadata rather than a full-array override. */
  variantOrdering?: ResumeVariantOrdering;
}

export interface ParsedCandidate<T = unknown> {
  path: string;
  value: T;
  confidence: number;
  evidence: FieldEvidence[];
  parserRule: string;
}

export interface ImportConflict {
  path: string;
  currentValue: unknown;
  candidateValue: unknown;
  currentMeta?: FieldMeta;
  candidateMeta: FieldMeta;
  reason: 'locked' | 'confirmed-different' | 'parser-disagreement' | 'invalid';
}

export interface ImportMergeResult {
  resume: ResumeV5;
  acceptedPaths: string[];
  conflicts: ImportConflict[];
}
