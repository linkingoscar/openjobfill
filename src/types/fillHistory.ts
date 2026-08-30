export type FillHistoryStatus = 'success' | 'skipped' | 'failed';

export interface FillHistoryField {
  label: string;
  field: string;
  status: FillHistoryStatus;
  message?: string;
}

export interface FillHistoryTask {
  label: string;
  type: string;
  required: boolean;
  reason: string;
  frameUrl?: string;
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
  durationMs: number;
  phase: 'analysis' | 'execution';
  operationError?: string;
  fields: FillHistoryField[];
  remainingTasks: FillHistoryTask[];
}
