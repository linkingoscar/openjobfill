import type { FieldDescriptor } from '../../types/pipeline';

export type FillDecision =
  | 'FILL_HIGH_CONFIDENCE'
  | 'FILL_REVIEW_REQUIRED'
  | 'OPTIONAL_UNMATCHED'
  | 'NEEDS_USER'
  | 'SKIP'
  | 'BLOCKED';

export type FieldRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LONG_TEXT' | 'LOW';

export interface DecisionPolicyInput {
  field: FieldDescriptor;
  resumeKey?: string;
  confidence: number;
  source?: 'user_rule' | 'platform_rule' | 'qa_bank' | 'semantic_dictionary' | 'ai' | 'fallback';
  hasValue: boolean;
  hasUserValue?: boolean;
  safetyBlocked?: boolean;
  firstVisit?: boolean;
}

const CRITICAL_KEYS = [
  'basics.name', 'basics.firstName', 'basics.lastName', 'basics.phone', 'basics.email', 'basics.idCardNumber',
];
const HIGH_KEY_PARTS = [
  'politicalStatus', 'ethnicity', 'familyMembers', 'emergencyContact', 'expectedSalary', 'birthDate',
  'startDate', 'endDate', 'nativePlace', 'birthPlace', 'currentLocation', 'hukouLocation', 'expectedCity',
];
const MEDIUM_KEY_PARTS = ['schoolName', 'major', 'company', 'title', 'certificates', 'degree'];

export function classifyFieldRisk(field: FieldDescriptor, resumeKey?: string): FieldRiskLevel {
  const key = resumeKey || '';
  if (CRITICAL_KEYS.includes(key)) return 'CRITICAL';
  if (HIGH_KEY_PARTS.some((part) => key.includes(part))) return 'HIGH';
  if (field.type === 'textarea' || field.type === 'contenteditable') return 'LONG_TEXT';
  if (MEDIUM_KEY_PARTS.some((part) => key.includes(part))) return 'MEDIUM';
  return 'LOW';
}

export function confidenceThreshold(risk: FieldRiskLevel): number {
  if (risk === 'CRITICAL') return 0.95;
  if (risk === 'HIGH') return 0.90;
  if (risk === 'MEDIUM') return 0.85;
  if (risk === 'LONG_TEXT') return 0.90;
  return 0.85;
}

export function decideFill(input: DecisionPolicyInput): { decision: FillDecision; risk: FieldRiskLevel; reason: string } {
  const risk = classifyFieldRisk(input.field, input.resumeKey);
  if (input.safetyBlocked) return { decision: 'BLOCKED', risk, reason: '安全策略禁止自动执行' };
  if (input.hasUserValue) return { decision: 'SKIP', risk, reason: '保护页面已有用户输入' };
  if (!input.hasValue) {
    return input.field.required
      ? { decision: 'NEEDS_USER', risk, reason: '必填字段没有可信档案值' }
      : { decision: 'OPTIONAL_UNMATCHED', risk, reason: '非必填字段暂无可靠映射' };
  }

  if (input.source === 'user_rule') {
    return risk === 'CRITICAL' && input.firstVisit
      ? { decision: 'FILL_REVIEW_REQUIRED', risk, reason: '关键身份字段首次站点需重点核对' }
      : { decision: 'FILL_HIGH_CONFIDENCE', risk, reason: '命中已确认个人站点规则' };
  }
  if (input.source === 'platform_rule' && input.confidence >= 0.98) {
    return risk === 'CRITICAL' || (risk === 'HIGH' && input.firstVisit)
      ? { decision: 'FILL_REVIEW_REQUIRED', risk, reason: '高风险字段需重点核对' }
      : { decision: 'FILL_HIGH_CONFIDENCE', risk, reason: '命中平台精确规则' };
  }

  if (input.source === 'ai') {
    if (input.confidence < 0.70) return { decision: input.field.required ? 'NEEDS_USER' : 'OPTIONAL_UNMATCHED', risk, reason: 'AI 置信度低于 0.70' };
    if (input.confidence < 0.90 || risk === 'CRITICAL' || risk === 'HIGH' || risk === 'LONG_TEXT') {
      return { decision: 'FILL_REVIEW_REQUIRED', risk, reason: 'AI 建议必须经过人工核对' };
    }
    return { decision: 'FILL_HIGH_CONFIDENCE', risk, reason: 'AI 高置信建议，仍需整体预览确认' };
  }

  const threshold = confidenceThreshold(risk);
  if (input.confidence >= threshold) {
    if (risk === 'CRITICAL' || (risk === 'HIGH' && input.firstVisit) || risk === 'LONG_TEXT') {
      return { decision: 'FILL_REVIEW_REQUIRED', risk, reason: '高风险或长文本字段必须重点核对' };
    }
    return { decision: 'FILL_HIGH_CONFIDENCE', risk, reason: `达到 ${risk} 风险阈值` };
  }
  if (input.confidence >= 0.65) return { decision: 'FILL_REVIEW_REQUIRED', risk, reason: '置信度不足以自动高置信填写' };
  return { decision: input.field.required ? 'NEEDS_USER' : 'OPTIONAL_UNMATCHED', risk, reason: '置信度低于自动映射阈值' };
}
