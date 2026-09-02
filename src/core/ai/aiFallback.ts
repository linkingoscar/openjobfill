/**
 * AI 字段兜底。
 * 主运行路径只让 AI 做“字段 -> 档案 key”语义候选；档案实际值保持本地，
 * 最终是否可填由本地白名单、安全规则、风险和置信度共同决定。
 */
import type { StandardResume } from '../../types/resume';
import type { FillLogItem } from '../../types/adapter';
import type {
  AISettings,
  UnmatchedFieldDescriptor,
  ResumeKeyOption,
  FieldIndexMapping,
  AIFieldMappingResponse,
  AIFieldMappingSuggestion,
} from '../../types/ai';
import type { FillPlan, FillPlanItem } from '../../types/pipeline';
import { getAISettings } from '../storage/aiSettingsStorage';
import { buildResumeKeyOptions } from './fieldMapper';
import { sanitizeFieldMappingSuggestions, type ValidatedAIMapping } from './protocolV2';
import { isIdentityExcluded } from '../adapters/adapterKit';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { getValueByPath } from '../../utils/objectPath';
import { findAssociatedLabelText, isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';
import { FillRunAbortedError, throwIfAborted } from '../pipeline/runContext';
import { recordRunTrace } from '../pipeline/runTrace';

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

const PERSONAL_SENSITIVE_PREFIXES = ['basics.name', 'basics.phone', 'basics.email', 'basics.idCardNumber'];

export function isFillableElement(el: HTMLElement): boolean {
  if (isInputElement(el)) {
    const t = (el.type || 'text').toLowerCase();
    return !['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image', 'checkbox'].includes(t);
  }
  if (isTextAreaElement(el)) return true;
  if (isSelectElement(el)) return true;
  return el.isContentEditable || ['combobox', 'listbox'].includes(el.getAttribute('role') || '');
}

const FIELD_HINT_BLOCKLIST = ['搜索', 'search', '验证码', 'captcha', 'verify', '二维码', 'qrcode'];

export function hasFieldHint(el: HTMLElement): boolean {
  const hint = [
    findAssociatedLabelText(el) || '',
    (el as HTMLInputElement).placeholder || '',
    el.getAttribute('aria-label') || '',
  ].join(' ').toLowerCase();
  if (!hint.trim()) return false;
  return !FIELD_HINT_BLOCKLIST.some((word) => hint.includes(word.toLowerCase()));
}

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

function isSafeMapping(el: HTMLElement, resumeKey: string): boolean {
  if (!isIdentityExcluded(el)) return true;
  return !PERSONAL_SENSITIVE_PREFIXES.some((prefix) => resumeKey.startsWith(prefix));
}

async function fillElement(el: HTMLElement, strValue: string): Promise<boolean> {
  if (isInputElement(el)) {
    if (el.type === 'radio') {
      const labelText = (el.parentElement?.textContent || el.nextSibling?.textContent || '').trim();
      if (el.value === strValue || labelText === strValue || labelText.includes(strValue)) {
        setNativeRadioChecked(el, true);
        return true;
      }
      return false;
    }
    if (el.type === 'date' || /date|birth/i.test(el.name || '')) return fillDatePicker(el, strValue);
    return setNativeValue(el, strValue);
  }
  if (isTextAreaElement(el)) return setNativeValue(el, strValue);
  if (isSelectElement(el)) return selectCustomOption(el, strValue);
  if (strValue.includes('-') || strValue.includes('/') || strValue.includes(' ')) {
    const cascaded = await selectCascaderOptions(el, strValue);
    if (cascaded) return true;
  }
  return selectCustomOption(el, strValue);
}

function legacySuggestions(mapping: FieldIndexMapping | undefined): AIFieldMappingSuggestion[] {
  if (!mapping) return [];
  return Object.entries(mapping).flatMap(([index, resumeKey]) => {
    const fieldIndex = Number(index);
    return Number.isInteger(fieldIndex) && typeof resumeKey === 'string' && resumeKey
      ? [{ fieldIndex, resumeKey, confidence: 0.75, reasonCode: 'legacy_mapping_response', alternatives: [] }]
      : [];
  });
}

/** Background request. Returned suggestions are always locally sanitized before use. */
async function requestFieldMapping(
  settings: AISettings,
  fields: UnmatchedFieldDescriptor[],
  options: ResumeKeyOption[],
  signal?: AbortSignal,
  runId?: string,
): Promise<ValidatedAIMapping[] | null> {
  try {
    recordRunTrace('ai-request', { fields, options }, runId);
    const request = chrome.runtime.sendMessage({
      type: 'AI_MAP_FIELDS',
      payload: { settings, fields, options },
    });
    const response = await raceWithSignal(request, signal) as AIFieldMappingResponse;
    if (!response?.success) {
      console.warn('[OpenJobFill] AI 映射失败：', response?.error || '无映射返回');
      return null;
    }
    const rawSuggestions = Array.isArray(response.mappings) && response.mappings.length
      ? response.mappings
      : legacySuggestions(response.mapping);
    const safeSuggestions = sanitizeFieldMappingSuggestions(rawSuggestions, fields, options);
    recordRunTrace('ai-response', {
      success: true,
      mappings: safeSuggestions.map(({ fieldIndex, resumeKey, confidence, reasonCode, disposition }) => ({
        fieldIndex, resumeKey, confidence, reasonCode, disposition,
      })),
    }, runId);
    return safeSuggestions;
  } catch (err: any) {
    recordRunTrace('ai-response', { success: false, mappings: [], aborted: !!signal?.aborted }, runId);
    console.warn('[OpenJobFill] AI 映射消息异常：', err?.message || err);
    return null;
  }
}

/** Legacy direct-write helper retained for callers outside the two-stage pipeline. */
export async function tryAIFallback(
  unmatched: UnmatchedFieldEntry[],
  resume: StandardResume,
): Promise<AIFallbackOutcome | null> {
  if (unmatched.length === 0) return null;
  const settings = await getAISettings();
  if (!settings.enabled) return null;
  const options = buildResumeKeyOptions(resume);
  if (options.length === 0) return null;
  const fields = unmatched.map((entry) => entry.descriptor);
  const suggestions = await requestFieldMapping(settings, fields, options);
  if (!suggestions) return null;

  const mapping = new Map(suggestions
    .filter((suggestion) => suggestion.disposition !== 'manual')
    .map((suggestion) => [suggestion.fieldIndex, suggestion]));
  const outcome: AIFallbackOutcome = {
    logs: [], filledCount: 0, skippedCount: 0, failedCount: 0,
    filledElements: new Set(), matchedKeys: new Set(),
  };

  for (const entry of unmatched) {
    const suggestion = mapping.get(entry.descriptor.index);
    if (!suggestion) {
      outcome.skippedCount++;
      outcome.logs.push({ status: 'skipped', label: entry.descriptor.label || entry.descriptor.placeholder, field: '', value: '', message: 'AI 未返回可执行的可靠映射，已跳过' });
      continue;
    }
    const { element } = entry;
    const resumeKey = suggestion.resumeKey;
    const label = entry.descriptor.label || entry.descriptor.placeholder || resumeKey;
    if (!isSafeMapping(element, resumeKey)) {
      outcome.failedCount++;
      outcome.logs.push({ status: 'failed', label, field: resumeKey, value: '', message: 'AI 将他人字段映射到本人信息，已被安全策略拦截' });
      continue;
    }
    const rawValue = getValueByPath(resume, resumeKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      outcome.skippedCount++;
      outcome.logs.push({ status: 'skipped', label, field: resumeKey, value: '', message: '档案中该字段为空（AI 匹配）' });
      continue;
    }
    const strValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
    try {
      const success = await fillElement(element, strValue);
      if (success) {
        outcome.filledCount++;
        outcome.filledElements.add(element);
        outcome.matchedKeys.add(resumeKey);
        outcome.logs.push({ status: 'success', label, field: resumeKey, value: strValue, message: `AI 匹配 ${(suggestion.confidence * 100).toFixed(0)}%` });
      } else {
        outcome.failedCount++;
        outcome.logs.push({ status: 'failed', label, field: resumeKey, value: strValue, message: 'AI 匹配后填充执行未确认成功' });
      }
    } catch (err: any) {
      outcome.failedCount++;
      outcome.logs.push({ status: 'failed', label, field: resumeKey, value: strValue, message: `AI 填充异常: ${err?.message || '未知'}` });
    }
  }
  return outcome;
}

function descriptorForPlanItem(item: FillPlanItem, index: number): UnmatchedFieldDescriptor {
  const field = item.field;
  return {
    index,
    label: field.label,
    placeholder: field.placeholder,
    name: field.name,
    ariaLabel: field.ariaLabel,
    inputType: field.type,
    required: field.required,
    section: field.section?.type,
    sectionIndex: field.section?.index,
    nearbyLabels: field.nearbyLabels || [],
    pageTitle: typeof document !== 'undefined' ? document.title : undefined,
    optionSummary: field.options?.slice(0, 20),
    riskLevel: item.riskLevel,
  };
}

function recalculatePlanCounts(plan: FillPlan): void {
  plan.highConfidenceCount = plan.items.filter((item) => item.action === 'FILL').length;
  plan.needsUserCount = plan.items.filter((item) => item.action === 'NEEDS_USER').length;
  plan.skipCount = plan.items.filter((item) => item.action === 'SKIP').length;
  plan.reviewRequiredCount = plan.items.filter((item) => item.decision === 'FILL_REVIEW_REQUIRED').length;
  plan.optionalUnmatchedCount = plan.items.filter((item) => item.decision === 'OPTIONAL_UNMATCHED').length;
  plan.blockedCount = plan.items.filter((item) => item.decision === 'BLOCKED').length;
}

/**
 * Pipeline AI fallback. It never writes DOM; it only enriches FillPlan decisions.
 * LOW confidence remains manual; HIGH/CRITICAL/long-text suggestions are review-required.
 */
export async function applyAIFallbackToPlan(
  plan: FillPlan,
  resume: StandardResume,
  signal?: AbortSignal,
  runId?: string,
): Promise<{ appliedCount: number }> {
  throwIfAborted(signal);
  const settings = await getAISettings();
  if (!settings.enabled) return { appliedCount: 0 };

  const candidates = plan.items.filter((item) =>
    (item.decision === 'NEEDS_USER' || item.decision === 'OPTIONAL_UNMATCHED' || item.action === 'NEEDS_USER')
    && isFillableElement(item.field.element)
    && hasFieldHint(item.field.element)
  );
  if (candidates.length === 0) return { appliedCount: 0 };

  const options = buildResumeKeyOptions(resume);
  if (options.length === 0) return { appliedCount: 0 };
  const fields = candidates.map(descriptorForPlanItem);
  const suggestions = await requestFieldMapping(settings, fields, options, signal, runId);
  if (!suggestions) return { appliedCount: 0 };

  let appliedCount = 0;
  for (const suggestion of suggestions) {
    throwIfAborted(signal);
    const item = candidates[suggestion.fieldIndex];
    if (!item || !isSafeMapping(item.field.element, suggestion.resumeKey)) continue;
    const rawValue = getValueByPath(resume, suggestion.resumeKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    if (suggestion.disposition === 'manual') {
      item.decision = item.field.required ? 'NEEDS_USER' : 'OPTIONAL_UNMATCHED';
      item.action = item.field.required ? 'NEEDS_USER' : 'SKIP';
      item.confidence = suggestion.confidence;
      item.reason = `AI 建议置信度不足：${suggestion.reasonCode}`;
      item.requiresExplicitReview = true;
      continue;
    }

    item.action = 'FILL';
    item.decision = suggestion.disposition === 'high-confidence' ? 'FILL_HIGH_CONFIDENCE' : 'FILL_REVIEW_REQUIRED';
    item.semanticKey = suggestion.resumeKey;
    item.targetValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
    item.source = 'ai';
    item.confidence = suggestion.confidence;
    item.riskLevel = options.find((option) => option.resumeKey === suggestion.resumeKey)?.riskLevel || item.riskLevel;
    item.requiresExplicitReview = suggestion.disposition !== 'high-confidence';
    item.reason = `AI ${Math.round(suggestion.confidence * 100)}% · ${suggestion.reasonCode}`;
    appliedCount++;
  }

  recalculatePlanCounts(plan);
  return { appliedCount };
}

async function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new FillRunAbortedError('填写已取消');
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new FillRunAbortedError('填写已取消'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
