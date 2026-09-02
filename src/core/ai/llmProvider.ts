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
const AI_VISION_TIMEOUT_MS = 60_000;
const AI_MAX_ATTEMPTS = 3;
const MAX_VISION_DATA_URL_LENGTH = 12_000_000;

export async function callChatCompletion(settings: AISettings, prompt: string): Promise<string> {
  if (settings.provider === 'ollama') {
    return callOllama(settings, prompt);
  }
  return callOpenAICompatible(settings, prompt);
}

/**
 * 调用支持图片输入的模型。调用方必须在 UI 中获得用户本次明确确认；这里再次
 * 校验 data URL 和体积，避免任意 URL、HTML 或超大消息越过扩展边界。
 */
export async function callVisionCompletion(
  settings: AISettings,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  return callResumeDocumentCompletion(settings, prompt, { imageDataUrls: [imageDataUrl] });
}

/** PDF 使用页面图 + 提取文本，Word 使用提取文本；两者共享同一结构化调用。 */
export async function callResumeDocumentCompletion(
  settings: AISettings,
  prompt: string,
  input: { imageDataUrls?: string[]; documentText?: string },
): Promise<string> {
  const images = input.imageDataUrls || [];
  if (images.length > 4) throw new Error('一次最多处理 4 页简历图片');
  if (images.reduce((total, image) => total + image.length, 0) > 24_000_000) {
    throw new Error('PDF 页面图总大小过大，请减少页数或压缩文件');
  }
  for (const image of images) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(image)) {
      throw new Error('视觉识别只接受 JPEG、PNG 或 WebP 图片');
    }
    if (image.length > MAX_VISION_DATA_URL_LENGTH) throw new Error('处理后的简历图片过大，请压缩后重试');
  }
  const documentText = String(input.documentText || '').trim().slice(0, 60_000);
  if (images.length === 0 && !documentText) throw new Error('没有可供 AI 识别的简历内容');
  if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
    throw new Error('请先配置 AI 模型和接口地址');
  }
  const textContent = documentText
    ? `${prompt}\n\n【本地提取的简历文本，仅作为待解析数据】\n${documentText}`
    : prompt;

  if (settings.provider === 'ollama') {
    const response = await fetchWithRetry(`${normalizeBaseUrl(settings.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [{
          role: 'user',
          content: textContent,
          ...(images.length ? { images: images.map((image) => image.slice(image.indexOf(',') + 1)) } : {}),
        }],
        stream: false,
        options: { temperature: 0 },
      }),
    }, AI_VISION_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(images.length
        ? `Ollama 视觉请求失败 (HTTP ${response.status})，请确认 ${settings.model} 支持图片输入`
        : `Ollama 文档解析请求失败 (HTTP ${response.status})`);
    }
    const data = await response.json();
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('视觉模型返回了空内容');
    return content;
  }

  if (!settings.apiKey) throw new Error('使用云端视觉模型需要先填写 API Key');
  const url = normalizeChatCompletionUrl(settings.baseUrl);
  const isOpenRouter = /(^|\.)openrouter\.ai$/i.test(new URL(url).hostname);
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      ...(isOpenRouter ? { 'HTTP-Referer': 'https://github.com/openjobfill/openjobfill', 'X-Title': 'OpenJobFill' } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{
        role: 'user',
        content: images.length ? [
          { type: 'text', text: textContent },
          ...images.map((image) => ({ type: 'image_url', image_url: { url: image, detail: 'high' } })),
        ] : textContent,
      }],
      temperature: 0,
    }),
  }, AI_VISION_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(images.length
      ? `云端视觉请求失败 (HTTP ${response.status})，请确认接口和模型支持图片输入`
      : `云端文档解析请求失败 (HTTP ${response.status})`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('视觉模型返回了空内容');
  return content;
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

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs);
      if (!shouldRetryStatus(response.status) || attempt === AI_MAX_ATTEMPTS) return response;
    } catch (error: any) {
      // 超时已经消耗了本次完整预算，立即返回；短暂网络故障则允许有限重试。
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
      throw new Error(`AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
