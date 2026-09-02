/** AI 能力类型。规则引擎始终优先，字段映射不发送档案实际值。 */
export type AIProviderType = 'ollama' | 'openai-compatible';

export interface AISettings {
  enabled: boolean;
  provider: AIProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Full-document parsing and answer drafting require an explicit per-request confirmation by default. */
  confirmFullResumeSend?: boolean;
  timeoutMs?: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:7b',
  confirmFullResumeSend: true,
  timeoutMs: 30_000,
};

/** Value-free page context. No resume values are permitted in this object. */
export interface UnmatchedFieldDescriptor {
  index: number;
  label: string;
  placeholder: string;
  name: string;
  ariaLabel: string;
  inputType: string;
  required?: boolean;
  section?: 'basic' | 'education' | 'experience' | 'project' | 'family' | 'qa' | 'unknown';
  sectionIndex?: number;
  nearbyLabels?: string[];
  pageTitle?: string;
  siteProfile?: string;
  optionSummary?: string[];
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LONG_TEXT' | 'LOW';
}

/** Value-free resume field option. hasValue is boolean only; the actual value never leaves the browser for field mapping. */
export interface ResumeKeyOption {
  resumeKey: string;
  label: string;
  valueType?: string;
  hasValue?: boolean;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LONG_TEXT' | 'LOW';
}

/** Legacy mapping shape retained for existing callers. */
export type FieldIndexMapping = Record<number, string>;

export interface AIFieldMappingSuggestion {
  fieldIndex: number;
  resumeKey: string;
  confidence: number;
  reasonCode: string;
  alternatives?: Array<{ resumeKey: string; confidence: number }>;
}

export interface AIFieldMappingV2Payload {
  fields: UnmatchedFieldDescriptor[];
  options: ResumeKeyOption[];
}

export interface AIFieldMappingV2Response {
  success: boolean;
  mappings?: AIFieldMappingSuggestion[];
  error?: string;
}

/** Backward-compatible background response. New implementations should prefer mappings. */
export interface AIFieldMappingResponse {
  success: boolean;
  mapping?: FieldIndexMapping;
  mappings?: AIFieldMappingSuggestion[];
  error?: string;
}

export interface AIDocumentCandidate {
  path: string;
  value: unknown;
  confidence: number;
  evidence?: { page?: number; quote?: string };
}

export interface AIDocumentParseResponse {
  candidates: AIDocumentCandidate[];
  warnings: string[];
}

export interface AIAnswerDraft {
  text: string;
  usedResumeKeys: string[];
  warnings: string[];
  requestedLimit?: number;
}
