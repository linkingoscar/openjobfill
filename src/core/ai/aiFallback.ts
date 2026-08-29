/**
 * AI 字段兜底
 *
 * 规则引擎跑完后，把仍未命中的字段交给 LLM 一次性映射并填充。
 *
 * 三层安全护栏，确保 AI 兜底的错误率不高于纯规则：
 *   1. 只发送字段标签，不发送简历内容
 *   2. AI 返回的映射要再过一遍身份排斥检查 —— 即便模型把"紧急联系人姓名"
 *      错配到 basics.name，也会被拦下
 *   3. 简历对应字段没有值时跳过，绝不硬填
 */
import type { StandardResume } from '../../types/resume';
import type { FillLogItem } from '../../types/adapter';
import type {
  AISettings,
  UnmatchedFieldDescriptor,
  ResumeKeyOption,
  FieldIndexMapping,
  AIFieldMappingResponse,
} from '../../types/ai';
import type { FillPlan } from '../../types/pipeline';
import { getAISettings } from '../storage/aiSettingsStorage';
import { buildResumeKeyOptions } from './fieldMapper';
import { isIdentityExcluded } from '../adapters/adapterKit';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { getValueByPath } from '../../utils/objectPath';
import { findAssociatedLabelText } from '../../utils/dom';

export interface UnmatchedFieldEntry {
  element: HTMLElement;
  descriptor: UnmatchedFieldDescriptor;
}

export interface AIFallbackOutcome {
  logs: FillLogItem[];
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  filledElements: Set<HTMLElement>;
  matchedKeys: Set<string>;
}

/** 本人敏感字段：当元素命中身份排斥词时，这些 resumeKey 一律不得写入 */
const PERSONAL_SENSITIVE_PREFIXES = ['basics.name', 'basics.phone', 'basics.email', 'basics.idCardNumber'];

/**
 * 判断元素是否值得尝试填充（排除按钮、隐藏域、密码、文件等）
 */
export function isFillableElement(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    return !['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image', 'checkbox'].includes(t);
  }
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  return el.isContentEditable || ['combobox', 'listbox'].includes(el.getAttribute('role') || '');
}

/** 明显不属于"待填字段"的提示词（搜索框、验证码等） */
const FIELD_HINT_BLOCKLIST = ['搜索', 'search', '验证码', 'captcha', 'verify', '二维码', 'qrcode'];

/**
 * 判断元素是否有"像正式表单字段"的提示（label/placeholder），
 * 避免把搜索框、验证码等误交给 AI
 */
export function hasFieldHint(el: HTMLElement): boolean {
  const hint = [
    findAssociatedLabelText(el) || '',
    (el as HTMLInputElement).placeholder || '',
    el.getAttribute('aria-label') || '',
  ]
    .join(' ')
    .toLowerCase();

  if (!hint.trim()) return false;
  return !FIELD_HINT_BLOCKLIST.some((w) => hint.includes(w.toLowerCase()));
}

/**
 * 为未命中元素构造描述（只采集标签类文本，不取值）
 */
export function describeUnmatchedField(el: HTMLElement, index: number): UnmatchedFieldDescriptor {
  const input = el as HTMLInputElement;
  return {
    index,
    label: (findAssociatedLabelText(el) || '').trim(),
    placeholder: (input.placeholder || '').trim(),
    name: (el.getAttribute('name') || '').trim(),
    ariaLabel: (el.getAttribute('aria-label') || '').trim(),
    inputType: input.type || el.tagName.toLowerCase(),
  };
}

/**
 * AI 映射的二次安全校验
 * 即便模型把"紧急联系人"字段错配到本人信息，也会在这里被拦下。
 */
function isSafeMapping(el: HTMLElement, resumeKey: string): boolean {
  if (!isIdentityExcluded(el)) return true;
  // 元素属于他人（紧急联系人/家属等）时，禁止映射到本人敏感字段
  return !PERSONAL_SENSITIVE_PREFIXES.some((prefix) => resumeKey.startsWith(prefix));
}

/**
 * 按元素类型执行填充，返回是否成功
 */
async function fillElement(el: HTMLElement, strValue: string): Promise<boolean> {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'radio') {
      const labelText = (el.parentElement?.textContent || el.nextSibling?.textContent || '').trim();
      if (el.value === strValue || labelText === strValue || labelText.includes(strValue)) {
        setNativeRadioChecked(el, true);
        return true;
      }
      return false;
    }
    if (el.type === 'date' || /date|birth/i.test(el.name || '')) {
      await fillDatePicker(el, strValue);
      return true;
    }
    setNativeValue(el, strValue);
    return true;
  }

  if (el instanceof HTMLTextAreaElement) {
    setNativeValue(el, strValue);
    return true;
  }

  if (el instanceof HTMLSelectElement) {
    return selectCustomOption(el, strValue);
  }

  // 自定义组件：含分隔符优先按级联处理，否则按普通下拉
  if (strValue.includes('-') || strValue.includes('/') || strValue.includes(' ')) {
    const cascaded = await selectCascaderOptions(el, strValue);
    if (cascaded) return true;
    return selectCustomOption(el, strValue);
  }
  return selectCustomOption(el, strValue);
}

/**
 * 通过 background 发起一次批量字段映射请求
 * 返回 null 表示调用失败（上层静默回退）
 */
async function requestFieldMapping(
  settings: AISettings,
  fields: UnmatchedFieldDescriptor[],
  options: ResumeKeyOption[]
): Promise<FieldIndexMapping | null> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'AI_MAP_FIELDS',
      payload: { settings, fields, options },
    })) as AIFieldMappingResponse;

    if (!response?.success || !response.mapping) {
      console.warn('[OpenJobFill] AI 映射失败：', response?.error || '无映射返回');
      return null;
    }
    return response.mapping;
  } catch (err: any) {
    console.warn('[OpenJobFill] AI 映射消息异常：', err?.message || err);
    return null;
  }
}

/**
 * 尝试 AI 兜底
 *
 * @returns null 表示 AI 未启用或调用失败（静默回退为纯规则结果）
 */
export async function tryAIFallback(
  unmatched: UnmatchedFieldEntry[],
  resume: StandardResume
): Promise<AIFallbackOutcome | null> {
  if (unmatched.length === 0) return null;

  const settings = await getAISettings();
  if (!settings.enabled) return null;

  const options = buildResumeKeyOptions(resume);
  if (options.length === 0) return null;

  const fields = unmatched.map((u) => u.descriptor);

  const mapping = await requestFieldMapping(settings, fields, options);
  if (!mapping) return null;

  const outcome: AIFallbackOutcome = {
    logs: [],
    filledCount: 0,
    skippedCount: 0,
    failedCount: 0,
    filledElements: new Set(),
    matchedKeys: new Set(),
  };

  for (const [indexStr, resumeKey] of Object.entries(mapping)) {
    const entry = unmatched[Number(indexStr)];
    if (!entry) continue;
    const { element } = entry;
    const label = entry.descriptor.label || entry.descriptor.placeholder || resumeKey;

    // 护栏 2：身份排斥二次校验
    if (!isSafeMapping(element, resumeKey)) {
      outcome.logs.push({
        status: 'failed',
        label,
        field: resumeKey,
        value: '',
        message: 'AI 将他人字段映射到本人信息，已被安全策略拦截',
      });
      outcome.failedCount++;
      continue;
    }

    const rawValue = getValueByPath(resume, resumeKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      outcome.logs.push({
        status: 'skipped',
        label,
        field: resumeKey,
        value: '',
        message: '简历中该字段为空（AI 匹配）',
      });
      outcome.skippedCount++;
      continue;
    }

    const strValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);

    try {
      const success = await fillElement(element, strValue);
      if (success) {
        outcome.filledCount++;
        outcome.filledElements.add(element);
        outcome.matchedKeys.add(resumeKey);
        outcome.logs.push({
          status: 'success',
          label,
          field: resumeKey,
          value: strValue,
          message: 'AI 匹配',
        });
      } else {
        outcome.failedCount++;
        outcome.logs.push({
          status: 'failed',
          label,
          field: resumeKey,
          value: strValue,
          message: 'AI 匹配后填充执行未确认成功',
        });
      }
    } catch (err: any) {
      outcome.failedCount++;
      outcome.logs.push({
        status: 'failed',
        label,
        field: resumeKey,
        value: strValue,
        message: `AI 填充异常: ${err?.message || '未知'}`,
      });
    }
  }

  return outcome;
}

/**
 * AI 兜底（pipeline 版，真正运行在填充主路径上）
 *
 * 在 planGenerator 生成 FillPlan 之后调用：把 action=NEEDS_USER 的字段
 * 交给 LLM 批量映射，映射成功且通过安全检查、简历有值的项，就地改写为
 * action=FILL 并补 targetValue，由 executor 统一执行。
 *
 * 与 tryAIFallback 的区别：本函数不直接写 DOM，只改写规划，保持
 * 「规划 → 执行 → 读回验证」两阶段架构的完整性。
 *
 * @returns 被 AI 提升为 FILL 的字段数（0 表示未启用或无有效映射）
 */
export async function applyAIFallbackToPlan(
  plan: FillPlan,
  resume: StandardResume
): Promise<{ appliedCount: number }> {
  const settings = await getAISettings();
  if (!settings.enabled) return { appliedCount: 0 };

  // 只处理「需要人工但疑似可映射」的字段，开放性问题等无标准答案的自然映射不到
  const candidates = plan.items.filter(
    (item) =>
      item.action === 'NEEDS_USER' &&
      isFillableElement(item.field.element) &&
      hasFieldHint(item.field.element)
  );
  if (candidates.length === 0) return { appliedCount: 0 };

  const options = buildResumeKeyOptions(resume);
  if (options.length === 0) return { appliedCount: 0 };

  const fields = candidates.map((item, i) => ({
    index: i,
    label: item.field.label,
    placeholder: item.field.placeholder,
    name: item.field.name,
    ariaLabel: item.field.ariaLabel,
    inputType: item.field.type,
  }));

  const mapping = await requestFieldMapping(settings, fields, options);
  if (!mapping) return { appliedCount: 0 };

  let appliedCount = 0;

  for (const [indexStr, resumeKey] of Object.entries(mapping)) {
    const item = candidates[Number(indexStr)];
    if (!item) continue;

    // 护栏：身份排斥二次校验 + 简历必须有值，否则保持 NEEDS_USER
    if (!isSafeMapping(item.field.element, resumeKey)) continue;

    const rawValue = getValueByPath(resume, resumeKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    item.action = 'FILL';
    item.semanticKey = resumeKey;
    item.targetValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
    item.source = 'fallback';
    item.reason = 'AI 匹配';
    appliedCount++;
  }

  if (appliedCount > 0) {
    // 重新统计，保持 plan 计数与实际一致
    plan.highConfidenceCount = plan.items.filter((i) => i.action === 'FILL').length;
    plan.needsUserCount = plan.items.filter((i) => i.action === 'NEEDS_USER').length;
    plan.skipCount = plan.items.filter((i) => i.action === 'SKIP').length;
  }

  return { appliedCount };
}
