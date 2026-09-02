import type { StandardResume, CustomQABankItem } from './resume';
import type { FillLogItem } from './adapter';
import type { FieldSafetyInfo } from '../core/pipeline/fieldSafety';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'cascader'
  | 'date'
  | 'date-range'
  | 'contenteditable'
  | 'file'
  | 'unknown';

export interface FieldSectionInfo {
  type: 'basic' | 'education' | 'experience' | 'project' | 'family' | 'qa' | 'unknown';
  index: number; // 0-based card index
  rawTitle?: string;
}

/** Value-free evidence used to relocate a field after a SPA rerender. */
export interface FieldLocatorEvidence {
  fingerprint: string;
  host: string;
  path: string;
  sectionType?: FieldSectionInfo['type'];
  sectionIndex: number;
  sectionTitle?: string;
  label: string;
  tagName: string;
  inputType?: string;
  name?: string;
  id?: string;
  automationId?: string;
  testId?: string;
  role?: string;
  selectors: string[];
  xpath?: string;
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
  /** Privacy-safe structural evidence used by safety, replay and future incremental scans. */
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  safety?: FieldSafetyInfo;
}

export type PlanAction = 'FILL' | 'NEEDS_USER' | 'SKIP';
export type DriverType = 'input' | 'select' | 'cascader' | 'date' | 'date-range' | 'radio' | 'checkbox' | 'contenteditable';

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

/** 可跨扩展消息边界传输的子 frame 预览项（不包含 DOM 引用）。 */
export interface RemoteFillPlanItem {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  action: PlanAction;
  targetValue?: any;
  confidence: number;
  reason?: string;
  semanticKey?: string;
  source?: FillPlanItem['source'];
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
}

/** 一个跨域 frame 在本地保存的分析快照及其可展示摘要。 */
export interface RemoteFramePlan {
  frameId: number;
  analysisId: string;
  runId?: string;
  pageFingerprint?: string;
  /** 生成计划时使用的简历快照，用于执行前的失效校验。 */
  resumeId: string;
  resumeUpdatedAt: number;
  /** 生成计划时所在的 frame URL。 */
  pageUrl: string;
  url: string;
  adapterName: string;
  items: RemoteFillPlanItem[];
  highConfidenceCount: number;
  needsUserCount: number;
  skipCount: number;
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
  /** 跨域 frame 的待办不能把 DOM 节点传回顶层，此时为空。 */
  element?: HTMLElement;
  frameUrl?: string;
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
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

export interface PlatformRepeaterConfig {
  sectionRoot?: string;
  itemSelector?: string;
  addButton?: string;
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
  
  // 平台专属经历增行与卡片配置
  repeaterConfigs?: {
    education?: PlatformRepeaterConfig;
    experience?: PlatformRepeaterConfig;
    project?: PlatformRepeaterConfig;
    family?: PlatformRepeaterConfig;
  };

  // 增行/初始化钩子
  onBeforePlan?(resume: StandardResume, doc?: Document, signal?: AbortSignal): Promise<void> | void;
}
