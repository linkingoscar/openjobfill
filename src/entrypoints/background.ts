import type { AISettings, UnmatchedFieldDescriptor, ResumeKeyOption } from '../types/ai';
import { callChatCompletion } from '../core/ai/llmProvider';
import { buildMappingPrompt, parseMappingResponse } from '../core/ai/fieldMapper';
import { selectCrossOriginFrameRoots } from '../core/frames/frameCoordinator';

async function getCrossOriginFrameRoots(tabId: number): Promise<Array<{ frameId: number; url: string }>> {
  const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  return selectCrossOriginFrameRoots(frames);
}

async function sendMessageToFrame(tabId: number, frameId: number, message: unknown): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, message, { frameId });
  } catch {
    // 受限页面、尚未完成加载或没有内容脚本的 frame 不参与本轮填写。
    return null;
  }
}

export default defineBackground(() => {
  console.log('[OpenJobFill] Background service worker initialized.');

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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
            payload: { resumeId: message.payload?.resumeId, analysisId },
          });
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
          });
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

    // AI 字段映射：在 background 执行，规避 content script 的 CORS 限制
    if (message.type === 'AI_MAP_FIELDS') {
      (async () => {
        try {
          const payload = message.payload as {
            settings: AISettings;
            fields: UnmatchedFieldDescriptor[];
            options: ResumeKeyOption[];
          };

          const prompt = buildMappingPrompt(payload.fields, payload.options);
          const raw = await callChatCompletion(payload.settings, prompt);
          const mapping = parseMappingResponse(raw);

          sendResponse({ success: true, mapping });
        } catch (err: any) {
          sendResponse({ success: false, error: err?.message || 'AI 调用失败' });
        }
      })();
      // 返回 true 表示异步 sendResponse
      return true;
    }
  });
});
