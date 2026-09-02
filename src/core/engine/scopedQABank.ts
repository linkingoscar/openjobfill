export type QAScope = 'global' | 'job-family' | 'company-domain' | 'job-posting';

export interface QAAnswerVersion {
  id: string;
  answer: string;
  maxChars?: number;
  createdAt: number;
  lastUsedAt?: number;
  lastUsedUrl?: string;
  confirmedByUser: boolean;
  source: 'manual' | 'ai-confirmed';
}

export interface ScopedQAItem {
  id: string;
  question: string;
  keywords: string[];
  scope: QAScope;
  jobFamily?: string;
  companyDomain?: string;
  jobPostingId?: string;
  versions: QAAnswerVersion[];
}

export interface QAMatchContext {
  hostname?: string;
  jobFamily?: string;
  jobPostingId?: string;
  maxChars?: number;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s，。！？、,.!?;；:：()（）\[\]【】]/g, '');
}

function scopeRank(item: ScopedQAItem, context: QAMatchContext): number {
  if (item.scope === 'job-posting') return item.jobPostingId && item.jobPostingId === context.jobPostingId ? 400 : -1;
  if (item.scope === 'company-domain') {
    if (!item.companyDomain || !context.hostname) return -1;
    const a = context.hostname.toLowerCase(); const b = item.companyDomain.toLowerCase();
    return a === b || a.endsWith(`.${b}`) ? 300 : -1;
  }
  if (item.scope === 'job-family') return item.jobFamily && item.jobFamily === context.jobFamily ? 200 : -1;
  return 100;
}

function questionScore(question: string, item: ScopedQAItem): number {
  const q = normalize(question);
  const candidates = [item.question, ...item.keywords].filter(Boolean).map(normalize);
  let score = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === q) score = Math.max(score, 1);
    else if (q.includes(candidate) || candidate.includes(q)) score = Math.max(score, 0.85);
    else {
      const hits = item.keywords.filter((keyword) => q.includes(normalize(keyword))).length;
      score = Math.max(score, Math.min(0.8, hits * 0.25));
    }
  }
  return score;
}

function selectVersion(versions: QAAnswerVersion[], maxChars?: number): QAAnswerVersion | null {
  const confirmed = versions.filter((version) => version.confirmedByUser);
  if (!confirmed.length) return null;
  if (!maxChars) return [...confirmed].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || b.createdAt - a.createdAt)[0];
  const fitting = confirmed.filter((version) => version.answer.length <= maxChars);
  if (fitting.length) return fitting.sort((a, b) => b.answer.length - a.answer.length)[0];
  return confirmed.sort((a, b) => a.answer.length - b.answer.length)[0];
}

export function matchScopedQA(question: string, items: ScopedQAItem[], context: QAMatchContext = {}): { item: ScopedQAItem; version: QAAnswerVersion; score: number } | null {
  let best: { item: ScopedQAItem; version: QAAnswerVersion; score: number; rank: number } | null = null;
  for (const item of items) {
    const rank = scopeRank(item, context);
    if (rank < 0) continue;
    const score = questionScore(question, item);
    if (score < 0.5) continue;
    const version = selectVersion(item.versions, context.maxChars);
    if (!version) continue;
    if (!best || rank > best.rank || (rank === best.rank && score > best.score)) best = { item, version, score, rank };
  }
  return best ? { item: best.item, version: best.version, score: best.score } : null;
}

export function learnQA(input: {
  question: string;
  answer: string;
  scope: QAScope;
  jobFamily?: string;
  companyDomain?: string;
  jobPostingId?: string;
  source: QAAnswerVersion['source'];
  confirmedByUser: boolean;
  now?: number;
}): ScopedQAItem {
  if (!input.confirmedByUser) throw new Error('仅允许学习用户手工输入或明确确认的 AI 草稿');
  const now = input.now ?? Date.now();
  return {
    id: `qa-${now}`,
    question: input.question.trim(),
    keywords: input.question.split(/[，,。！？!?、\s]+/).map((item) => item.trim()).filter((item) => item.length >= 2).slice(0, 8),
    scope: input.scope,
    jobFamily: input.jobFamily,
    companyDomain: input.companyDomain,
    jobPostingId: input.jobPostingId,
    versions: [{ id: `qa-answer-${now}`, answer: input.answer, createdAt: now, source: input.source, confirmedByUser: true }],
  };
}
