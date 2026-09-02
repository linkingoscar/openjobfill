export type FieldInputType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'date' 
  | 'cascader' 
  | 'file'
  | 'custom';

export interface SectionRepeaterRule {
  containerSelector: string;
  addButtonSelector: string;
  itemSelector: string;
  itemFields: Record<string, { selector: string; type?: FieldInputType; labelKeywords?: string[] }>;
}

export type FillFailureCode =
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
  | 'ai_invalid_response'
  | 'cancelled'
  // Legacy aliases kept readable for existing stored history.
  | 'missing_mapping'
  | 'strategy_error';

export interface FillLogItem {
  field: string;
  label: string;
  value: string;
  status: 'success' | 'skipped' | 'failed';
  message?: string;
  failureCode?: FillFailureCode;
  attempts?: Array<{
    strategy: string;
    outcome: 'success' | 'not_handled' | 'mismatch' | 'error';
    message?: string;
    adapterId?: string;
    executionWorld?: 'ISOLATED' | 'MAIN';
  }>;
}

import type { FillPlan, RemainingTaskItem } from './pipeline';

export interface FillResult {
  success: boolean;
  adapterName: string;
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  logs: FillLogItem[];
  durationMs: number;
  remainingTasks?: RemainingTaskItem[];
  plan?: FillPlan;
}
