import type { CustomQABankItem, QABankAnswerVersion, QAScope } from '../../types/resume';

export type ScopedQAScope = Exclude<QAScope, 'domain'>;
export type QAAnswerVersion = QABankAnswerVersion;

export interface ScopedQAItem {
  id: string;
  question: string;
  keywords: string[];
  scope: ScopedQAScope;
  jobFamily?: string;
  companyDomain?: string;
  jobPostingId?: string;
  versions: QAAnswerVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface QAMatchContext {
  hostname?: string;
  jobFamily?: string;
  jobPostingId?: string;
  maxChars?: number;
}

const SCOPE_RANK: Record<ScopedQAScope, number> = {
  global: 1,
  'job-family': 2,
  'company-domain': 3,
  'job-posting': 4,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s:：*?？!！,，.。()（）\[\]【】_-]/g, '');
}

function keywordScore(question: string, item: ScopedQAItem): number {
  const query = normalize(question);
  const canonical = normalize(item.question);
  if (!query || !canonical) return 0;
  if (query === canonical) return 1;
  if (query.includes(canonical) || canonical.includes(query)) return 0.9;
  let score = 0;
  for (const keyword of item.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword && query.includes(normalizedKeyword)) score = Math.max(score, normalizedKeyword.length / Math.max(query.length, 1));
  }
  return Math.min(0.85, score * 1.6);
}

function scopeMatches(item: ScopedQAItem, context: QAMatchContext): boolean {
  if (item.scope === 'global') return true;
  if (item.scope === 'job-family') return !!item.jobFamily && !!context.jobFamily && normalize(item.jobFamily) === normalize(context.jobFamily);
  if (item.scope === 'company-domain') {
    const expected = String(item.companyDomain || '').toLowerCase().replace(/^\.+|\.+$/g, '');
    const actual = String(context.hostname || '').toLowerCase().replace(/^\.+|\.+$/g, '');
    return !!expected && !!actual && (actual === expected || actual.endsWith(`.${expected}`));
  }
  return !!item.jobPostingId && !!context.jobPostingId && item.jobPostingId === context.jobPostingId;
}

function chooseVersion(item: ScopedQAItem, maxChars?: number): QAAnswerVersion | null {
  const confirmed = item.versions.filter((version) => version.confirmedByUser && version.answer.trim());
  if (!confirmed.length) return null;
  if (!maxChars || maxChars <= 0) {
    return [...confirmed].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || b.createdAt - a.createdAt)[0];
  }
  const fitting = confirmed.filter((version) => version.answer.length <= maxChars);
  if (!fitting.length) return null;
  return [...fitting].sort((a, b) => {
    const aTarget = a.maxChars || a.answer.length;
    const bTarget = b.maxChars || b.answer.length;
    const aDelta = Math.abs(maxChars - aTarget);
    const bDelta = Math.abs(maxChars - bTarget);
    return aDelta - bDelta || b.answer.length - a.answer.length;
  })[0];
}

/** Normalize the persisted Resume v5 QA shape into the matcher model. */
export function toScopedQAItem(item: CustomQABankItem, now = Date.now()): ScopedQAItem | null {
  const question = (item.question || item.keyword || '').trim();
  if (!question) return null;
  const rawScope = item.scope === 'domain' ? 'company-domain' : item.scope || 'global';
  const scope: ScopedQAScope = ['global', 'job-family', 'company-domain', 'job-posting'].includes(rawScope)
    ? rawScope as ScopedQAScope
    : 'global';
  const versions = Array.isArray(item.versions) && item.versions.length
    ? item.versions.filter((version) => !!version?.answer).map((version) => ({ ...version }))
    : item.answer?.trim()
      ? [{
          id: `qa-version-${item.id}-legacy`,
          answer: item.answer,
          createdAt: now,
          confirmedByUser: true,
          source: 'manual' as const,
        }]
      : [];
  return {
    id: item.id,
    question,
    keywords: item.keyword.split(/[,，/、\s|]+/).map((keyword) => keyword.trim()).filter(Boolean),
    scope,
    jobFamily: item.jobFamily,
    companyDomain: item.companyDomain || item.domain,
    jobPostingId: item.jobPostingId,
    versions,
    createdAt: Math.min(...versions.map((version) => version.createdAt || now), now),
    updatedAt: Math.max(...versions.map((version) => version.createdAt || now), now),
  };
}

export function matchScopedQA(question: string, bank: ScopedQAItem[], context: QAMatchContext = {}): { item: ScopedQAItem; version: QAAnswerVersion; score: number } | null {
  const matches = bank.flatMap((item) => {
    if (!scopeMatches(item, context)) return [];
    const score = keywordScore(question, item);
    if (score < 0.45) return [];
    const version = chooseVersion(item, context.maxChars);
    return version ? [{ item, version, score }] : [];
  });
  if (!matches.length) return null;
  matches.sort((a, b) => SCOPE_RANK[b.item.scope] - SCOPE_RANK[a.item.scope] || b.score - a.score || (b.version.lastUsedAt || 0) - (a.version.lastUsedAt || 0));
  return matches[0];
}

export function matchResumeQABank(question: string, bank: CustomQABankItem[], context: QAMatchContext = {}) {
  return matchScopedQA(question, bank.flatMap((item) => {
    const normalized = toScopedQAItem(item);
    return normalized ? [normalized] : [];
  }), context);
}

export function learnQA(input: {
  question: string;
  answer: string;
  scope: ScopedQAScope;
  jobFamily?: string;
  companyDomain?: string;
  jobPostingId?: string;
  maxChars?: number;
  source: QAAnswerVersion['source'];
  confirmedByUser: boolean;
  existing?: ScopedQAItem;
  now?: number;
}): ScopedQAItem {
  const now = input.now ?? Date.now();
  const item = input.existing ? { ...input.existing, versions: [...input.existing.versions] } : {
    id: `qa-${now}-${Math.random().toString(36).slice(2, 7)}`,
    question: input.question.trim(),
    keywords: input.question.split(/[，,;；/\s]+/).filter(Boolean),
    scope: input.scope,
    jobFamily: input.jobFamily,
    companyDomain: input.companyDomain,
    jobPostingId: input.jobPostingId,
    versions: [],
    createdAt: now,
    updatedAt: now,
  } as ScopedQAItem;
  const duplicate = item.versions.find((version) => normalize(version.answer) === normalize(input.answer));
  if (!duplicate) {
    item.versions.push({ id: `qa-v-${now}-${Math.random().toString(36).slice(2, 7)}`, answer: input.answer.trim(), maxChars: input.maxChars, createdAt: now, confirmedByUser: input.confirmedByUser, source: input.source });
  }
  item.updatedAt = now;
  return item;
}

export function recordQAUsage(item: ScopedQAItem, versionId: string, pageUrl: string, now = Date.now()): ScopedQAItem {
  let safeUrl = '';
  try { const url = new URL(pageUrl); safeUrl = `${url.origin}${url.pathname}`; } catch {}
  return {
    ...item,
    updatedAt: now,
    versions: item.versions.map((version) => version.id === versionId ? { ...version, lastUsedAt: now, lastUsedUrl: safeUrl } : version),
  };
}
