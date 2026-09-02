import type { AISettings, UnmatchedFieldDescriptor, ResumeKeyOption } from '../types/ai';
import { callChatCompletion, callResumeDocumentCompletion, callVisionCompletion } from '../core/ai/llmProvider';
import { buildMappingPrompt, parseMappingResponse, parseMappingSuggestions } from '../core/ai/fieldMapper';
import { buildAnswerDraftPrompt, parseAnswerDraftResponse } from '../core/ai/answerDraftService';
import { buildJobVariantPrompt, parseJobVariantSuggestions } from '../core/ai/jobVariantAssistant';
import { buildVisionResumePrompt, parseVisionResumeResponse } from '../core/importers/visionResumeImporter';
import { selectCrossOriginFrameRoots } from '../core/frames/frameCoordinator';
import { resumeStorage, RESUME_STORAGE_MESSAGE_TYPES } from '../core/storage/resumeStorage';
import { trackerStorage, TRACKER_STORAGE_MESSAGE_TYPES } from '../core/storage/trackerStorage';
import { isExtensionMessage, type ExtensionMessage } from '../types/message';

let resumeWriteQueue: Promise<void> = Promise.resolve();
const runtimeInjectedTabs = new Set<number>();
const RUNTIME_SCRIPT_FILE = 'content-runtime.js';
const mainWorldAuthorizations = new Map<string, {
  tabId: number;
  frameId: number;
  runId: string;
  requestId: string;
  expiresAt: number;
}>();

type MainWorldPayload = {
  action: 'TYPE' | 'SELECT_TEXT' | 'SELECT_PATH';
  selectors: string[];
  value: string | string[];
};

/** Fixed, self-contained MAIN-world driver. Never accepts source code or arbitrary event names. */
async function runMainWorldControlAction(payload: MainWorldPayload): Promise<{ success: boolean; reason?: string }> {
  const findTarget = (): HTMLElement | null => {
    for (const selector of payload.selectors) {
      try {
        const candidate = document.querySelector<HTMLElement>(selector);
        if (candidate) return candidate;
      } catch {}
    }
    return null;
  };
  const visible = (element: HTMLElement): boolean => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0'
      && rect.width > 0
      && rect.height > 0;
  };
  const normalize = (value: string): string => value.toLowerCase().replace(/[\s:：*\-_/（）()\[\]【】]/g, '');
  const dispatchClick = (element: HTMLElement): void => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
  };
  const setText = (element: HTMLElement, value: string): boolean => {
    const writable = element.matches('input, textarea, [contenteditable="true"]')
      ? element
      : element.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, [contenteditable="true"]');
    if (!writable) return false;
    if (writable instanceof HTMLInputElement && ['password', 'file', 'hidden'].includes(writable.type)) return false;
    writable.focus();
    if (writable instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) return false;
      setter.call(writable, value);
      const tracker = (writable as HTMLInputElement & { _valueTracker?: { setValue(value: string): void } })._valueTracker;
      tracker?.setValue('');
    } else if (writable instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) return false;
      setter.call(writable, value);
    } else {
      writable.textContent = value;
    }
    try {
      writable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    } catch {
      writable.dispatchEvent(new Event('input', { bubbles: true }));
    }
    writable.dispatchEvent(new Event('change', { bubbles: true }));
    writable.blur();
    return true;
  };
  const target = findTarget();
  if (!target) return { success: false, reason: 'target_not_found' };
  const optionSelector = [
    '[role="option"]', '[role="menuitem"]', '[role="treeitem"]',
    '.ant-select-item-option', '.ant-cascader-menu-item', '.el-select-dropdown__item', '.el-cascader-node',
    '.semi-select-option', '.mtd-select-item', '.ivu-select-item', '.ivu-cascader-menu-item',
    '.layui-form-select dd', '.moka-select-item', '.moka-option', '.phoenix-select-option',
    '.sc-select-option', '.pop-panel td', '.dialog-box li', '[class*="option-item"]', '[class*="cascader-item"]',
  ].join(',');
  const popupId = target?.getAttribute('aria-controls')
    || target?.getAttribute('aria-owns')
    || target?.querySelector<HTMLElement>('[aria-controls], [aria-owns]')?.getAttribute('aria-controls')
    || target?.querySelector<HTMLElement>('[aria-controls], [aria-owns]')?.getAttribute('aria-owns')
    || '';
  const waitForOption = async (wanted: string): Promise<HTMLElement | null> => {
    const expected = normalize(wanted);
    for (let attempt = 0; attempt < 24; attempt++) {
      const optionRoot = popupId ? document.getElementById(popupId) : document;
      const candidates = optionRoot
        ? Array.from(optionRoot.querySelectorAll<HTMLElement>(optionSelector)).filter(visible)
        : [];
      const exact = candidates.find((candidate) => normalize(candidate.textContent || '') === expected);
      const fuzzy = candidates.find((candidate) => {
        const actual = normalize(candidate.textContent || '');
        return !!actual && (actual.includes(expected) || expected.includes(actual));
      });
      if (exact || fuzzy) return exact || fuzzy || null;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  };

  if (payload.action === 'TYPE') {
    if (Array.isArray(payload.value)) return { success: false, reason: 'invalid_value' };
    return { success: setText(target, payload.value) };
  }

  const values = Array.isArray(payload.value) ? payload.value : [payload.value];
  if (values.length === 0) return { success: false, reason: 'invalid_value' };
  const searchInput = target.matches('input:not([readonly])')
    ? target
    : target.querySelector<HTMLElement>('input:not([readonly])');
  dispatchClick(searchInput || target);
  if (payload.action === 'SELECT_TEXT' && searchInput) setText(searchInput, values[0]);

  for (const value of values) {
    const option = await waitForOption(value);
    if (!option) return { success: false, reason: 'option_not_found' };
    dispatchClick(option);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return { success: true };
}

function issueMainWorldToken(tabId: number, frameId: number, runId: string, requestId: string): string {
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  for (const [key, authorization] of mainWorldAuthorizations) {
    if (authorization.expiresAt <= now) mainWorldAuthorizations.delete(key);
  }
  while (mainWorldAuthorizations.size >= 200) {
    const oldest = mainWorldAuthorizations.keys().next().value as string | undefined;
    if (!oldest) break;
    mainWorldAuthorizations.delete(oldest);
  }
  mainWorldAuthorizations.set(token, { tabId, frameId, runId, requestId, expiresAt: now + 15_000 });
  return token;
}

function enqueueResumeWrite(operation: () => Promise<void>): Promise<void> {
  const next = resumeWriteQueue.catch(() => undefined).then(operation);
  resumeWriteQueue = next.catch(() => undefined);
  return next;
}

async function getCrossOriginFrameRoots(tabId: number): Promise<Array<{ frameId: number; url: string }>> {
  const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  return selectCrossOriginFrameRoots(frames);
}

async function sendMessageToFrame(tabId: number, frameId: number, message: ExtensionMessage): Promise<unknown> {
  try {
    return await chrome.tabs.sendMessage(tabId, message, { frameId });
  } catch {
    // 受限页面、尚未完成加载或没有内容脚本的 frame 不参与本轮填写。
    return null;
  }
}

async function ensureContentRuntime(tabId: number): Promise<void> {
  if (runtimeInjectedTabs.has(tabId)) return;
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [RUNTIME_SCRIPT_FILE],
  });
  runtimeInjectedTabs.add(tabId);
}

export default defineBackground(() => {
  console.log('[OpenJobFill] Background service worker initialized.');

  chrome.tabs.onRemoved?.addListener((tabId) => {
    runtimeInjectedTabs.delete(tabId);
    for (const [token, authorization] of mainWorldAuthorizations) {
      if (authorization.tabId === tabId) mainWorldAuthorizations.delete(token);
    }
  });
  // 完整导航会销毁页面上下文，即使标签页 ID 不变也必须允许下一页重新注入。
  chrome.webNavigation?.onCommitted?.addListener((details) => {
    const hadRuntime = runtimeInjectedTabs.delete(details.tabId);
    if (hadRuntime && details.frameId !== 0) {
      // 子 frame 自己导航时顶层页面仍在，探测器不会重新触发；主动补注入
      // 让下一次跨域 frame 分析不会命中一个已经被导航销毁的上下文。
      void ensureContentRuntime(details.tabId).catch((error) => {
        console.warn('[OpenJobFill] Child frame runtime reinjection skipped:', error);
      });
    }
  });

  // 监听插件图标点击或快捷键
  chrome.commands?.onCommand?.addListener(async (command) => {
    if (command === 'trigger_autofill') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTO_FILL' });
      }
    }
  });

  // 监听来自 Content Script 或 Popup 的消息
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isExtensionMessage(message)) {
      sendResponse({ success: false, error: '扩展消息格式无效' });
      return;
    }

    if (message.type === 'RECRUITMENT_PAGE_DETECTED') {
      const tabId = sender.tab?.id;
      if (tabId === undefined || (sender.frameId ?? 0) !== 0) {
        sendResponse({ success: false, error: '无法确定招聘页面标签页' });
        return;
      }
      ensureContentRuntime(tabId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[OpenJobFill] Content runtime injection failed:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : '页面运行时注入失败' });
        });
      return true;
    }

    if (message.type === 'ENSURE_RUNTIME_AND_FORWARD') {
      const tabId = sender.tab?.id;
      if (tabId === undefined || (sender.frameId ?? 0) !== 0) {
        sendResponse({ success: false, error: '无法确定当前标签页' });
        return;
      }
      (async () => {
        await ensureContentRuntime(tabId);
        const response = await sendMessageToFrame(tabId, 0, {
          type: 'RUNTIME_TRIGGER_AUTO_FILL',
          payload: message.payload,
        });
        sendResponse(response || { success: false, error: '页面运行时没有响应' });
      })().catch((error) => {
        console.error('[OpenJobFill] Content runtime forward failed:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '页面运行时注入失败' });
      });
      return true;
    }

    if (message.type === 'AUTHORIZE_MAIN_WORLD_CONTROL') {
      const tabId = sender.tab?.id;
      const frameId = sender.frameId ?? 0;
      if (tabId === undefined || sender.id !== chrome.runtime.id) {
        sendResponse({ success: false, error: 'MAIN world 请求来源无效' });
        return;
      }
      const token = issueMainWorldToken(tabId, frameId, message.payload.runId, message.payload.requestId);
      sendResponse({ success: true, token });
      return;
    }

    if (message.type === 'EXECUTE_MAIN_WORLD_CONTROL') {
      const tabId = sender.tab?.id;
      const frameId = sender.frameId ?? 0;
      const authorization = mainWorldAuthorizations.get(message.payload.token);
      mainWorldAuthorizations.delete(message.payload.token);
      if (
        tabId === undefined
        || sender.id !== chrome.runtime.id
        || !authorization
        || authorization.expiresAt <= Date.now()
        || authorization.tabId !== tabId
        || authorization.frameId !== frameId
        || authorization.runId !== message.payload.runId
        || authorization.requestId !== message.payload.requestId
      ) {
        sendResponse({ success: false, error: 'MAIN world 一次性授权无效或已过期' });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: 'MAIN',
        func: runMainWorldControlAction,
        args: [{
          action: message.payload.action,
          selectors: message.payload.selectors,
          value: message.payload.value,
        }],
      }).then((results) => {
        const result = results[0]?.result as { success?: boolean; reason?: string } | undefined;
        sendResponse({ success: result?.success === true, error: result?.reason });
      }).catch((error) => {
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'MAIN world 执行失败' });
      });
      return true;
    }

    if (message.type === RESUME_STORAGE_MESSAGE_TYPES.SAVE) {
      const resume = message.payload?.resume;
      if (!resume || typeof resume !== 'object') {
        sendResponse({ success: false, error: '简历数据格式无效' });
        return;
      }
      enqueueResumeWrite(() => resumeStorage.saveResumeDirect(resume))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '保存简历失败' }));
      return true;
    }

    if (message.type === RESUME_STORAGE_MESSAGE_TYPES.UPDATE_FIELDS) {
      const id = message.payload?.id;
      const updates = message.payload?.updates;
      if (typeof id !== 'string' || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
        sendResponse({ success: false, error: '简历更新参数无效' });
        return;
      }
      enqueueResumeWrite(() => resumeStorage.updateResumeFieldsDirect(id, updates))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '更新简历失败' }));
      return true;
    }

    if (message.type === RESUME_STORAGE_MESSAGE_TYPES.APPEND_ARRAY_ITEM) {
      const id = message.payload?.id;
      const path = message.payload?.path;
      if (typeof id !== 'string' || typeof path !== 'string' || !('item' in (message.payload || {}))) {
        sendResponse({ success: false, error: '简历数组更新参数无效' });
        return;
      }
      enqueueResumeWrite(() => resumeStorage.appendResumeArrayItemDirect(id, path, message.payload.item))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '更新简历失败' }));
      return true;
    }

    if (message.type === RESUME_STORAGE_MESSAGE_TYPES.REPLACE_ALL) {
      const resumes = message.payload?.resumes;
      if (!Array.isArray(resumes)) {
        sendResponse({ success: false, error: '简历列表格式无效' });
        return;
      }
      enqueueResumeWrite(() => resumeStorage.replaceAllResumes(resumes))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '恢复简历失败' }));
      return true;
    }

    if (message.type === RESUME_STORAGE_MESSAGE_TYPES.DELETE) {
      const id = message.payload?.id;
      if (typeof id !== 'string' || !id) {
        sendResponse({ success: false, error: '简历 ID 无效' });
        return;
      }
      enqueueResumeWrite(() => resumeStorage.deleteResume(id))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '删除简历失败' }));
      return true;
    }

    if (message.type.startsWith('TRACKER_STORAGE_') && sender.id !== chrome.runtime.id) {
      sendResponse({ success: false, error: '投递记录存储请求来源无效' });
      return;
    }

    if (message.type === TRACKER_STORAGE_MESSAGE_TYPES.GET) {
      trackerStorage.getApplicationsDirect()
        .then((applications) => sendResponse({ success: true, applications }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '读取投递记录失败' }));
      return true;
    }

    if (message.type === TRACKER_STORAGE_MESSAGE_TYPES.SAVE) {
      trackerStorage.saveApplicationDirect(message.payload.application)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '保存投递记录失败' }));
      return true;
    }

    if (message.type === TRACKER_STORAGE_MESSAGE_TYPES.REPLACE_ALL) {
      trackerStorage.saveApplicationsDirect(message.payload.applications)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '恢复投递记录失败' }));
      return true;
    }

    if (message.type === TRACKER_STORAGE_MESSAGE_TYPES.DELETE) {
      trackerStorage.deleteApplicationDirect(message.payload.id)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '删除投递记录失败' }));
      return true;
    }

    if (message.type === TRACKER_STORAGE_MESSAGE_TYPES.UPDATE_STATUS) {
      trackerStorage.updateApplicationStatusDirect(message.payload.id, message.payload.status)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error?.message || '更新投递状态失败' }));
      return true;
    }

    if (message.type === 'OPEN_OPTIONS_PAGE') {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return;
    }

    if (message.type === 'ANALYZE_CROSS_ORIGIN_FRAMES') {
      return (async () => {
        const tabId = sender.tab?.id;
        if (tabId === undefined || (sender.frameId ?? 0) !== 0) {
          return { success: false, plans: [] };
        }

        const analysisId = `frame-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const frames = await getCrossOriginFrameRoots(tabId);
        const responses = await Promise.all(frames.map(async (frame) => {
          const response = await sendMessageToFrame(tabId, frame.frameId, {
            type: 'FRAME_ANALYZE',
            payload: {
              resumeId: message.payload?.resumeId,
              analysisId,
              runId: message.payload?.runId,
            },
          }) as { success?: boolean; plan?: import('../types/pipeline').RemoteFramePlan } | null;
          if (!response?.success || !response.plan) return null;
          return { ...response.plan, frameId: frame.frameId, url: frame.url };
        }));

        return { success: true, plans: responses.filter(Boolean) };
      })().catch((err) => ({ success: false, plans: [], error: err?.message || '跨域子页面分析失败' }));
    }

    if (message.type === 'EXECUTE_CROSS_ORIGIN_FRAMES') {
      return (async () => {
        const tabId = sender.tab?.id;
        const targets = Array.isArray(message.payload?.targets) ? message.payload.targets : [];
        if (tabId === undefined || (sender.frameId ?? 0) !== 0) {
          return { success: false, results: [] };
        }

        const responses = await Promise.all(targets.map(async (target: { frameId: number; analysisId: string }) => {
          const response = await sendMessageToFrame(tabId, target.frameId, {
            type: 'FRAME_EXECUTE',
            payload: { analysisId: target.analysisId },
          }) as { success?: boolean; result?: Record<string, unknown> } | null;
          return response?.success && response.result
            ? { ...response.result, frameId: target.frameId }
            : null;
        }));
        return { success: true, results: responses.filter(Boolean) };
      })().catch((err) => ({ success: false, results: [], error: err?.message || '跨域子页面填写失败' }));
    }

    if (message.type === 'CANCEL_CROSS_ORIGIN_FRAMES') {
      return (async () => {
        const tabId = sender.tab?.id;
        const targets = Array.isArray(message.payload?.targets) ? message.payload.targets : [];
        if (tabId !== undefined && (sender.frameId ?? 0) === 0) {
          await Promise.all(targets.map((target: { frameId: number; analysisId: string }) =>
            sendMessageToFrame(tabId, target.frameId, {
              type: 'FRAME_CANCEL_ANALYSIS',
              payload: { analysisId: target.analysisId },
            })
          ));
        }
        return { success: true };
      })();
    }

    // AI 字段映射：在 background 执行，规避 content script 的 CORS 限制。
    // 同时返回 v2 suggestions 和 legacy mapping，旧本地模型仍能兼容。
    if (message.type === 'AI_MAP_FIELDS') {
      (async () => {
        try {
          const payload: {
            settings: AISettings;
            fields: UnmatchedFieldDescriptor[];
            options: ResumeKeyOption[];
          } = message.payload;

          const prompt = buildMappingPrompt(payload.fields, payload.options);
          const raw = await callChatCompletion(payload.settings, prompt);
          const mappings = parseMappingSuggestions(raw);
          const mapping = parseMappingResponse(raw);

          sendResponse({ success: true, mappings, mapping });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 调用失败' });
        }
      })();
      return true;
    }

    // 开放题草稿只有用户逐次确认数据发送后才允许请求；background 只返回候选文本，不写 DOM。
    if (message.type === 'AI_DRAFT_ANSWER') {
      (async () => {
        try {
          const { settings, question, maxChars, context } = message.payload;
          if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
          const raw = await callChatCompletion(settings, buildAnswerDraftPrompt({ question, maxChars, context }));
          const draft = parseAnswerDraftResponse(raw);
          if (!draft) throw new Error('AI 草稿响应格式无效');
          sendResponse({ success: true, draft });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 开放题草稿生成失败' });
        }
      })();
      return true;
    }

    // 岗位版本 AI 只返回基于现有 facts/JD 的结构化建议。最终采用由 UI 逐项确认并写入 job variant。
    if (message.type === 'AI_SUGGEST_JOB_VARIANT') {
      (async () => {
        try {
          const { settings, context } = message.payload;
          if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
          const raw = await callChatCompletion(settings, buildJobVariantPrompt(context));
          const suggestions = parseJobVariantSuggestions(raw);
          sendResponse({ success: true, suggestions });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 岗位版本建议生成失败' });
        }
      })();
      return true;
    }

    // 用户在导入弹窗逐次确认后才会发送完整简历图片。解析仍在 background
    // 执行，避免 options 页面 CORS，并让接口密钥只用于扩展内部请求。
    if (message.type === 'AI_PARSE_RESUME_IMAGE') {
      (async () => {
        try {
          const { settings, imageDataUrl, fileName } = message.payload;
          if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
          const raw = await callVisionCompletion(settings, buildVisionResumePrompt(), imageDataUrl);
          const resume = parseVisionResumeResponse(raw, fileName);
          sendResponse({ success: true, resume });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 视觉简历识别失败' });
        }
      })();
      return true;
    }

    if (message.type === 'AI_PARSE_RESUME_DOCUMENT') {
      (async () => {
        try {
          const { settings, imageDataUrls, documentText, fileName } = message.payload;
          if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
          const raw = await callResumeDocumentCompletion(settings, buildVisionResumePrompt(), {
            imageDataUrls,
            documentText,
          });
          const resume = parseVisionResumeResponse(raw, fileName);
          sendResponse({ success: true, resume });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 简历补强失败' });
        }
      })();
      return true;
    }
  });
});
