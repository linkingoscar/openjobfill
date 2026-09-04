import type { StandardResume } from '../../types/resume';
import { EMPTY_RESUME } from '../storage/defaultData';

export const CURRENT_RESUME_SCHEMA_VERSION = 4;

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
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as UnknownRecord;
  }
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
    rename(item, 'school', 'schoolName');
    rename(item, 'mainCourses', 'courses');
    rename(item, 'description', 'awards');
    rename(item, 'isUnified', 'isFullTime');
  });
  mapItems('experiences', (item) => {
    rename(item, 'position', 'title');
    rename(item, 'achievement', 'achievements');
    rename(item, 'workType', 'jobType');
  });
  mapItems('projects', (item) => {
    rename(item, 'duty', 'responsibility');
    rename(item, 'technologies', 'techStack');
  });
  mapItems('languages', (item) => {
    rename(item, 'name', 'language');
    rename(item, 'level', 'certificateName');
  });
  mapItems('skills', (item) => rename(item, 'proficiency', 'level'));
  mapItems('certificates', (item) => rename(item, 'gainDate', 'issueDate'));
  mapItems('awards', (item) => rename(item, 'gainDate', 'issueDate'));
  mapItems('familyMembers', (item) => rename(item, 'position', 'jobTitle'));
  mapItems('academicAchievements', (item) => {
    rename(item, 'publication', 'venue');
    rename(item, 'authors', 'authorOrder');
    rename(item, 'publishDate', 'date');
    rename(item, 'doi', 'url');
  });
  mapItems('campusExperiences', (item) => rename(item, 'position', 'title'));
  mapItems('qaBank', (item) => {
    if (!('keyword' in item)) {
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === 'string') : [];
      item.keyword = tags.length > 0 ? tags.join(',') : item.question;
    }
    delete item.question;
    delete item.tags;
  });
  return migrated;
}

/** Sequential, explicit migrations. Unknown future versions are rejected. */
export function migrateResumePayload(input: unknown): { payload: UnknownRecord; migratedFrom: number } {
  if (!isRecord(input)) throw new ResumeSchemaError('简历必须是对象');
  const rawVersion = input.schemaVersion;
  const migratedFrom = rawVersion === undefined ? 1 : Number(rawVersion);
  if (!Number.isInteger(migratedFrom) || migratedFrom < 1) {
    throw new ResumeSchemaError('schemaVersion 必须是正整数');
  }
  if (migratedFrom > CURRENT_RESUME_SCHEMA_VERSION) {
    throw new ResumeSchemaError(`简历版本 ${migratedFrom} 高于当前支持版本 ${CURRENT_RESUME_SCHEMA_VERSION}`);
  }

  let version = migratedFrom;
  let payload = cloneRecord(input);
  while (version < CURRENT_RESUME_SCHEMA_VERSION) {
    if (version === 1 || version === 2) payload = migrateLegacyItemNames(payload);
    // v3→v4 introduced additional optional groups; defaults are applied below.
    version++;
    payload.schemaVersion = version;
  }
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

const LOCATION_FIELDS: Record<string, FieldKind> = {
  province: 'string', city: 'string', district: 'string', detail: 'string',
};

const ARRAY_FIELDS: Record<string, Record<string, FieldKind>> = {
  educations: {
    id: 'string', schoolName: 'string', degree: 'string', degreeEn: 'string', major: 'string',
    majorCategory: 'string', college: 'string', startDate: 'string', endDate: 'string', gpa: 'string',
    ranking: 'string', isFullTime: 'boolean', isHighest: 'boolean', is985_211: 'boolean', courses: 'string', awards: 'string',
  },
  experiences: {
    id: 'string', company: 'string', department: 'string', title: 'string', jobType: 'string', city: 'string',
    startDate: 'string', endDate: 'string', isCurrent: 'boolean', description: 'string', achievements: 'string',
    techStack: 'string', witnessName: 'string', witnessPhone: 'string',
  },
  projects: {
    id: 'string', projectName: 'string', role: 'string', startDate: 'string', endDate: 'string', projectUrl: 'string',
    description: 'string', responsibility: 'string', techStack: 'string', achievements: 'string',
  },
  languages: { id: 'string', language: 'string', proficiency: 'string', certificateName: 'string', score: 'string' },
  skills: { id: 'string', name: 'string', level: 'string' },
  certificates: { id: 'string', name: 'string', issueDate: 'string', authority: 'string' },
  familyMembers: {
    id: 'string', relation: 'string', name: 'string', company: 'string', jobTitle: 'string', phone: 'string',
    politicalStatus: 'string', hukouLocation: 'string',
  },
  awards: { id: 'string', name: 'string', issueDate: 'string', level: 'string', grade: 'string', role: 'string', description: 'string' },
  academicAchievements: { id: 'string', title: 'string', venue: 'string', authorOrder: 'string', url: 'string', date: 'string', abstract: 'string' },
  campusExperiences: { id: 'string', organization: 'string', title: 'string', startDate: 'string', endDate: 'string', description: 'string', responsibility: 'string' },
  qaBank: { id: 'string', keyword: 'string', answer: 'string', scope: 'string', domain: 'string' },
};

const ARRAY_DEFAULTS: Record<string, UnknownRecord> = {
  educations: { schoolName: '', degree: '', major: '', startDate: '', endDate: '' },
  experiences: { company: '', title: '', startDate: '', endDate: '', description: '' },
  projects: { projectName: '', role: '', startDate: '', endDate: '', description: '', responsibility: '' },
  languages: { language: '' }, skills: { name: '' }, certificates: { name: '' },
  familyMembers: { relation: '', name: '' }, awards: { name: '' }, academicAchievements: { title: '' },
  campusExperiences: { organization: '', title: '', startDate: '', endDate: '' },
  qaBank: { keyword: '', answer: '' },
};

function copyKnownFields(
  source: UnknownRecord,
  schema: Record<string, FieldKind>,
  context: string,
  issues: string[],
): UnknownRecord {
  const result: UnknownRecord = {};
  for (const [field, kind] of Object.entries(schema)) {
    const value = source[field];
    if (value === undefined) continue;
    const valid = kind === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === kind;
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
  if (!isRecord(value)) {
    issues.push(`${context} 必须是对象`);
    return {};
  }
  return copyKnownFields(value, LOCATION_FIELDS, context, issues);
}

function parseArray(
  payload: UnknownRecord,
  key: string,
  now: number,
  issues: string[],
): UnknownRecord[] {
  const value = payload[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(`简历.${key} 必须是数组`);
    return [];
  }
  const result: UnknownRecord[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push(`简历.${key}[${index}] 必须是对象`);
      return;
    }
    const clean = {
      ...ARRAY_DEFAULTS[key],
      ...copyKnownFields(item, ARRAY_FIELDS[key], `简历.${key}[${index}]`, issues),
    };
    if (typeof clean.id !== 'string' || !clean.id.trim()) clean.id = `${key}-${now}-${index}`;
    if (key === 'qaBank' && !clean.scope) clean.scope = typeof clean.domain === 'string' && clean.domain ? 'domain' : 'global';
    result.push(clean);
  });
  return result;
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
    if (payload[timestamp] !== undefined && (typeof payload[timestamp] !== 'number' || !Number.isFinite(payload[timestamp]))) {
      issues.push(`简历.${timestamp} 必须是有限数字`);
    }
  }

  if (options.strict !== false && issues.length > 0) {
    throw new ResumeSchemaError(`简历格式无效：${issues[0]}`, issues);
  }

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

  // Array validation runs while assembling the result, so enforce strict mode again.
  if (options.strict !== false && issues.length > 0) {
    throw new ResumeSchemaError(`简历格式无效：${issues[0]}`, issues);
  }
  return { resume, migratedFrom, issues };
}

export function isValidResumePayload(value: unknown): value is StandardResume {
  try {
    parseResumePayload(value, { strict: true });
    return true;
  } catch {
    return false;
  }
}
