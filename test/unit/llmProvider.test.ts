import { describe, it, expect, afterEach, vi } from 'vitest';
import { callChatCompletion, callResumeDocumentCompletion, callVisionCompletion, normalizeChatCompletionUrl } from '@/core/ai/llmProvider';

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

  it('云端视觉请求应使用 OpenAI 兼容的 image_url 消息', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"basics":{"name":"张三"}}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const imageDataUrl = 'data:image/jpeg;base64,YQ==';

    const result = await callVisionCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'secret', model: 'vision-model' },
      '提取简历',
      imageDataUrl,
    );

    expect(result).toContain('张三');
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }),
    ]));
  });

  it('Ollama 视觉请求应剥离 data URL 前缀', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: '{}' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await callVisionCompletion(
      { enabled: true, provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llava' },
      '提取简历',
      'data:image/png;base64,YQ==',
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].images).toEqual(['YQ==']);
  });

  it('PDF 补强应同时发送本地提取文本和多页页面图', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await callResumeDocumentCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'secret', model: 'vision-model' },
      '提取简历',
      { documentText: '张三 软件工程师', imageDataUrls: ['data:image/jpeg;base64,YQ==', 'data:image/jpeg;base64,Yg=='] },
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content[0].text).toContain('张三 软件工程师');
    expect(body.messages[0].content.filter((part: any) => part.type === 'image_url')).toHaveLength(2);
  });

  it('Word 补强没有页面图时保持普通文本消息以兼容文本模型', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await callResumeDocumentCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'secret', model: 'text-model' },
      '提取简历',
      { documentText: '# 张三\n## 教育经历' },
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual(expect.stringContaining('# 张三'));
  });

  it('视觉请求拒绝外部图片 URL', async () => {
    await expect(callVisionCompletion(
      { enabled: true, provider: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'secret', model: 'vision-model' },
      '提取简历',
      'https://evil.example/resume.jpg',
    )).rejects.toThrow('只接受 JPEG、PNG 或 WebP');
  });
});
