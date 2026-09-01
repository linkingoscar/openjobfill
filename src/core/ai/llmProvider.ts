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

// AI 兜底是可选能力，网络或本地模型不可用时不能让整次填写一直转圈。
const AI_REQUEST_TIMEOUT_MS = 10_000;
const AI_MAX_ATTEMPTS = 3;

export async function callChatCompletion(settings: AISettings, prompt: string): Promise<string> {
  if (settings.provider === 'ollama') {
    return callOllama(settings, prompt);
  }
  return callOpenAICompatible(settings, prompt);
}

async function callOllama(settings: AISettings, prompt: string): Promise<string> {
  if (!settings.baseUrl?.trim()) {
    throw new Error('Ollama 地址未配置');
  }
  if (!settings.model?.trim()) {
    throw new Error('Ollama 模型未配置');
  }
  const url = `${normalizeBaseUrl(settings.baseUrl)}/api/chat`;

  const resp = await fetchWithRetry(url, {
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
  if (!settings.baseUrl?.trim()) {
    throw new Error('云端接口地址未配置');
  }
  if (!settings.model?.trim()) {
    throw new Error('云端接口模型未配置');
  }

  const url = normalizeChatCompletionUrl(settings.baseUrl);
  const isOpenRouter = /(^|\.)openrouter\.ai$/i.test(new URL(url).hostname);

  const resp = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      ...(isOpenRouter ? { 'HTTP-Referer': 'https://github.com/openjobfill/openjobfill', 'X-Title': 'OpenJobFill' } : {}),
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

export function normalizeChatCompletionUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl.trim());
  return /\/chat\/completions$/i.test(normalized) ? normalized : `${normalized}/chat/completions`;
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init);
      if (!shouldRetryStatus(response.status) || attempt === AI_MAX_ATTEMPTS) return response;
    } catch (error: any) {
      // 超时已经消耗了完整的 10 秒预算，立即回退；短暂网络故障则允许有限重试。
      if (error?.message?.includes('AI 请求超时') || attempt === AI_MAX_ATTEMPTS) throw error;
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 150));
  }
  throw lastError instanceof Error ? lastError : new Error('AI 请求失败');
}

/** 带超时的 fetch：让 AI 失败快速回退到本地规则与待办清单。 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = AI_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`AI 请求超时（${Math.round(timeoutMs / 1000)} 秒），已回退到本地规则`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
