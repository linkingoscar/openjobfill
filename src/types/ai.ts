/**
 * AI 字段兜底相关类型
 *
 * 设计约束（个人使用、体验第一、本地优先、省成本、隐私）：
 *   - 规则引擎始终优先，AI 只处理规则没命中的长尾字段
 *   - 所有未命中字段合并为一次 LLM 调用（省成本），而非每字段一次
 *   - 发给 LLM 的只有字段"标签"（label/placeholder/name），绝不包含简历"值"
 *   - LLM 只返回 标签→resumeKey 的映射，简历值在本地取出填充，内容不出本机
 */

export type AIProviderType = 'ollama' | 'openai-compatible';

export interface AISettings {
  /** 是否启用 AI 兜底。默认关闭 —— 未配置时保持纯本地规则模式 */
  enabled: boolean;
  provider: AIProviderType;
  /**
   * Ollama: 形如 http://localhost:11434
   * OpenAI 兼容: 形如 https://api.deepseek.com（将拼接 /chat/completions）
   */
  baseUrl: string;
  /** Ollama 本地调用无需 Key；云端 OpenAI 兼容接口必填 */
  apiKey?: string;
  model: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:7b',
};

/** 规则引擎未命中的页面字段描述。注意：只含"问题"，不含简历"答案" */
export interface UnmatchedFieldDescriptor {
  index: number;
  label: string;
  placeholder: string;
  name: string;
  ariaLabel: string;
  inputType: string;
}

/** 可供映射的简历字段候选（key + 可读标签，不含值） */
export interface ResumeKeyOption {
  resumeKey: string;
  label: string;
}

/** LLM 返回的映射：未命中字段 index → resumeKey */
export type FieldIndexMapping = Record<number, string>;

/** background 返回给 content script 的 AI 映射结果 */
export interface AIFieldMappingResponse {
  success: boolean;
  mapping?: FieldIndexMapping;
  error?: string;
}
