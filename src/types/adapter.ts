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
  /** 列表容器选择器 */
  containerSelector: string;
  /** "添加经历" 按钮选择器 */
  addButtonSelector: string;
  /** 单项条目选择器 */
  itemSelector: string;
  /** 条目内字段选择器相对路径映射 */
  itemFields: Record<string, { selector: string; type?: FieldInputType; labelKeywords?: string[] }>;
}

export interface FillLogItem {
  field: string;
  label: string;
  value: string;
  status: 'success' | 'skipped' | 'failed';
  message?: string;
  failureCode?: 'missing_mapping' | 'safety_blocked' | 'adapter_not_handled' | 'strategy_error' | 'verification_mismatch' | 'cancelled';
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
