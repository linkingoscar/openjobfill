import type { AISettings } from '../../types/ai';
import type { StandardResume } from '../../types/resume';
import { getAISettings } from '../storage/aiSettingsStorage';
import {
  buildContentAssistantContext,
  validateJobVariantSuggestions,
  type JobContext,
  type JobVariantSuggestion,
} from './contentAssistant';

const MAX_JD_CHARS = 12_000;

function selectedVariantFactKeys(resume: StandardResume): string[] {
  const keys = [
    'basics.expectedRole', 'basics.expectedCity', 'basics.selfEvaluation',
    'basics.githubUrl', 'basics.linkedinUrl', 'basics.blogUrl', 'basics.portfolioUrl',
  ];
  resume.skills.slice(0, 20).forEach((_, index) => keys.push(`skills.${index}.name`, `skills.${index}.level`));
  resume.projects.slice(0, 8).forEach((_, index) => keys.push(
    `projects.${index}.id`, `projects.${index}.projectName`, `projects.${index}.role`,
    `projects.${index}.description`, `projects.${index}.responsibility`, `projects.${index}.achievements`, `projects.${index}.techStack`,
  ));
  resume.experiences.slice(0, 8).forEach((_, index) => keys.push(
    `experiences.${index}.id`, `experiences.${index}.company`, `experiences.${index}.title`,
    `experiences.${index}.description`, `experiences.${index}.achievements`, `experiences.${index}.techStack`,
  ));
  return keys;
}

export function buildJobVariantPrompt(context: Record<string, unknown>): string {
  return `你是求职岗位版本整理助手。你只能根据输入中的现有档案事实和当前 JD 提供“展示/排序/裁剪”建议，绝不能新增技能、经历、项目、公司、职位、日期、数字或其它不存在的事实。

输入 JSON：${JSON.stringify(context)}

输出严格 JSON：
{"suggestions":[
  {"id":"project-order-1","type":"project-order","suggestion":"优先展示更贴近 JD 的项目","evidenceResumeKeys":["projects.0.projectName"],"jdEvidence":"JD 中的相关要求","orderedIds":["project-id-2","project-id-1"]},
  {"id":"self-evaluation-1","type":"self-evaluation","resumeKey":"basics.selfEvaluation","suggestion":"压缩为岗位相关短版","evidenceResumeKeys":["basics.selfEvaluation","skills.0.name"],"jdEvidence":"JD 中的相关要求","proposedValue":"..."}
]}

允许 type：project-order、experience-order、skill-highlight、short-description、self-evaluation、link-selection。
约束：
1. evidenceResumeKeys 只能引用输入 facts 中真实存在的 key；无证据不建议。
2. project-order / experience-order 的 orderedIds 必须包含对应输入记录的全部现有 id，不能新增、删除或替换。
3. skill-highlight 的 highlightSkills 只能从输入 skills.*.name 中选择，绝不能补技能。
4. link-selection 的 selectedLinks 只能从 basics.githubUrl / linkedinUrl / blogUrl / portfolioUrl 中选择有值字段路径。
5. short-description 只允许 proposedValue 覆盖 projects.N.description/responsibility/achievements 或 experiences.N.description/achievements；只允许裁剪和重组原事实。
6. self-evaluation 只允许 resumeKey=basics.selfEvaluation，并且不能加入档案外事实。
7. 只输出 JSON，不要 markdown 或解释。`;
}

export function parseJobVariantSuggestions(raw: string): JobVariantSuggestion[] {
  const match = raw?.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const item = candidate as Record<string, unknown>;
      if (typeof item.type !== 'string' || typeof item.suggestion !== 'string') return [];
      if (!['project-order', 'experience-order', 'skill-highlight', 'short-description', 'self-evaluation', 'link-selection'].includes(item.type)) return [];
      return [{
        id: typeof item.id === 'string' ? item.id : '',
        type: item.type as JobVariantSuggestion['type'],
        resumeKey: typeof item.resumeKey === 'string' ? item.resumeKey : undefined,
        suggestion: item.suggestion,
        evidenceResumeKeys: Array.isArray(item.evidenceResumeKeys) ? item.evidenceResumeKeys.filter((key): key is string => typeof key === 'string') : [],
        jdEvidence: typeof item.jdEvidence === 'string' ? item.jdEvidence : undefined,
        proposedValue: typeof item.proposedValue === 'string' ? item.proposedValue : undefined,
        orderedIds: Array.isArray(item.orderedIds) ? item.orderedIds.filter((id): id is string => typeof id === 'string') : undefined,
        highlightSkills: Array.isArray(item.highlightSkills) ? item.highlightSkills.filter((value): value is string => typeof value === 'string') : undefined,
        selectedLinks: Array.isArray(item.selectedLinks) ? item.selectedLinks.filter((value): value is string => typeof value === 'string') : undefined,
      }];
    }).slice(0, 12);
  } catch {
    return [];
  }
}

export interface AIJobVariantRequest {
  resume: StandardResume;
  job: JobContext;
  confirmedExternalProcessing: true;
}

export async function requestAIJobVariantSuggestions(input: AIJobVariantRequest): Promise<JobVariantSuggestion[]> {
  if (!input.confirmedExternalProcessing) throw new Error('岗位版本 AI 建议必须由用户逐次确认数据发送');
  const settings: AISettings = await getAISettings();
  if (!settings.enabled) throw new Error('请先在设置中启用 AI 功能');
  const selectedKeys = selectedVariantFactKeys(input.resume);
  const context = buildContentAssistantContext(input.resume, {
    ...input.job,
    jdText: input.job.jdText?.slice(0, MAX_JD_CHARS),
  }, selectedKeys);
  const response = await chrome.runtime.sendMessage({
    type: 'AI_SUGGEST_JOB_VARIANT',
    payload: {
      settings,
      context,
      confirmedExternalProcessing: true,
    },
  }) as { success?: boolean; suggestions?: JobVariantSuggestion[]; error?: string };
  if (!response?.success || !Array.isArray(response.suggestions)) throw new Error(response?.error || 'AI 没有返回岗位版本建议');
  return validateJobVariantSuggestions(response.suggestions, input.resume);
}
