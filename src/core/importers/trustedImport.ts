import type { StandardResume } from '../../types/resume';
import type { ImportConflict, ParsedCandidate, ResumeV5 } from '../../types/trustedResume';
import { mergeParsedCandidates, migrateToResumeV5 } from '../schema/trustedResume';

const META_KEYS = new Set(['id', 'title', 'isDefault', 'createdAt', 'updatedAt', 'schemaVersion', 'fieldMeta', 'variantType', 'variantContext', 'variantOverrides', 'parentResumeId']);

function usable(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 0);
}

function evidenceFor(value: unknown, documentText: string, fileName: string) {
  if (typeof value !== 'string' && typeof value !== 'number') return [];
  const needle = String(value).trim();
  if (!needle || needle.length > 500 || !documentText) return [];
  const index = documentText.indexOf(needle);
  if (index < 0) return [];
  return [{
    type: 'text-range' as const,
    fileId: fileName,
    text: documentText.slice(Math.max(0, index - 80), Math.min(documentText.length, index + needle.length + 80)),
    start: index,
    end: index + needle.length,
  }];
}

function localConfidence(path: string, value: unknown, hasEvidence: boolean): number {
  if (/^basics\.(name|phone|email)$/.test(path) && hasEvidence) return 0.99;
  if (/\.(startDate|endDate)$/.test(path) && hasEvidence) return 0.95;
  if (hasEvidence) return 0.92;
  if (typeof value === 'boolean' || typeof value === 'number') return 0.82;
  return 0.72;
}

export function resumeToParsedCandidates(
  resume: StandardResume,
  options: { source: 'local' | 'ai' | 'json'; documentText?: string; fileName?: string },
): ParsedCandidate[] {
  const candidates: ParsedCandidate[] = [];
  const text = options.documentText || '';
  const fileName = options.fileName || 'import';

  const visit = (value: unknown, path: string) => {
    if (!usable(value)) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (!path && META_KEYS.has(key)) continue;
        visit(child, path ? `${path}.${key}` : key);
      }
      return;
    }
    if (!path) return;
    const evidence = evidenceFor(value, text, fileName);
    const confidence = options.source === 'local'
      ? localConfidence(path, value, evidence.length > 0)
      : options.source === 'json'
        ? 0.98
        : evidence.length > 0 ? 0.88 : 0.78;
    candidates.push({ path, value, confidence, evidence, parserRule: `${options.source}-structured-import` });
  };

  visit(resume, '');
  return candidates;
}

export interface TrustedImportReview {
  resume: ResumeV5;
  localCandidates: ParsedCandidate[];
  aiCandidates: ParsedCandidate[];
  conflicts: ImportConflict[];
  acceptedPaths: string[];
}

export function buildTrustedImportReview(input: {
  localResume?: StandardResume | null;
  aiResume?: StandardResume | null;
  baseResume?: StandardResume | null;
  documentText?: string;
  fileName?: string;
  now?: number;
}): TrustedImportReview {
  const now = input.now ?? Date.now();
  const seed = input.baseResume || input.localResume || input.aiResume;
  if (!seed) throw new Error('没有可用于审核的简历候选');

  let resume = migrateToResumeV5(input.baseResume || seed, now);
  const localCandidates = input.localResume
    ? resumeToParsedCandidates(input.localResume, { source: 'local', documentText: input.documentText, fileName: input.fileName })
    : [];
  const aiCandidates = input.aiResume
    ? resumeToParsedCandidates(input.aiResume, { source: 'ai', documentText: input.documentText, fileName: input.fileName })
    : [];
  const conflicts: ImportConflict[] = [];
  const acceptedPaths: string[] = [];

  if (localCandidates.length) {
    const merged = mergeParsedCandidates(resume, localCandidates, 'local-parser', now);
    resume = merged.resume;
    conflicts.push(...merged.conflicts);
    acceptedPaths.push(...merged.acceptedPaths);
  }
  if (aiCandidates.length) {
    const merged = mergeParsedCandidates(resume, aiCandidates, 'ai-parser', now);
    resume = merged.resume;
    conflicts.push(...merged.conflicts);
    acceptedPaths.push(...merged.acceptedPaths);
  }

  return { resume, localCandidates, aiCandidates, conflicts, acceptedPaths };
}
