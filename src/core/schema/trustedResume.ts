import type { StandardResume } from '../../types/resume';
import type {
  FieldMeta,
  FieldMetaSource,
  ImportConflict,
  ImportMergeResult,
  ParsedCandidate,
  ResumeV5,
  ResumeVariantOrdering,
  ResumeVariantPresentation,
  ResumeVariantTextOverride,
} from '../../types/trustedResume';
import { parseResumePayload } from './resumeSchema';

function clone<T>(value: T): T {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)) as T; }
}

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const PROFILE_LINK_PATHS = new Set(['basics.githubUrl', 'basics.linkedinUrl', 'basics.blogUrl', 'basics.portfolioUrl']);
const TEXT_OVERRIDE_FIELDS = new Set(['description', 'responsibility', 'achievements']);

function partsFor(path: string): string[] {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part) || UNSAFE_PATH_SEGMENTS.has(part))) {
    throw new Error(`非法字段路径: ${path}`);
  }
  return parts;
}

export function getResumeValue(resume: StandardResume, path: string): unknown {
  let current: unknown = resume;
  for (const part of partsFor(path)) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setResumeValue(resume: StandardResume, path: string, value: unknown): void {
  const parts = partsFor(path);
  let current = resume as unknown as Record<string, unknown>;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) { current[part] = value; return; }
    if (!current[part] || typeof current[part] !== 'object') current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    current = current[part] as Record<string, unknown>;
  });
}

function normalizeOrdering(raw: unknown): ResumeVariantOrdering {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const sanitize = (value: unknown) => Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)))
    : undefined;
  return {
    projects: sanitize(record.projects),
    experiences: sanitize(record.experiences),
  };
}

function normalizePresentation(raw: unknown): ResumeVariantPresentation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  return {
    highlightSkills: Array.isArray(record.highlightSkills)
      ? Array.from(new Set(record.highlightSkills.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))).slice(0, 20)
      : undefined,
    selectedLinkKeys: Array.isArray(record.selectedLinkKeys)
      ? Array.from(new Set(record.selectedLinkKeys.filter((item): item is string => typeof item === 'string' && PROFILE_LINK_PATHS.has(item))))
      : undefined,
  };
}

function normalizeTextOverrides(raw: unknown): ResumeVariantTextOverride[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, ResumeVariantTextOverride>();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const collection = record.collection;
    const recordId = typeof record.recordId === 'string' ? record.recordId.trim() : '';
    const field = record.field;
    const value = typeof record.value === 'string' ? record.value.trim() : '';
    if ((collection !== 'projects' && collection !== 'experiences') || !recordId || !TEXT_OVERRIDE_FIELDS.has(String(field)) || !value) continue;
    if (collection === 'experiences' && field === 'responsibility') continue;
    const override: ResumeVariantTextOverride = {
      collection,
      recordId,
      field: field as ResumeVariantTextOverride['field'],
      value: value.slice(0, 5000),
    };
    byKey.set(`${collection}:${recordId}:${field}`, override);
  }
  return [...byKey.values()];
}

function applyIdOrdering<T extends { id: string }>(items: T[], order?: string[]): T[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);
    if (aRank === undefined && bRank === undefined) return 0;
    if (aRank === undefined) return 1;
    if (bRank === undefined) return -1;
    return aRank - bRank;
  });
}

function applyTextOverrides(resume: ResumeV5, overrides: ResumeVariantTextOverride[]): void {
  for (const override of overrides) {
    const items = override.collection === 'projects' ? resume.projects : resume.experiences;
    const item = items.find((candidate) => candidate.id === override.recordId) as Record<string, unknown> | undefined;
    if (!item) continue;
    if (override.collection === 'experiences' && override.field === 'responsibility') continue;
    item[override.field] = override.value;
  }
}

export function migrateToResumeV5(input: unknown, now = Date.now()): ResumeV5 {
  const parsed = parseResumePayload(input, { strict: false, now }).resume;
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawMeta = raw.fieldMeta && typeof raw.fieldMeta === 'object' ? raw.fieldMeta as Record<string, FieldMeta> : {};
  const fieldMeta: Record<string, FieldMeta> = {};
  for (const [path, meta] of Object.entries(rawMeta)) {
    try { partsFor(path); } catch { continue; }
    if (!meta || typeof meta !== 'object') continue;
    fieldMeta[path] = {
      source: meta.source || 'json-import',
      confidence: typeof meta.confidence === 'number' ? Math.min(1, Math.max(0, meta.confidence)) : undefined,
      evidence: Array.isArray(meta.evidence) ? clone(meta.evidence) : undefined,
      confirmed: meta.confirmed === true,
      locked: meta.locked === true,
      confirmedAt: typeof meta.confirmedAt === 'number' ? meta.confirmedAt : undefined,
      updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : now,
      autoFillEnabled: meta.autoFillEnabled !== false,
    };
  }
  return {
    ...parsed,
    schemaVersion: 5,
    fieldMeta,
    parentResumeId: typeof raw.parentResumeId === 'string' ? raw.parentResumeId : undefined,
    variantType: raw.variantType === 'job-variant' ? 'job-variant' : 'master',
    variantContext: raw.variantContext && typeof raw.variantContext === 'object' ? clone(raw.variantContext as ResumeV5['variantContext']) : undefined,
    variantOverrides: Array.isArray(raw.variantOverrides) ? raw.variantOverrides.filter((item): item is string => {
      if (typeof item !== 'string') return false;
      try { partsFor(item); return true; } catch { return false; }
    }) : [],
    variantOrdering: normalizeOrdering(raw.variantOrdering),
    variantPresentation: normalizePresentation(raw.variantPresentation),
    variantTextOverrides: normalizeTextOverrides(raw.variantTextOverrides),
  };
}

export function confirmField(resume: ResumeV5, path: string, options: { lock?: boolean; source?: FieldMetaSource; now?: number } = {}): ResumeV5 {
  partsFor(path);
  const next = clone(resume);
  const now = options.now ?? Date.now();
  const existing = next.fieldMeta[path];
  next.fieldMeta[path] = {
    source: options.source || existing?.source || 'manual', confidence: existing?.confidence, evidence: existing?.evidence,
    confirmed: true, locked: options.lock ?? existing?.locked ?? false, confirmedAt: existing?.confirmedAt || now,
    updatedAt: now, autoFillEnabled: existing?.autoFillEnabled !== false,
  };
  next.updatedAt = now;
  return next;
}

function incomingMeta(candidate: ParsedCandidate, source: FieldMetaSource, now: number): FieldMeta {
  return { source, confidence: Math.min(1, Math.max(0, candidate.confidence)), evidence: clone(candidate.evidence || []), confirmed: false, locked: false, updatedAt: now, autoFillEnabled: true };
}

function rank(meta?: FieldMeta): number {
  if (!meta) return 0;
  if (meta.locked && meta.confirmed) return 100;
  if (meta.confirmed && meta.source === 'manual') return 90;
  if (meta.source === 'local-parser' && (meta.confidence || 0) >= 0.9) return 70;
  if (meta.source === 'ai-parser' && (meta.confidence || 0) >= 0.9) return 60;
  if (meta.source === 'local-parser') return 40;
  if (meta.source === 'ai-parser') return 30;
  return 20;
}

export function mergeParsedCandidates(current: ResumeV5, candidates: ParsedCandidate[], source: Extract<FieldMetaSource, 'local-parser' | 'ai-parser' | 'json-import'>, now = Date.now()): ImportMergeResult {
  const next = clone(current); const acceptedPaths: string[] = []; const conflicts: ImportConflict[] = [];
  for (const candidate of candidates) {
    let currentValue: unknown;
    try { currentValue = getResumeValue(next, candidate.path); } catch {
      conflicts.push({ path: candidate.path, currentValue: undefined, candidateValue: candidate.value, candidateMeta: incomingMeta(candidate, source, now), reason: 'invalid' }); continue;
    }
    const currentMeta = next.fieldMeta[candidate.path]; const candidateMeta = incomingMeta(candidate, source, now);
    const differs = JSON.stringify(currentValue ?? null) !== JSON.stringify(candidate.value ?? null);
    if (currentMeta?.locked && differs) { conflicts.push({ path: candidate.path, currentValue, candidateValue: candidate.value, currentMeta, candidateMeta, reason: 'locked' }); continue; }
    if (currentMeta?.confirmed && differs) { conflicts.push({ path: candidate.path, currentValue, candidateValue: candidate.value, currentMeta, candidateMeta, reason: 'confirmed-different' }); continue; }
    if (differs && rank(currentMeta) > rank(candidateMeta)) { conflicts.push({ path: candidate.path, currentValue, candidateValue: candidate.value, currentMeta, candidateMeta, reason: 'parser-disagreement' }); continue; }
    setResumeValue(next, candidate.path, clone(candidate.value)); next.fieldMeta[candidate.path] = candidateMeta; acceptedPaths.push(candidate.path);
  }
  if (acceptedPaths.length) next.updatedAt = now;
  return { resume: next, acceptedPaths, conflicts };
}

/**
 * Explicit user resolution is the only path allowed to replace a locked/confirmed fact during import.
 * Accepting a candidate marks the new fact confirmed and preserves an existing lock.
 */
export function resolveImportConflict(
  current: ResumeV5,
  conflict: ImportConflict,
  decision: 'keep-current' | 'accept-candidate',
  now = Date.now(),
): ResumeV5 {
  partsFor(conflict.path);
  if (decision === 'keep-current') return clone(current);
  const next = clone(current);
  setResumeValue(next, conflict.path, clone(conflict.candidateValue));
  next.fieldMeta[conflict.path] = {
    ...clone(conflict.candidateMeta),
    confirmed: true,
    locked: conflict.currentMeta?.locked === true,
    confirmedAt: now,
    updatedAt: now,
    autoFillEnabled: conflict.candidateMeta.autoFillEnabled !== false,
  };
  next.updatedAt = now;
  return next;
}

export function createJobVariant(master: ResumeV5, context: ResumeV5['variantContext'], now = Date.now()): ResumeV5 {
  return {
    ...clone(master),
    id: `resume-${now}`,
    title: [context?.company, context?.role].filter(Boolean).join(' - ') || `${master.title} - 岗位版本`,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 5,
    parentResumeId: master.id,
    variantType: 'job-variant',
    variantContext: clone(context || {}),
    variantOverrides: [],
    variantOrdering: {},
    variantPresentation: {},
    variantTextOverrides: [],
  };
}

export function resolveVariant(master: ResumeV5, variant: ResumeV5): ResumeV5 {
  if (variant.variantType !== 'job-variant' || variant.parentResumeId !== master.id) return clone(variant);
  const resolved = clone(master);
  const ordering = normalizeOrdering(variant.variantOrdering);
  const presentation = normalizePresentation(variant.variantPresentation);
  const textOverrides = normalizeTextOverrides(variant.variantTextOverrides);
  Object.assign(resolved, {
    id: variant.id,
    title: variant.title,
    isDefault: variant.isDefault,
    createdAt: variant.createdAt,
    updatedAt: Math.max(master.updatedAt, variant.updatedAt),
    schemaVersion: 5,
    parentResumeId: master.id,
    variantType: 'job-variant',
    variantContext: clone(variant.variantContext || {}),
    variantOverrides: clone(variant.variantOverrides || []),
    variantOrdering: clone(ordering),
    variantPresentation: clone(presentation),
    variantTextOverrides: clone(textOverrides),
    fieldMeta: { ...clone(master.fieldMeta), ...clone(variant.fieldMeta) },
  });
  for (const path of variant.variantOverrides || []) setResumeValue(resolved, path, clone(getResumeValue(variant, path)));
  if (presentation.selectedLinkKeys?.length) {
    const selected = new Set(presentation.selectedLinkKeys);
    for (const path of PROFILE_LINK_PATHS) if (!selected.has(path)) setResumeValue(resolved, path, '');
  }
  resolved.projects = applyIdOrdering(resolved.projects, ordering.projects);
  resolved.experiences = applyIdOrdering(resolved.experiences, ordering.experiences);
  applyTextOverrides(resolved, textOverrides);
  return resolved;
}
