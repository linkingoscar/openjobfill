import type { StandardResume } from '../../types/resume';
import { EMPTY_RESUME } from '../storage/defaultData';

export const CURRENT_RESUME_SCHEMA_VERSION = 5;

type UnknownRecord = Record<string, unknown>;
type FieldKind = 'string' | 'number' | 'boolean';

export interface ResumeParseOptions {
  strict?: boolean;
  regenerateMetadata?: boolean;
  fallbackTitle?: string;
  now?: number;
}

export interface ResumeParseResult {
  resume: StandardResume;
  migratedFrom: number;
  issues: string[];
}

export class ResumeSchemaError extends Error {
  constructor(message: string, readonly issues: string[] = [message]) {
    super(message);
    this.name = 'ResumeSchemaError';
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value: UnknownRecord): UnknownRecord {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)) as UnknownRecord; }
}

function rename(record: UnknownRecord, from: string, to: string): void {
  if (!(to in record) && from in record) record[to] = record[from];
  delete record[from];
}

function migrateLegacyItemNames(payload: UnknownRecord): UnknownRecord {
  const migrated = cloneRecord(payload);
  if (isRecord(migrated.basics)) {
    for (const field of ['height', 'weight'] as const) {
      if (typeof migrated.basics[field] === 'number') migrated.basics[field] = String(migrated.basics[field]);
    }
  }

  const mapItems = (key: string, transform: (item: UnknownRecord) => void) => {
    if (!Array.isArray(migrated[key])) return;
    migrated[key] = (migrated[key] as unknown[]).map((value) => {
      if (!isRecord(value)) return value;
      const item = { ...value };
      transform(item);
      return item;
    });
  };
  mapItems('educations', (item) => {
    rename(item, 'school', 'schoolName'); rename(item, 'mainCourses', 'courses');
    rename(item, 'description', 'awards'); rename(item, 'isUnified', 'isFullTime');
  });
  mapItems('experiences', (item) => {
    rename(item, 'position', 'title'); rename(item, 'achievement', 'achievements'); rename(item, 'workType', 'jobType');
  });
  mapItems('projects', (item) => { rename(item, 'duty', 'responsibility'); rename(item, 'technologies', 'techStack'); });
  mapItems('languages', (item) => { rename(item, 'name', 'language'); rename(item, 'level', 'certificateName'); });
  mapItems('skills', (item) => rename(item, 'proficiency', 'level'));
  mapItems('certificates', (item) => rename(item, 'gainDate', 'issueDate'));
  mapItems('awards', (item) => rename(item, 'gainDate', 'issueDate'));
  mapItems('familyMembers', (item) => rename(item, 'position', 'jobTitle'));
  mapItems('academicAchievements', (item) => {
    rename(item, 'publication', 'venue'); rename(item, 'authors', 'authorOrder');
    rename(item, 'publishDate', 'date'); rename(item, 'doi', 'url');
  });
  mapItems('campusExperiences', (item) => rename(item, 'position', 'title'));
  mapItems('qaBank', (item) => {
    if (!('keyword' in item)) {
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === 'string') : [];
      item.keyword = tags.length > 0 ? tags.join(',') : item.question;
    }
    delete item.tags;
  });
  return migrated;
}

function migrateV4ToV5(payload: UnknownRecord): UnknownRecord {
  const migrated = cloneRecord(payload);
  if (!isRecord(migrated.fieldMeta)) migrated.fieldMeta = {};
  if (migrated.variantType !== 'job-variant' && migrated.variantType !== 'master') migrated.variantType = 'master';
  if (!Array.isArray(migrated.variantOverrides)) migrated.variantOverrides = [];
  if (!isRecord(migrated.variantOrdering)) migrated.variantOrdering = {};
  if (!isRecord(migrated.variantPresentation)) migrated.variantPresentation = {};
  if (!Array.isArray(migrated.variantTextOverrides)) migrated.variantTextOverrides = [];
  if (Array.isArray(migrated.qaBank)) {
    migrated.qaBank = migrated.qaBank.map((raw) => {
      if (!isRecord(raw)) return raw;
      const item = { ...raw };
      if (item.scope === 'domain') item.scope = 'company-domain';
      if (!item.companyDomain && typeof item.domain === 'string') item.companyDomain = item.domain;
      if (!item.question && typeof item.keyword === 'string') item.question = item.keyword;
      return item;
    });
  }
  return migrated;
}

/** Sequential, explicit migrations. Unknown future versions are rejected. */
export function migrateResumePayload(input: unknown): { payload: UnknownRecord; migratedFrom: number } {
  if (!isRecord(input)) throw new ResumeSchemaError('简历必须是对象');
  const rawVersion = input.schemaVersion;
  const migratedFrom = rawVersion === undefined ? 1 : Number(rawVersion);
  if (!Number.isInteger(migratedFrom) || migratedFrom < 1) throw new ResumeSchemaError('schemaVersion 必须是正整数');
  if (migratedFrom > CURRENT_RESUME_SCHEMA_VERSION) {
    throw new ResumeSchemaError(`简历版本 ${migratedFrom} 高于当前支持版本 ${CURRENT_RESUME_SCHEMA_VERSION}`);
  }

  let version = migratedFrom;
  let payload = cloneRecord(input);
  while (version < CURRENT_RESUME_SCHEMA_VERSION) {
    if (version === 1 || version === 2) payload = migrateLegacyItemNames(payload);
    if (version === 4) payload = migrateV4ToV5(payload);
    version++;
    payload.schemaVersion = version;
  }
  if (CURRENT_RESUME_SCHEMA_VERSION === 5) payload = migrateV4ToV5(payload);
  payload.schemaVersion = CURRENT_RESUME_SCHEMA_VERSION;
  return { payload, migratedFrom };
}

const BASIC_FIELDS: Record<string, FieldKind> = {
  name: 'string', firstName: 'string', lastName: 'string', middleName: 'string', preferredName: 'string',
  gender: 'string', birthDate: 'string', age: 'number', phone: 'string', email: 'string', avatarUrl: 'string',
  idCardType: 'string', idCardNumber: 'string', politicalStatus: 'string', ethnicity: 'string',
  maritalStatus: 'string', height: 'string', weight: 'string', healthStatus: 'string', country: 'string',
  state: 'string', postalCode: 'string', addressLine1: 'string', addressLine2: 'string',
  workAuthorization: 'string', visaSponsorship: 'boolean', veteranStatus: 'string', disabilityStatus: 'string',
  workingYears: 'number', jobStatus: 'string', expectedRole: 'string', expectedCity: 'string',
  expectedSalaryMin: 'number', expectedSalaryMax: 'number', availableTime: 'string', githubUrl: 'string',
  linkedinUrl: 'string', blogUrl: 'string', portfolioUrl: 'string', selfEvaluation: 'string', hobbies: 'string',
  driverLicense: 'string', acceptOvertime: 'boolean', acceptBusinessTrip: 'boolean', adjustable: 'boolean',
  cityFlexible: 'boolean', hasRelatives: 'boolean', hasPunishment: 'boolean', emergencyContactName: 'string',
  emergencyContactPhone: 'string', emergencyContactRelation: 'string',
};

const LOCATION_FIELDS: Record<string, FieldKind> = { province: 'string', city: 'string', district: 'string', detail: 'string' };

const ARRAY_FIELDS: Record<string, Record<string, FieldKind>> = {
  educations: {
    id: 'string', schoolName: 'string', degree: 'string', degreeEn: 'string', major: 'string', majorCategory: 'string', college: 'string',
    startDate: 'string', endDate: 'string', gpa: 'string', ranking: 'string', isFullTime: 'boolean', isHighest: 'boolean', is985_211: 'boolean', courses: 'string', awards: 'string',
  },
  experiences: {
    id: 'string', company: 'string', department: 'string', title: 'string', jobType: 'string', city: 'string', startDate: 'string', endDate: 'string',
    isCurrent: 'boolean', description: 'string', achievements: 'string', techStack: 'string', witnessName: 'string', witnessPhone: 'string',
  },
  projects: {
    id: 'string', projectName: 'string', role: 'string', startDate: 'string', endDate: 'string', projectUrl: 'string', description: 'string', responsibility: 'string', techStack: 'string', achievements: 'string',
  },
  languages: { id: 'string', language: 'string', proficiency: 'string', certificateName: 'string', score: 'string' },
  skills: { id: 'string', name: 'string', level: 'string' },
  certificates: { id: 'string', name: 'string', issueDate: 'string', authority: 'string' },
  familyMembers: { id: 'string', relation: 'string', name: 'string', company: 'string', jobTitle: 'string', phone: 'string', politicalStatus: 'string', hukouLocation: 'string' },
  awards: { id: 'string', name: 'string', issueDate: 'string', level: 'string', grade: 'string', role: 'string', description: 'string' },
  academicAchievements: { id: 'string', title: 'string', venue: 'string', authorOrder: 'string', url: 'string', date: 'string', abstract: 'string' },
  campusExperiences: { id: 'string', organization: 'string', title: 'string', startDate: 'string', endDate: 'string', description: 'string', responsibility: 'string' },
  qaBank: {
    id: 'string', keyword: 'string', answer: 'string', question: 'string', scope: 'string', domain: 'string',
    jobFamily: 'string', companyDomain: 'string', jobPostingId: 'string',
  },
};

const ARRAY_DEFAULTS: Record<string, UnknownRecord> = {
  educations: { schoolName: '', degree: '其他', major: '', startDate: '', endDate: '' },
  experiences: { company: '', title: '', startDate: '', endDate: '', description: '' },
  projects: { projectName: '', role: '', startDate: '', endDate: '', description: '', responsibility: '' },
  languages: { language: '' }, skills: { name: '' }, certificates: { name: '' }, familyMembers: { relation: '', name: '' }, awards: { name: '' },
  academicAchievements: { title: '' }, campusExperiences: { organization: '', title: '', startDate: '', endDate: '' }, qaBank: { keyword: '', answer: '' },
};

function copyKnownFields(source: UnknownRecord, schema: Record<string, FieldKind>, context: string, issues: string[]): UnknownRecord {
  const result: UnknownRecord = {};
  for (const [field, kind] of Object.entries(schema)) {
    const value = source[field];
    if (value === undefined) continue;
    const valid = kind === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === kind;
    if (!valid) {
      issues.push(`${context}.${field} 必须是${kind === 'string' ? '字符串' : kind === 'number' ? '有限数字' : '布尔值'}`);
      continue;
    }
    result[field] = value;
  }
  return result;
}

function parseLocation(value: unknown, context: string, issues: string[]): UnknownRecord {
  if (value === undefined) return {};
  if (!isRecord(value)) { issues.push(`${context} 必须是对象`); return {}; }
  return copyKnownFields(value, LOCATION_FIELDS, context, issues);
}

const QA_SCOPES = new Set(['global', 'job-family', 'company-domain', 'job-posting']);
const QA_VERSION_SOURCES = new Set(['manual', 'ai-confirmed']);

function parseQAVersions(item: UnknownRecord, itemId: string, now: number, context: string, issues: string[]): UnknownRecord[] {
  if (item.versions === undefined) {
    return typeof item.answer === 'string' && item.answer.trim()
      ? [{ id: `qa-version-${itemId}-legacy`, answer: item.answer, createdAt: now, confirmedByUser: true, source: 'manual' }]
      : [];
  }
  if (!Array.isArray(item.versions)) {
    issues.push(`${context}.versions 必须是数组`);
    return [];
  }
  return item.versions.flatMap((raw, index) => {
    if (!isRecord(raw)) { issues.push(`${context}.versions[${index}] 必须是对象`); return []; }
    if (typeof raw.answer !== 'string' || !raw.answer.trim()) { issues.push(`${context}.versions[${index}].answer 必须是非空字符串`); return []; }
    const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : now;
    const source = typeof raw.source === 'string' && QA_VERSION_SOURCES.has(raw.source) ? raw.source : 'manual';
    const version: UnknownRecord = {
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `qa-version-${itemId}-${index}-${now}`,
      answer: raw.answer,
      createdAt,
      confirmedByUser: raw.confirmedByUser === true,
      source,
    };
    if (typeof raw.maxChars === 'number' && Number.isFinite(raw.maxChars) && raw.maxChars > 0) version.maxChars = Math.round(raw.maxChars);
    if (typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt)) version.lastUsedAt = raw.lastUsedAt;
    if (typeof raw.lastUsedUrl === 'string') version.lastUsedUrl = raw.lastUsedUrl.slice(0, 1000);
    return [version];
  });
}

function parseQAItem(item: UnknownRecord, index: number, now: number, issues: string[]): UnknownRecord {
  const context = `简历.qaBank[${index}]`;
  const clean = { ...ARRAY_DEFAULTS.qaBank, ...copyKnownFields(item, ARRAY_FIELDS.qaBank, context, issues) };
  if (typeof clean.id !== 'string' || !clean.id.trim()) clean.id = `qaBank-${now}-${index}`;
  if (typeof clean.keyword !== 'string' || !clean.keyword.trim()) clean.keyword = typeof clean.question === 'string' ? clean.question : '';
  if (typeof clean.question !== 'string' || !clean.question.trim()) clean.question = clean.keyword;
  const rawScope = clean.scope === 'domain' ? 'company-domain' : clean.scope;
  clean.scope = typeof rawScope === 'string' && QA_SCOPES.has(rawScope) ? rawScope : 'global';
  if (!clean.companyDomain && typeof clean.domain === 'string' && clean.domain.trim()) clean.companyDomain = clean.domain;
  if (clean.scope === 'company-domain' && !clean.companyDomain) clean.scope = 'global';
  if (clean.scope === 'job-family' && !clean.jobFamily) clean.scope = 'global';
  if (clean.scope === 'job-posting' && !clean.jobPostingId) clean.scope = 'global';
  clean.versions = parseQAVersions(item, String(clean.id), now, context, issues);
  if ((!clean.answer || !String(clean.answer).trim()) && (clean.versions as UnknownRecord[]).length) {
    clean.answer = String((clean.versions as UnknownRecord[])[0].answer || '');
  }
  return clean;
}

function parseArray(payload: UnknownRecord, key: string, now: number, issues: string[]): UnknownRecord[] {
  const value = payload[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) { issues.push(`简历.${key} 必须是数组`); return []; }
  const result: UnknownRecord[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) { issues.push(`简历.${key}[${index}] 必须是对象`); return; }
    if (key === 'qaBank') {
      result.push(parseQAItem(item, index, now, issues));
      return;
    }
    const clean = { ...ARRAY_DEFAULTS[key], ...copyKnownFields(item, ARRAY_FIELDS[key], `简历.${key}[${index}]`, issues) };
    if (typeof clean.id !== 'string' || !clean.id.trim()) clean.id = `${key}-${now}-${index}`;
    result.push(clean);
  });
  return result;
}

const FIELD_META_SOURCES = new Set(['manual', 'local-parser', 'ai-parser', 'json-import', 'derived', 'site-learned']);
const EVIDENCE_TYPES = new Set(['text-range', 'page-region', 'manual', 'derived', 'site-input']);
const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const PROFILE_LINK_PATHS = new Set(['basics.githubUrl', 'basics.linkedinUrl', 'basics.blogUrl', 'basics.portfolioUrl']);
const VARIANT_TEXT_FIELDS = new Set(['description', 'responsibility', 'achievements']);

function isSafeFieldPath(path: string): boolean {
  const parts = path.split('.').filter(Boolean);
  return parts.length > 0 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part) && !UNSAFE_PATH_SEGMENTS.has(part));
}

function parseFieldMeta(payload: UnknownRecord, now: number, issues: string[]): UnknownRecord {
  if (payload.fieldMeta === undefined) return {};
  if (!isRecord(payload.fieldMeta)) { issues.push('简历.fieldMeta 必须是对象'); return {}; }
  const result: UnknownRecord = {};
  for (const [path, value] of Object.entries(payload.fieldMeta)) {
    if (!isSafeFieldPath(path) || !isRecord(value)) { issues.push(`简历.fieldMeta.${path} 无效`); continue; }
    const source = typeof value.source === 'string' && FIELD_META_SOURCES.has(value.source) ? value.source : 'json-import';
    const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? Math.min(1, Math.max(0, value.confidence)) : undefined;
    const evidence = Array.isArray(value.evidence) ? value.evidence.flatMap((raw) => {
      if (!isRecord(raw) || typeof raw.type !== 'string' || !EVIDENCE_TYPES.has(raw.type)) return [];
      return [{
        type: raw.type,
        fileId: typeof raw.fileId === 'string' ? raw.fileId : undefined,
        page: typeof raw.page === 'number' && Number.isFinite(raw.page) ? raw.page : undefined,
        text: typeof raw.text === 'string' ? raw.text.slice(0, 2000) : undefined,
        start: typeof raw.start === 'number' && Number.isFinite(raw.start) ? raw.start : undefined,
        end: typeof raw.end === 'number' && Number.isFinite(raw.end) ? raw.end : undefined,
        locator: typeof raw.locator === 'string' ? raw.locator.slice(0, 1000) : undefined,
      }];
    }) : undefined;
    result[path] = {
      source,
      confidence,
      evidence,
      confirmed: value.confirmed === true,
      locked: value.locked === true,
      confirmedAt: typeof value.confirmedAt === 'number' && Number.isFinite(value.confirmedAt) ? value.confirmedAt : undefined,
      updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : now,
      autoFillEnabled: value.autoFillEnabled !== false,
    };
  }
  return result;
}

function parseVariantContext(payload: UnknownRecord): UnknownRecord | undefined {
  if (!isRecord(payload.variantContext)) return undefined;
  const context: UnknownRecord = {};
  for (const key of ['company', 'role', 'jobFamily', 'jdSnapshotId']) {
    if (typeof payload.variantContext[key] === 'string') context[key] = payload.variantContext[key];
  }
  return context;
}

function parseVariantOrdering(payload: UnknownRecord): UnknownRecord {
  if (!isRecord(payload.variantOrdering)) return {};
  const result: UnknownRecord = {};
  for (const key of ['projects', 'experiences']) {
    const raw = payload.variantOrdering[key];
    if (!Array.isArray(raw)) continue;
    result[key] = Array.from(new Set(raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
  }
  return result;
}

function parseVariantPresentation(payload: UnknownRecord): UnknownRecord {
  if (!isRecord(payload.variantPresentation)) return {};
  const result: UnknownRecord = {};
  if (Array.isArray(payload.variantPresentation.highlightSkills)) {
    result.highlightSkills = Array.from(new Set(payload.variantPresentation.highlightSkills.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))).slice(0, 20);
  }
  if (Array.isArray(payload.variantPresentation.selectedLinkKeys)) {
    result.selectedLinkKeys = Array.from(new Set(payload.variantPresentation.selectedLinkKeys.filter((item): item is string => typeof item === 'string' && PROFILE_LINK_PATHS.has(item))));
  }
  return result;
}

function parseVariantTextOverrides(payload: UnknownRecord): UnknownRecord[] {
  if (!Array.isArray(payload.variantTextOverrides)) return [];
  const byKey = new Map<string, UnknownRecord>();
  for (const raw of payload.variantTextOverrides) {
    if (!isRecord(raw)) continue;
    const collection = raw.collection;
    const recordId = typeof raw.recordId === 'string' ? raw.recordId.trim() : '';
    const field = raw.field;
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';
    if ((collection !== 'projects' && collection !== 'experiences') || !recordId || !VARIANT_TEXT_FIELDS.has(String(field)) || !value) continue;
    if (collection === 'experiences' && field === 'responsibility') continue;
    byKey.set(`${collection}:${recordId}:${field}`, {
      collection,
      recordId: recordId.slice(0, 240),
      field,
      value: value.slice(0, 5000),
    });
  }
  return [...byKey.values()];
}

export function parseResumePayload(input: unknown, options: ResumeParseOptions = {}): ResumeParseResult {
  const { payload, migratedFrom } = migrateResumePayload(input);
  const now = options.now ?? Date.now();
  const issues: string[] = [];
  if (!isRecord(payload.basics)) issues.push('简历.basics 必须是对象');
  const rawBasics = isRecord(payload.basics) ? payload.basics : {};
  const base = JSON.parse(JSON.stringify(EMPTY_RESUME)) as StandardResume;
  const basics = {
    ...base.basics,
    ...copyKnownFields(rawBasics, BASIC_FIELDS, '简历.basics', issues),
    nativePlace: { ...base.basics.nativePlace, ...parseLocation(rawBasics.nativePlace, '简历.basics.nativePlace', issues) },
    birthPlace: { ...base.basics.birthPlace, ...parseLocation(rawBasics.birthPlace, '简历.basics.birthPlace', issues) },
    currentLocation: { ...base.basics.currentLocation, ...parseLocation(rawBasics.currentLocation, '简历.basics.currentLocation', issues) },
    hukouLocation: { ...base.basics.hukouLocation, ...parseLocation(rawBasics.hukouLocation, '简历.basics.hukouLocation', issues) },
  };

  const rawId = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : `resume-${now}`;
  if (payload.id !== undefined && typeof payload.id !== 'string') issues.push('简历.id 必须是字符串');
  if (payload.title !== undefined && typeof payload.title !== 'string') issues.push('简历.title 必须是字符串');
  if (payload.isDefault !== undefined && typeof payload.isDefault !== 'boolean') issues.push('简历.isDefault 必须是布尔值');
  for (const timestamp of ['createdAt', 'updatedAt'] as const) {
    if (payload[timestamp] !== undefined && (typeof payload[timestamp] !== 'number' || !Number.isFinite(payload[timestamp]))) issues.push(`简历.${timestamp} 必须是有限数字`);
  }

  const fieldMeta = parseFieldMeta(payload, now, issues);
  const variantType = payload.variantType === 'job-variant' ? 'job-variant' : 'master';
  const parentResumeId = typeof payload.parentResumeId === 'string' && payload.parentResumeId.trim() ? payload.parentResumeId.trim() : undefined;
  const variantOverrides = Array.isArray(payload.variantOverrides)
    ? payload.variantOverrides.filter((item): item is string => typeof item === 'string' && isSafeFieldPath(item))
    : [];

  if (variantType === 'job-variant' && !parentResumeId) issues.push('岗位版本必须包含 parentResumeId');
  if (options.strict !== false && issues.length > 0) throw new ResumeSchemaError(`简历格式无效：${issues[0]}`, issues);

  const resume: StandardResume = {
    id: options.regenerateMetadata ? `resume-${now}` : rawId,
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : options.fallbackTitle || '我的求职档案',
    isDefault: options.regenerateMetadata ? false : payload.isDefault === true,
    createdAt: options.regenerateMetadata ? now : typeof payload.createdAt === 'number' ? payload.createdAt : now,
    updatedAt: options.regenerateMetadata ? now : typeof payload.updatedAt === 'number' ? payload.updatedAt : now,
    schemaVersion: CURRENT_RESUME_SCHEMA_VERSION,
    basics,
    educations: parseArray(payload, 'educations', now, issues) as unknown as StandardResume['educations'],
    experiences: parseArray(payload, 'experiences', now, issues) as unknown as StandardResume['experiences'],
    projects: parseArray(payload, 'projects', now, issues) as unknown as StandardResume['projects'],
    languages: parseArray(payload, 'languages', now, issues) as unknown as StandardResume['languages'],
    skills: parseArray(payload, 'skills', now, issues) as unknown as StandardResume['skills'],
    certificates: parseArray(payload, 'certificates', now, issues) as unknown as StandardResume['certificates'],
    familyMembers: parseArray(payload, 'familyMembers', now, issues) as unknown as StandardResume['familyMembers'],
    awards: parseArray(payload, 'awards', now, issues) as unknown as NonNullable<StandardResume['awards']>,
    academicAchievements: parseArray(payload, 'academicAchievements', now, issues) as unknown as NonNullable<StandardResume['academicAchievements']>,
    campusExperiences: parseArray(payload, 'campusExperiences', now, issues) as unknown as NonNullable<StandardResume['campusExperiences']>,
    qaBank: parseArray(payload, 'qaBank', now, issues) as unknown as StandardResume['qaBank'],
  };

  const resumeWithV5 = resume as StandardResume & Record<string, unknown>;
  resumeWithV5.fieldMeta = fieldMeta;
  resumeWithV5.variantType = variantType;
  resumeWithV5.parentResumeId = parentResumeId;
  resumeWithV5.variantContext = parseVariantContext(payload);
  resumeWithV5.variantOverrides = variantOverrides;
  resumeWithV5.variantOrdering = parseVariantOrdering(payload);
  resumeWithV5.variantPresentation = parseVariantPresentation(payload);
  resumeWithV5.variantTextOverrides = parseVariantTextOverrides(payload);

  if (options.strict !== false && issues.length > 0) throw new ResumeSchemaError(`简历格式无效：${issues[0]}`, issues);
  return { resume, migratedFrom, issues };
}

export function isValidResumePayload(value: unknown): value is StandardResume {
  try { parseResumePayload(value, { strict: true }); return true; }
  catch { return false; }
}
