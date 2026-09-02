import type { FillFailureCode } from './adapter';

export type FillHistoryStatus = 'success' | 'skipped' | 'failed';

export interface FillHistoryField {
  label: string;
  field: string;
  status: FillHistoryStatus;
  message?: string;
  failureCode?: FillFailureCode;
  attempts?: Array<{ strategy: string; outcome: 'success' | 'not_handled' | 'mismatch' | 'error' }>;
}

export interface FillHistoryTask {
  label: string;
  type: string;
  required: boolean;
  reason: string;
  frameUrl?: string;
  failureCode?: string;
}

export interface FillHistoryRecord {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  pageTitle: string;
  pageUrl: string;
  hostname: string;
  adapterName: string;
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  verifiedCount?: number;
  reviewRequiredCount?: number;
  optionalUnmatchedCount?: number;
  blockedCount?: number;
  aiMappingCount?: number;
  durationMs: number;
  phase: 'analysis' | 'execution';
  operationError?: string;
  fields: FillHistoryField[];
  remainingTasks: FillHistoryTask[];
}
