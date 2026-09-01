import { describe, it, expect, afterEach, vi } from 'vitest';
import { callChatCompletion, normalizeChatCompletionUrl } from '@/core/ai/llmProvider';

describe('LLM provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Ollama 请求应使用本地聊天接口并解析回复', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '映射结果' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callChatCompletion(
      { enabled: true, provider: 'ollama', baseUrl: 'http://localhost:11434/', model: 'qwen2.5:7b' },
      '请返回 JSON'
    );

    expect(result).toBe('映射结果');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
    );
  });

  it('请求被 Abort 时应快速返回可读的超时错误，避免填表无限等待', async () => {
    const timeoutError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    await expect(
      callChatCompletion(
        { enabled: true, provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b' },
        '请返回 JSON'
      )
    ).rejects.toThrow('AI 请求超时');
  });

  it('对限流与服务端故障有限重试，但不重复拼接完整接口路径', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callChatCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1/chat/completions', apiKey: 'secret', model: 'model' },
      'prompt'
    );

    expect(result).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('https://example.com/v1/chat/completions', expect.any(Object));
    expect(normalizeChatCompletionUrl('https://example.com/v1/')).toBe('https://example.com/v1/chat/completions');
  });

  it('鉴权错误不可重试', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(callChatCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'bad', model: 'model' },
      'prompt'
    )).rejects.toThrow('HTTP 401');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
