import type { AISettings, UnmatchedFieldDescriptor, ResumeKeyOption } from '../types/ai';
import { callChatCompletion } from '../core/ai/llmProvider';
import { buildMappingPrompt, parseMappingResponse } from '../core/ai/fieldMapper';

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
