import type { StandardResume } from '../../types/resume';
import type { FillResult, FillLogItem } from '../../types/adapter';
import { getAdapterForUrl } from '../adapters';
import { genericAdapter } from '../adapters/generic';
import { ruleStorage } from '../storage/ruleStorage';
import { setNativeValue } from './dispatcher';
import { selectCustomOption } from './selector';
import { decorateElement, scanMissingRequiredFields, scanAttachmentDropzones } from './badgeDecorator';

function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export class FormFillerEngine {
  /**
   * 执行一键填表
   */
  async fill(resume: StandardResume): Promise<FillResult> {
    const currentUrl = window.location.href;
    const startTime = Date.now();
    const customLogs: FillLogItem[] = [];
    let customFilledCount = 0;

    // 1. 优先检查并执行用户自定义网站规则 (短板 5)
    const customRule = await ruleStorage.findMatchingRuleForUrl(currentUrl);
    if (customRule && customRule.fields && customRule.fields.length > 0) {
      console.log(`[OpenJobFill] Executing custom site rule: ${customRule.name}`);
      for (const field of customRule.fields) {
        const val = getValueByPath(resume, field.resumeKey);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val);
          const elements = Array.from(document.querySelectorAll<HTMLElement>(field.selector));
          for (const el of elements) {
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              setNativeValue(el, strVal);
              customFilledCount++;
              const label = field.description || field.resumeKey;
              customLogs.push({
                status: 'success',
                label: `[自定义规则] ${label}`,
                field: field.resumeKey,
                value: strVal
              });
              decorateElement(el, {
                status: 'success',
                label,
                value: strVal
              });
            } else if (el instanceof HTMLSelectElement || el.classList.contains('select') || el.getAttribute('role') === 'combobox') {
              await selectCustomOption(el, strVal);
              customFilledCount++;
              const label = field.description || field.resumeKey;
              customLogs.push({
                status: 'success',
                label: `[自定义规则] ${label}`,
                field: field.resumeKey,
                value: strVal
              });
              decorateElement(el, {
                status: 'success',
                label,
                value: strVal
              });
            }
          }
        }
      }
    }

    // 2. 调度专属平台适配器或通用启发式适配器
    const adapter = getAdapterForUrl(currentUrl);
    console.log(`[OpenJobFill] Running autofill with adapter: ${adapter.name} (${adapter.id})`);

    if (adapter.onInit) {
      await adapter.onInit();
    }

    let result: FillResult;
    if (adapter.customFill) {
      result = await adapter.customFill(resume);
    } else {
      result = await genericAdapter.customFill!(resume);
    }

    // 合并自定义规则的填表日志与计数
    result.filledCount += customFilledCount;
    result.logs = [...customLogs, ...result.logs];

    // 3. 触发全页面必填项缺失扫描与简历附件上传区高亮
    try {
      const missingCount = scanMissingRequiredFields();
      const dropzoneCount = scanAttachmentDropzones();
      if (missingCount > 0 || dropzoneCount > 0) {
        console.log(`[OpenJobFill] Detected ${missingCount} missing required fields, ${dropzoneCount} upload dropzones.`);
      }
    } catch (e) {
      console.warn('[OpenJobFill] scanMissingRequiredFields/scanAttachmentDropzones error:', e);
    }

    return result;
  }
}

export const formFillerEngine = new FormFillerEngine();

