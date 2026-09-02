/**
 * AI 字段映射：把规则引擎未命中的页面字段，批量映射到简历字段
 *
 * 一次 LLM 调用处理全部未命中字段（而非每字段一次），把成本压到最低。
 * 传给 LLM 的只有"字段标签"与"简历字段名清单"，简历的实际内容不参与。
 */
import type { StandardResume } from '../../types/resume';
import { enumerateResumeFields } from '../schema/resumeFieldRegistry';
import type {
  UnmatchedFieldDescriptor,
  ResumeKeyOption,
  FieldIndexMapping,
} from '../../types/ai';

/** 单次喂给 LLM 的未命中字段上限，防止超长表单撑爆上下文与费用 */
const MAX_FIELDS_PER_CALL = 25;

/**
 * 从简历中提取"有值"的字段清单，作为 LLM 可映射的候选。
 * 只取 key 与可读标签，不取值本身。
 */
export function buildResumeKeyOptions(resume: StandardResume): ResumeKeyOption[] {
  return enumerateResumeFields(resume)
    // Domain-scoped QA answers are handled by the dedicated rule matcher, never by general AI mapping.
    .filter(({ definition }) => definition.fillable && definition.group !== 'qaBank')
    .map(({ path, label }) => ({ resumeKey: path, label }));
}

/**
 * 构造字段映射 prompt
 */
export function buildMappingPrompt(
  fields: UnmatchedFieldDescriptor[],
  options: ResumeKeyOption[]
): string {
  const limited = fields.slice(0, MAX_FIELDS_PER_CALL);

  const fieldList = limited
    .map((f) => {
      const hints = [f.label, f.placeholder, f.ariaLabel, f.name].filter(Boolean).join(' / ');
      return `[${f.index}] ${hints} (类型:${f.inputType || 'text'})`;
    })
    .join('\n');

  const optionList = options.map((o) => `${o.resumeKey} = ${o.label}`).join('\n');

  return `你是招聘表单的字段映射助手。下面左边是一个招聘网页上自动识别失败的表单字段，右边是求职者简历里可用的字段（resumeKey = 中文含义）。

【待映射的表单字段】（编号只是索引，不是顺序）
${fieldList || '（无）'}

【简历可用字段】
${optionList}

请输出一个 JSON 对象，把每个表单字段编号映射到最合适的 resumeKey，例如 {"0":"basics.nativePlace.city","3":"familyMembers.0.name"}。

严格遵守：
1. 只输出 JSON 对象本身，不要 markdown 代码块、不要任何解释文字。
2. 没有合适的简历字段时，该编号映射为 null。
3. 涉及"紧急联系人 / 家属 / 父母 / 配偶 / 推荐人 / 证明人"的字段，只能映射到 familyMembers.* 系列，绝不能映射到 basics.name / basics.phone / basics.email / basics.idCardNumber（那是求职者本人的信息）。
4. 拿不准就映射为 null，不要硬猜。

现在输出 JSON：`;
}

/**
 * 从 LLM 响应中提取映射 JSON
 *
 * LLM 常会用 ```json 包裹或附带前后文，这里做宽松提取；
 * 解析失败时返回空映射（宁可不填，不可错填）。
 */
export function parseMappingResponse(response: string): FieldIndexMapping {
  if (!response) return {};

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null) return {};

  const mapping: FieldIndexMapping = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx)) continue;
    if (typeof value === 'string' && value.trim()) {
      mapping[idx] = value.trim();
    }
  }
  return mapping;
}
