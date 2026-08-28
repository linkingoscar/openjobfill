import type { StandardResume, CustomQABankItem } from './resume';
import type { FillLogItem } from './adapter';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'cascader'
  | 'date'
  | 'contenteditable'
  | 'file'
  | 'unknown';

export interface FieldSectionInfo {
  type: 'basic' | 'education' | 'experience' | 'project' | 'family' | 'qa' | 'unknown';
  index: number; // 0-based card index
  rawTitle?: string;
}

/**
 * 页面表单字段结构化描述符 (由 PageAnalyzer 提取)
 */
export interface FieldDescriptor {
  id: string;
  element: HTMLElement;
  type: FieldType;
  label: string;
  placeholder: string;
  name: string;
  ariaLabel: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  currentValue: any;
  options?: string[]; // 对于 select / radio group / combobox
  section?: FieldSectionInfo;
  contextText: string;
}

export type PlanAction = 'FILL' | 'NEEDS_USER' | 'SKIP';
export type DriverType = 'input' | 'select' | 'cascader' | 'date' | 'radio' | 'checkbox' | 'contenteditable';

/**
 * 单个字段的填表规划决策
 */
export interface FillPlanItem {
  id: string;
  field: FieldDescriptor;
  semanticKey?: string;
  targetValue?: any;
  confidence: number;
  action: PlanAction;
  reason?: string;
  source?: 'platform_rule' | 'user_rule' | 'qa_bank' | 'semantic_dictionary' | 'fallback';
  driverType: DriverType;
}

/**
 * 整个页面的填表规划大纲
 */
export interface FillPlan {
  items: FillPlanItem[];
  highConfidenceCount: number;
  needsUserCount: number;
  skipCount: number;
  totalFieldsCount: number;
}

/**
 * 待办未解决/需人工核对的任务项
 */
export interface RemainingTaskItem {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  reason: string;
  element: HTMLElement;
}

/**
 * 管道执行结果
 */
export interface PipelineExecutionResult {
  success: boolean;
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  verifiedCount: number;
  logs: FillLogItem[];
  remainingTasks: RemainingTaskItem[];
  durationMs: number;
  plan: FillPlan;
}

/**
 * 平台特征增强器 (替换原有整页接管的 monolithic adapter)
 */
export interface PlatformEnhancer {
  id: string;
  name: string;
  description?: string;
  priority: number;
  matches(url: string, doc?: Document): boolean;
  
  // 增强字段属性识别
  enhanceField?(field: FieldDescriptor): Partial<FieldDescriptor> | null;
  
  // 平台专属静态选择器映射
  fieldMappings?: Record<string, string>; // CSS Selector -> Semantic Key
  
  // 增行/初始化钩子
  onBeforePlan?(resume: StandardResume, doc?: Document): Promise<void> | void;
}
