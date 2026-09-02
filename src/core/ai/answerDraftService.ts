import type { AIAnswerDraft, AISettings } from '../../types/ai';
import type { StandardResume } from '../../types/resume';
import { getAISettings } from '../storage/aiSettingsStorage';
import { buildContentAssistantContext, type JobContext, validateAnswerDraft } from './contentAssistant';

const MAX_JD_CHARS = 12_000;
const MAX_QUESTION_CHARS = 500;

function safeFactKeys(resume: StandardResume): string[] {
  const keys = ['basics.expectedRole', 'basics.selfEvaluation'];
  resume.skills.slice(0, 12).forEach((_, index) => keys.push(`skills.${index}.name`, `skills.${index}.level`));
  resume.projects.slice(0, 4).forEach((_, index) => keys.push(
    `projects.${index}.projectName`, `projects.${index}.role`, `projects.${index}.description`,
    `projects.${index}.responsibility`, `projects.${index}.achievements`, `projects.${index}.techStack`,
  ));
  resume.experiences.slice(0, 4).forEach((_, index) => keys.push(
    `experiences.${index}.company`, `experiences.${index}.title`, `experiences.${index}.description`,
    `experiences.${index}.achievements`, `experiences.${index}.techStack`,
  ));
  return keys;
}

export interface AIAnswerDraftRequest {
  resume: StandardResume;
  question: string;
  maxChars?: number;
  job?: JobContext;
  /** Must come from a user action immediately before the request. */
  confirmedExternalProcessing: true;
}

export interface AIAnswerDraftResponse {
  draft: AIAnswerDraft;
  accepted: boolean;
  warnings: string[];
}

export function buildAnswerDraftPrompt(input: {
  question: string;
  maxChars?: number;
  context: Record<string, unknown>;
}): string {
  const payload = JSON.stringify({
    question: input.question.slice(0, MAX_QUESTION_CHARS),
    maxChars: input.maxChars,
    context: input.context,
  });
  return `你是求职申请开放题草稿助手。只允许基于输入 facts 和当前 JD 生成草稿，严禁补造经历、技能、数字、公司关系或身份事实。
输入 JSON：${payload}
输出严格 JSON：{"text":"...","usedResumeKeys":["projects.0.description"],"warnings":[],"requestedLimit":200}
约束：
1. usedResumeKeys 只能引用输入 facts 中真实存在的 key；没有证据的事实不要写。
2. 如果问题要求的信息在 facts/JD 中不存在，warnings 中写明“缺少事实依据”，正文使用保守表达，不能虚构。
3. 如果提供 maxChars，正文必须尽量不超过该字符数，最大误差 10%。
4. 不输出 markdown，不输出 JSON 以外文本。`;
}

export function parseAnswerDraftResponse(raw: string): AIAnswerDraft | null {
  const match = raw?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof parsed.text !== 'string') return null;
    return {
      text: parsed.text.trim(),
      usedResumeKeys: Array.isArray(parsed.usedResumeKeys) ? parsed.usedResumeKeys.filter((key): key is string => typeof key === 'string').slice(0, 40) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 20) : [],
      requestedLimit: typeof parsed.requestedLimit === 'number' && Number.isFinite(parsed.requestedLimit) ? parsed.requestedLimit : undefined,
    };
  } catch {
    return null;
  }
}

export async function requestAIAnswerDraft(input: AIAnswerDraftRequest): Promise<AIAnswerDraftResponse> {
  if (!input.confirmedExternalProcessing) throw new Error('AI 草稿必须由用户逐次确认数据发送');
  const settings: AISettings = await getAISettings();
  if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
  const selectedKeys = safeFactKeys(input.resume);
  const job = {
    ...input.job,
    jdText: input.job?.jdText?.slice(0, MAX_JD_CHARS),
  };
  const context = buildContentAssistantContext(input.resume, job, selectedKeys);
  const response = await chrome.runtime.sendMessage({
    type: 'AI_DRAFT_ANSWER',
    payload: {
      settings,
      question: input.question.slice(0, MAX_QUESTION_CHARS),
      maxChars: input.maxChars,
      context,
      confirmedExternalProcessing: true,
    },
  }) as { success?: boolean; draft?: AIAnswerDraft; error?: string };
  if (!response?.success || !response.draft) throw new Error(response?.error || 'AI 没有返回可校验草稿');
  const validation = validateAnswerDraft(response.draft, new Set(selectedKeys), input.maxChars);
  return { draft: response.draft, accepted: validation.accepted, warnings: validation.warnings };
}
