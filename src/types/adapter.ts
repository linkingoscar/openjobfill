import type { StandardResume } from './resume';

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

export interface FieldMappingRule {
  /** 简历字段路径，例如 'basics.name', 'educations.0.schoolName', 'basics.phone' */
  resumeKey: string;
  /** DOM 选择器或用于匹配的启发式规则 */
  selector?: string;
  /** 字段类型 */
  type?: FieldInputType;
  /** 匹配标签文本，如 ['姓名', '真实姓名', 'Candidate Name'] */
  labelKeywords?: string[];
  /** 映射下拉选项值映射字典，如 { '男': '1', '女': '2' } */
  optionMapping?: Record<string, string>;
  /** 自定义处理函数 */
  handler?: (element: HTMLElement, value: any, resume: StandardResume) => Promise<boolean>;
}

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

export interface SiteAdapter {
  id: string;
  name: string;
  description: string;
  /** URL 匹配规则，支持字符串前缀或正则匹配 */
  matches: (url: string) => boolean;
  /** 优先级，数值越大优先级越高 */
  priority: number;
  /** 页面初始化前的钩子 */
  onInit?: () => Promise<void>;
  /** 专属字段映射规则 */
  rules?: FieldMappingRule[];
  /** 动态多段经历增行规则 (教育经历、工作实习、项目经历等) */
  repeaters?: {
    educations?: SectionRepeaterRule;
    experiences?: SectionRepeaterRule;
    projects?: SectionRepeaterRule;
  };
  /** 自定义填表逻辑 */
  customFill?: (resume: StandardResume) => Promise<FillResult>;
}

export interface FillLogItem {
  field: string;
  label: string;
  value: string;
  status: 'success' | 'skipped' | 'failed';
  message?: string;
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
