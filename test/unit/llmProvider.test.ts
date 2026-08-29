import { describe, it, expect, afterEach, vi } from 'vitest';
import { callChatCompletion } from '@/core/ai/llmProvider';

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
});
