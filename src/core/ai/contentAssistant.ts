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
}

const SENSITIVE_PATH = /idCard|familyMembers|politicalStatus|ethnicity|emergencyContact|birthDate/i;

export function buildContentAssistantContext(resume: StandardResume, job: JobContext, selectedKeys: string[]): Record<string, unknown> {
  const allowed = selectedKeys.filter((key) => !SENSITIVE_PATH.test(key));
  const facts: Record<string, unknown> = {};
  for (const key of allowed) {
    const parts = key.split('.').filter(Boolean);
    let current: unknown = resume;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') { current = undefined; break; }
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined) facts[key] = current;
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

export function validateJobVariantSuggestions(suggestions: JobVariantSuggestion[], resume: StandardResume): JobVariantSuggestion[] {
  return suggestions.filter((suggestion) => {
    if (!suggestion.suggestion?.trim()) return false;
    if (!Array.isArray(suggestion.evidenceResumeKeys) || suggestion.evidenceResumeKeys.length === 0) return false;
    return suggestion.evidenceResumeKeys.every((key) => {
      const parts = key.split('.').filter(Boolean);
      let current: unknown = resume;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return false;
        current = (current as Record<string, unknown>)[part];
      }
      return current !== undefined && current !== null && current !== '';
    });
  });
}
