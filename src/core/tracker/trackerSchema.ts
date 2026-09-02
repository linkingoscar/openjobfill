import type {
  ApplicationStatus,
  JobApplicationRecord,
  TrackerEditableField,
  TrackerFieldSource,
} from '../../types/tracker';

export const TRACKER_SCHEMA_VERSION = 2 as const;
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'applied', 'screening', 'assessment', 'interview1', 'interview2', 'hr', 'offer', 'rejected',
] as const;

export const TRACKER_EDITABLE_FIELDS: readonly TrackerEditableField[] = [
  'companyName', 'jobTitle', 'jobUrl', 'salary', 'jdSummary', 'notes',
] as const;

const SOURCE_PRIORITY: Record<TrackerFieldSource, number> = {
  heuristic: 1,
  structured_data: 2,
  imported: 2,
  user: 3,
};

function boundedString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function createApplicationId(prefix = 'app'): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${uuid}`;
}

export function normalizeApplicationUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|spm$|from$|source$|ref$)/i.test(key)) url.searchParams.delete(key);
    }
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${url.protocol}//${url.host}${pathname}${url.search}`;
  } catch {
    return boundedString(value, 2_000);
  }
}

export function applicationIdentity(record: Pick<JobApplicationRecord, 'jobUrl' | 'companyName' | 'jobTitle'>): string {
  const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  return [normalizeApplicationUrl(record.jobUrl), normalize(record.companyName), normalize(record.jobTitle)].join('|');
}

export function normalizeJobApplicationRecord(input: unknown): JobApplicationRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Partial<JobApplicationRecord>;
  const companyName = boundedString(raw.companyName, 160);
  const jobTitle = boundedString(raw.jobTitle, 200);
  const status = APPLICATION_STATUSES.includes(raw.status as ApplicationStatus)
    ? raw.status as ApplicationStatus
    : 'applied';
  if (!companyName || !jobTitle) return null;

  const now = new Date().toISOString();
  const id = boundedString(raw.id, 240) || createApplicationId();
  const clientRequestId = boundedString(raw.clientRequestId, 240) || id;
  const lockedFields = Array.isArray(raw.lockedFields)
    ? [...new Set(raw.lockedFields.filter((field): field is TrackerEditableField => TRACKER_EDITABLE_FIELDS.includes(field as TrackerEditableField)))]
    : [];
  const fieldSources: JobApplicationRecord['fieldSources'] = {};
  if (raw.fieldSources && typeof raw.fieldSources === 'object') {
    for (const field of TRACKER_EDITABLE_FIELDS) {
      const source = raw.fieldSources[field];
      if (source && source in SOURCE_PRIORITY) fieldSources[field] = source;
    }
  }

  return {
    schemaVersion: TRACKER_SCHEMA_VERSION,
    id,
    clientRequestId,
    companyName,
    jobTitle,
    appliedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.appliedDate || ''))
      ? String(raw.appliedDate)
      : now.slice(0, 10),
    status,
    jobUrl: normalizeApplicationUrl(boundedString(raw.jobUrl, 2_000)),
    salary: boundedString(raw.salary, 100) || undefined,
    resumeVersionTitle: boundedString(raw.resumeVersionTitle, 160) || undefined,
    jdSummary: boundedString(raw.jdSummary, 8_000) || undefined,
    notes: boundedString(raw.notes, 8_000) || undefined,
    source: ['manual', 'success_detection', 'user_confirmed'].includes(String(raw.source))
      ? raw.source
      : undefined,
    sourceDomain: boundedString(raw.sourceDomain, 253) || undefined,
    fieldSources,
    lockedFields,
    syncState: ['local', 'pending', 'synced', 'failed'].includes(String(raw.syncState))
      ? raw.syncState
      : 'local',
    createdAt: boundedString(raw.createdAt, 64) || boundedString(raw.updatedAt, 64) || now,
    confirmedAt: boundedString(raw.confirmedAt, 64) || undefined,
    updatedAt: boundedString(raw.updatedAt, 64) || now,
  };
}

export function mergeApplicationRecords(
  current: JobApplicationRecord,
  incoming: JobApplicationRecord,
): JobApplicationRecord {
  const existing = normalizeJobApplicationRecord(current)!;
  const next = normalizeJobApplicationRecord(incoming)!;
  const locked = new Set([...(existing.lockedFields || []), ...(next.lockedFields || [])]);
  const result: JobApplicationRecord = { ...existing, updatedAt: new Date().toISOString() };

  for (const field of TRACKER_EDITABLE_FIELDS) {
    const oldSource = existing.fieldSources?.[field] || 'heuristic';
    const newSource = next.fieldSources?.[field] || (next.source === 'manual' || next.source === 'user_confirmed' ? 'user' : 'heuristic');
    const nextValue = next[field];
    if (locked.has(field) && newSource !== 'user') continue;
    // An explicitly sourced user edit may intentionally clear an optional value.
    if (next.fieldSources?.[field] === 'user') {
      (result as unknown as Record<string, unknown>)[field] = nextValue;
      result.fieldSources = { ...(result.fieldSources || {}), [field]: 'user' };
      locked.add(field);
      continue;
    }
    if (nextValue !== undefined && nextValue !== '' && SOURCE_PRIORITY[newSource] >= SOURCE_PRIORITY[oldSource]) {
      (result as unknown as Record<string, unknown>)[field] = nextValue;
      result.fieldSources = { ...(result.fieldSources || {}), [field]: newSource };
      if (newSource === 'user') locked.add(field);
    }
  }

  result.status = next.status || existing.status;
  result.appliedDate = next.appliedDate || existing.appliedDate;
  result.resumeVersionTitle = next.resumeVersionTitle || existing.resumeVersionTitle;
  result.source = next.source || existing.source;
  result.sourceDomain = next.sourceDomain || existing.sourceDomain;
  result.confirmedAt = next.confirmedAt || existing.confirmedAt;
  result.syncState = next.syncState || existing.syncState;
  result.lockedFields = [...locked];
  return result;
}
