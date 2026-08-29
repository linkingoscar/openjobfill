/**
 * AI 配置的本地存取
 *
 * 扩展环境存 chrome.storage.local，测试/开发环境回退到 localStorage，
 * 与项目其他存储模块保持同一风格。数据不出本机。
 */
import { DEFAULT_AI_SETTINGS, type AISettings } from '../../types/ai';

const AI_SETTINGS_KEY = 'aiSettings';

function isExtensionEnv(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.runtime?.id &&
    !!chrome.storage &&
    !!chrome.storage.local
  );
}

export async function getAISettings(): Promise<AISettings> {
  try {
    if (isExtensionEnv()) {
      return await new Promise((resolve) => {
        chrome.storage.local.get([AI_SETTINGS_KEY], (result) => {
          resolve({ ...DEFAULT_AI_SETTINGS, ...(result[AI_SETTINGS_KEY] || {}) });
        });
      });
    }
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    return { ...DEFAULT_AI_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  if (isExtensionEnv()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [AI_SETTINGS_KEY]: settings }, () => resolve());
    });
    return;
  }
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}
