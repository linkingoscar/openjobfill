/**
 * LLM 调用提供者
 *
 * 仅在 background service worker 中调用（content script 的 fetch 受目标页面
 * CORS 限制，background 不受此限）。
 *
 * 两条通路，本地优先：
 *   - ollama            → 本地模型，零成本、零数据出机
 *   - openai-compatible → 用户自带 Key 的云端接口（DeepSeek / 通义 / 豆包等）
 */
import type { AISettings } from '../../types/ai';

export async function callChatCompletion(settings: AISettings, prompt: string): Promise<string> {
  if (settings.provider === 'ollama') {
    return callOllama(settings, prompt);
  }
  return callOpenAICompatible(settings, prompt);
}

async function callOllama(settings: AISettings, prompt: string): Promise<string> {
  const url = `${normalizeBaseUrl(settings.baseUrl)}/api/chat`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0 },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama 请求失败 (HTTP ${resp.status})，请确认本地模型已启动：ollama run ${settings.model}`);
  }

  const data = await resp.json();
  const content = data?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Ollama 返回了空内容');
  }
  return content;
}

async function callOpenAICompatible(settings: AISettings, prompt: string): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('使用云端接口需要先填写 API Key');
  }

  const url = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    throw new Error(`云端接口请求失败 (HTTP ${resp.status})，请检查 baseUrl 与 API Key`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('云端接口返回了空内容');
  }
  return content;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
