import type { AIProviderType } from '../../types/ai';

export interface AIProviderPreset {
  name: string;
  provider: AIProviderType;
  baseUrl: string;
  defaultModel: string;
  placeholderKey: string;
}

export const AI_PROVIDER_PRESETS = {
  ollama: { name: 'Ollama 本地模型（推荐）', provider: 'ollama', baseUrl: 'http://localhost:11434', defaultModel: 'qwen2.5:7b', placeholderKey: '本地无需 API Key' },
  deepseek: { name: 'DeepSeek 官方 API', provider: 'openai-compatible', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', placeholderKey: 'sk-...' },
  openai: { name: 'OpenAI 官方', provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', placeholderKey: 'sk-proj-...' },
  moonshot: { name: 'Kimi / Moonshot', provider: 'openai-compatible', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k', placeholderKey: 'sk-...' },
  zhipu: { name: '智谱 GLM', provider: 'openai-compatible', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash', placeholderKey: '...' },
  qwen: { name: '阿里云通义千问', provider: 'openai-compatible', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', placeholderKey: 'sk-...' },
  siliconflow: { name: '硅基流动', provider: 'openai-compatible', baseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3', placeholderKey: 'sk-...' },
  openrouter: { name: 'OpenRouter', provider: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', placeholderKey: 'sk-or-v1-...' },
  custom: { name: '自定义 OpenAI 兼容接口', provider: 'openai-compatible', baseUrl: 'http://localhost:8000/v1', defaultModel: 'custom-model', placeholderKey: '可选 API Key' },
} as const satisfies Record<string, AIProviderPreset>;

export type AIProviderPresetId = keyof typeof AI_PROVIDER_PRESETS;
