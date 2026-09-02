import type { StandardResume } from '../../types/resume';
import type { AIAnswerDraft } from '../../types/ai';

export interface JobContext {
  company?: string;
  role?: string;
  jobFamily?: string;
  jdText?: string;
}

export interface JobVariantSuggestion {
  id: string;
  type: 'project-order' | 'experience-order' | 'skill-highlight' | 'short-description' | 'self-evaluation' | 'link-selection';
  resumeKey?: string;
  suggestion: string;
  evidenceResumeKeys: string[];
  jdEvidence?: string;
  /** Only content/presentation fields are actionable; fact fields are never accepted here. */
  proposedValue?: string;
  orderedIds?: string[];
  highlightSkills?: string[];
  selectedLinks?: string[];
}

const SENSITIVE_PATH = /idCard|familyMembers|politicalStatus|ethnicity|emergencyContact|birthDate/i;
const ACTIONABLE_TEXT_PATH = /^(?:basics\.selfEvaluation|projects\.\d+\.(?:description|responsibility|achievements)|experiences\.\d+\.(?:description|achievements))$/;
const LINK_PATHS = ['basics.githubUrl', 'basics.linkedinUrl', 'basics.blogUrl', 'basics.portfolioUrl'] as const;

function getPathValue(resume: StandardResume, key: string): unknown {
  const parts = key.split('.').filter(Boolean);
  let current: unknown = resume;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function buildContentAssistantContext(resume: StandardResume, job: JobContext, selectedKeys: string[]): Record<string, unknown> {
  const allowed = selectedKeys.filter((key) => !SENSITIVE_PATH.test(key));
  const facts: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = getPathValue(resume, key);
    if (value !== undefined) facts[key] = value;
  }
  return { company: job.company, role: job.role, jobFamily: job.jobFamily, jdText: job.jdText, facts };
}

export function validateAnswerDraft(draft: AIAnswerDraft, allowedResumeKeys: Set<string>, maxChars?: number): { accepted: boolean; warnings: string[] } {
  const warnings = [...(draft.warnings || [])];
  for (const key of draft.usedResumeKeys || []) {
    if (!allowedResumeKeys.has(key)) warnings.push(`草稿引用了未授权档案字段：${key}`);
  }
  if (maxChars && draft.text.length > Math.ceil(maxChars * 1.1)) warnings.push(`草稿超过字数限制：${draft.text.length}/${maxChars}`);
  if (!draft.text.trim()) warnings.push('草稿为空');
  return { accepted: warnings.length === 0, warnings };
}

export function detectCompanyNameLeak(text: string, currentCompany?: string, knownCompanies: string[] = []): string[] {
  if (!currentCompany) return [];
  const normalizedCurrent = currentCompany.toLowerCase();
  return knownCompanies.filter((company) => company && company.toLowerCase() !== normalizedCurrent && text.toLowerCase().includes(company.toLowerCase()));
}

function sameIds(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && actual.every((id) => expected.includes(id));
}

export function validateJobVariantSuggestions(suggestions: JobVariantSuggestion[], resume: StandardResume): JobVariantSuggestion[] {
  const projectIds = resume.projects.map((item) => item.id);
  const experienceIds = resume.experiences.map((item) => item.id);
  const knownSkills = new Map(resume.skills.map((item) => [item.name.trim().toLowerCase(), item.name]));
  const availableLinks = new Set(LINK_PATHS.filter((path) => {
    const value = getPathValue(resume, path);
    return typeof value === 'string' && value.trim().length > 0;
  }));

  return suggestions.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || !raw.suggestion?.trim()) return [];
    if (!Array.isArray(raw.evidenceResumeKeys) || raw.evidenceResumeKeys.length === 0) return [];
    const evidenceResumeKeys = Array.from(new Set(raw.evidenceResumeKeys.filter((key) =>
      typeof key === 'string' && !SENSITIVE_PATH.test(key) && getPathValue(resume, key) !== undefined && getPathValue(resume, key) !== null && getPathValue(resume, key) !== '',
    ))).slice(0, 16);
    if (!evidenceResumeKeys.length) return [];

    const base: JobVariantSuggestion = {
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 120) : `variant-suggestion-${raw.type}-${evidenceResumeKeys[0]}`,
      type: raw.type,
      resumeKey: typeof raw.resumeKey === 'string' ? raw.resumeKey : undefined,
      suggestion: raw.suggestion.trim().slice(0, 1000),
      evidenceResumeKeys,
      jdEvidence: typeof raw.jdEvidence === 'string' ? raw.jdEvidence.trim().slice(0, 800) : undefined,
    };

    if (raw.type === 'project-order') {
      const orderedIds = Array.isArray(raw.orderedIds) ? raw.orderedIds.filter((id): id is string => typeof id === 'string') : [];
      return sameIds(orderedIds, projectIds) ? [{ ...base, orderedIds }] : [];
    }
    if (raw.type === 'experience-order') {
      const orderedIds = Array.isArray(raw.orderedIds) ? raw.orderedIds.filter((id): id is string => typeof id === 'string') : [];
      return sameIds(orderedIds, experienceIds) ? [{ ...base, orderedIds }] : [];
    }
    if (raw.type === 'short-description' || raw.type === 'self-evaluation') {
      const resumeKey = typeof raw.resumeKey === 'string' ? raw.resumeKey : '';
      const proposedValue = typeof raw.proposedValue === 'string' ? raw.proposedValue.trim() : '';
      if (!ACTIONABLE_TEXT_PATH.test(resumeKey) || !proposedValue || proposedValue.length > 3000) return [];
      if (raw.type === 'self-evaluation' && resumeKey !== 'basics.selfEvaluation') return [];
      return [{ ...base, resumeKey, proposedValue }];
    }
    if (raw.type === 'skill-highlight') {
      const requested = Array.isArray(raw.highlightSkills) ? raw.highlightSkills.filter((item): item is string => typeof item === 'string') : [];
      const highlightSkills = Array.from(new Set(requested.map((skill) => knownSkills.get(skill.trim().toLowerCase())).filter((skill): skill is string => !!skill))).slice(0, 12);
      return highlightSkills.length ? [{ ...base, highlightSkills }] : [];
    }
    if (raw.type === 'link-selection') {
      const selectedLinks = Array.isArray(raw.selectedLinks)
        ? Array.from(new Set(raw.selectedLinks.filter((path): path is string => typeof path === 'string' && availableLinks.has(path as typeof LINK_PATHS[number]))))
        : [];
      return selectedLinks.length ? [{ ...base, selectedLinks }] : [];
    }
    return [];
  });
}
