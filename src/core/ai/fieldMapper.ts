/**
 * AI 字段映射 v2：只发送页面结构与档案字段元信息，不发送档案实际值。
 */
import type { StandardResume } from '../../types/resume';
import { enumerateResumeFields } from '../schema/resumeFieldRegistry';
import type {
  UnmatchedFieldDescriptor,
  ResumeKeyOption,
  FieldIndexMapping,
  AIFieldMappingSuggestion,
} from '../../types/ai';

const MAX_FIELDS_PER_CALL = 25;

function riskForResumeField(path: string, valueKind: string): ResumeKeyOption['riskLevel'] {
  if (/^basics\.(name|firstName|lastName|phone|email|idCardNumber)$/.test(path)) return 'CRITICAL';
  if (/politicalStatus|ethnicity|familyMembers|emergencyContact|expectedSalary|birthDate|startDate|endDate|nativePlace|birthPlace|currentLocation|hukouLocation|expectedCity/.test(path)) return 'HIGH';
  if (valueKind === 'LONG_TEXT') return 'LONG_TEXT';
  if (/schoolName|major|company|title|certificates|degree/.test(path)) return 'MEDIUM';
  return 'LOW';
}

export function buildResumeKeyOptions(resume: StandardResume): ResumeKeyOption[] {
  return enumerateResumeFields(resume)
    .filter(({ definition }) => definition.fillable && definition.group !== 'qaBank')
    .map(({ path, label, value, definition }) => ({
      resumeKey: path,
      label,
      hasValue: value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 0),
      valueType: definition.valueKind,
      riskLevel: riskForResumeField(path, definition.valueKind),
    }))
    .filter((option) => option.hasValue);
}

export function buildMappingPrompt(fields: UnmatchedFieldDescriptor[], options: ResumeKeyOption[]): string {
  const limited = fields.slice(0, MAX_FIELDS_PER_CALL);
  const fieldList = limited.map((field) => JSON.stringify({
    fieldIndex: field.index,
    label: field.label,
    placeholder: field.placeholder,
    name: field.name,
    ariaLabel: field.ariaLabel,
    type: field.inputType || 'text',
    required: field.required === true,
    section: field.section || 'unknown',
    sectionIndex: field.sectionIndex,
    nearbyLabels: field.nearbyLabels || [],
    pageTitle: field.pageTitle,
    siteProfile: field.siteProfile,
    optionSummary: (field.optionSummary || []).slice(0, 20),
    riskLevel: field.riskLevel,
  })).join('\n');
  const optionList = options.map((option) => JSON.stringify({
    resumeKey: option.resumeKey,
    label: option.label,
    valueType: option.valueType,
    hasValue: option.hasValue !== false,
    riskLevel: option.riskLevel,
  })).join('\n');

  return `你是招聘表单字段映射助手。你只能做语义候选判断，不能操作网页，也不能补造求职者事实。

【待映射字段】\n${fieldList || '（无）'}

【可用档案字段】\n${optionList || '（无）'}

输出严格 JSON：
{"mappings":[{"fieldIndex":0,"resumeKey":"basics.phone","confidence":0.96,"reasonCode":"label_and_section_match","alternatives":[]}]}

约束：
1. 只能返回上方出现过的 fieldIndex 和 resumeKey；没有可靠匹配的字段不要返回。
2. confidence 必须为 0~1；拿不准必须降低 confidence，不要为了覆盖率硬猜。
3. 紧急联系人、家属、父母、配偶、推荐人、证明人等他人字段绝不能映射到 basics.name / basics.phone / basics.email / basics.idCardNumber。
4. Critical/High 字段必须依据明确标签、模块和相邻字段，普通包含关系不够。
5. 重复教育/工作/项目必须结合 sectionIndex；日期字段必须结合相邻字段判断开始/结束。
6. 只输出 JSON，不要 markdown 或解释。`;
}

export function parseMappingSuggestions(response: string): AIFieldMappingSuggestion[] {
  if (!response) return [];
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  if (!parsed || typeof parsed !== 'object') return [];

  const object = parsed as Record<string, unknown>;
  if (Array.isArray(object.mappings)) {
    return object.mappings.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const item = raw as Record<string, unknown>;
      const fieldIndex = Number(item.fieldIndex);
      const confidence = Number(item.confidence);
      if (!Number.isInteger(fieldIndex) || typeof item.resumeKey !== 'string' || !item.resumeKey.trim()) return [];
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return [];
      return [{
        fieldIndex,
        resumeKey: item.resumeKey.trim(),
        confidence,
        reasonCode: typeof item.reasonCode === 'string' && item.reasonCode.trim() ? item.reasonCode.trim().slice(0, 80) : 'model_unspecified',
        alternatives: Array.isArray(item.alternatives)
          ? item.alternatives.flatMap((alt) => {
              if (!alt || typeof alt !== 'object') return [];
              const candidate = alt as Record<string, unknown>;
              const candidateConfidence = Number(candidate.confidence);
              return typeof candidate.resumeKey === 'string' && Number.isFinite(candidateConfidence)
                ? [{ resumeKey: candidate.resumeKey, confidence: Math.max(0, Math.min(1, candidateConfidence)) }]
                : [];
            }).slice(0, 3)
          : [],
      }];
    });
  }

  // Backward compatibility for older local models returning {"0":"basics.name"}.
  return Object.entries(object).flatMap(([key, value]) => {
    const fieldIndex = Number(key);
    return Number.isInteger(fieldIndex) && typeof value === 'string' && value.trim()
      ? [{ fieldIndex, resumeKey: value.trim(), confidence: 0.75, reasonCode: 'legacy_mapping_response', alternatives: [] }]
      : [];
  });
}

/** Legacy caller compatibility. */
export function parseMappingResponse(response: string): FieldIndexMapping {
  return Object.fromEntries(parseMappingSuggestions(response).map((item) => [item.fieldIndex, item.resumeKey]));
}
