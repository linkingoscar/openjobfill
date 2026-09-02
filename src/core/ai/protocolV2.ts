import type { AIFieldMappingSuggestion, AIDocumentParseResponse, ResumeKeyOption, UnmatchedFieldDescriptor } from '../../types/ai';
import { classifyFieldRisk } from '../pipeline/decisionPolicy';
import type { FieldDescriptor } from '../../types/pipeline';

export interface ValidatedAIMapping extends AIFieldMappingSuggestion {
  disposition: 'high-confidence' | 'review-required' | 'manual';
}

export function sanitizeFieldMappingSuggestions(
  suggestions: AIFieldMappingSuggestion[] | undefined,
  fields: UnmatchedFieldDescriptor[],
  options: ResumeKeyOption[],
): ValidatedAIMapping[] {
  if (!Array.isArray(suggestions)) return [];
  const allowedFields = new Map(fields.map((field) => [field.index, field]));
  const allowedOptions = new Map(options.filter((option) => option.hasValue !== false).map((option) => [option.resumeKey, option]));
  const seen = new Set<number>();
  const result: ValidatedAIMapping[] = [];

  for (const suggestion of suggestions) {
    if (!suggestion || !Number.isInteger(suggestion.fieldIndex) || seen.has(suggestion.fieldIndex)) continue;
    const field = allowedFields.get(suggestion.fieldIndex);
    const option = allowedOptions.get(suggestion.resumeKey);
    if (!field || !option) continue;
    const confidence = Number(suggestion.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    if (!suggestion.reasonCode || typeof suggestion.reasonCode !== 'string') continue;

    const isOtherPersonContext = /紧急联系人|证明人|推荐人|家属|父亲|母亲|配偶|emergency|reference/i.test(
      [field.label, field.placeholder, field.name, field.ariaLabel, ...(field.nearbyLabels || [])].join(' '),
    );
    if (isOtherPersonContext && ['basics.name', 'basics.phone', 'basics.email', 'basics.idCardNumber'].some((key) => suggestion.resumeKey.startsWith(key))) continue;

    const risk = option.riskLevel || field.riskLevel || 'LOW';
    const disposition = confidence < 0.70
      ? 'manual'
      : confidence < 0.90 || risk === 'CRITICAL' || risk === 'HIGH' || risk === 'LONG_TEXT'
        ? 'review-required'
        : 'high-confidence';

    result.push({ ...suggestion, confidence, disposition });
    seen.add(suggestion.fieldIndex);
  }
  return result;
}

const UNSAFE_PATH_PARTS = new Set(['__proto__', 'prototype', 'constructor']);
const BASIC_DOCUMENT_FIELDS = new Set([
  'name', 'firstName', 'lastName', 'middleName', 'preferredName', 'gender', 'birthDate', 'age',
  'phone', 'email', 'idCardType', 'idCardNumber', 'politicalStatus', 'ethnicity', 'maritalStatus',
  'height', 'weight', 'healthStatus', 'country', 'state', 'postalCode', 'addressLine1', 'addressLine2',
  'workAuthorization', 'visaSponsorship', 'veteranStatus', 'disabilityStatus', 'workingYears', 'jobStatus',
  'expectedRole', 'expectedCity', 'expectedSalaryMin', 'expectedSalaryMax', 'availableTime',
  'githubUrl', 'linkedinUrl', 'blogUrl', 'portfolioUrl', 'selfEvaluation', 'hobbies', 'driverLicense',
  'acceptOvertime', 'acceptBusinessTrip', 'adjustable', 'cityFlexible', 'hasRelatives', 'hasPunishment',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
]);
const LOCATION_ROOTS = new Set(['nativePlace', 'birthPlace', 'currentLocation', 'hukouLocation']);
const LOCATION_FIELDS = new Set(['province', 'city', 'district', 'detail']);
const DOCUMENT_ARRAY_FIELDS: Record<string, Set<string>> = {
  educations: new Set(['schoolName', 'degree', 'degreeEn', 'major', 'majorCategory', 'college', 'startDate', 'endDate', 'gpa', 'ranking', 'isFullTime', 'isHighest', 'is985_211', 'courses', 'awards']),
  experiences: new Set(['company', 'department', 'title', 'jobType', 'city', 'startDate', 'endDate', 'isCurrent', 'description', 'achievements', 'techStack', 'witnessName', 'witnessPhone']),
  projects: new Set(['projectName', 'role', 'startDate', 'endDate', 'projectUrl', 'description', 'responsibility', 'techStack', 'achievements']),
  languages: new Set(['language', 'proficiency', 'certificateName', 'score']),
  skills: new Set(['name', 'level']),
  certificates: new Set(['name', 'issueDate', 'authority']),
  familyMembers: new Set(['relation', 'name', 'company', 'jobTitle', 'phone', 'politicalStatus', 'hukouLocation']),
  awards: new Set(['name', 'issueDate', 'level', 'grade', 'role', 'description']),
  academicAchievements: new Set(['title', 'venue', 'authorOrder', 'url', 'date', 'abstract']),
  campusExperiences: new Set(['organization', 'title', 'startDate', 'endDate', 'description', 'responsibility']),
};
const BASIC_BOOLEAN_FIELDS = new Set(['visaSponsorship', 'acceptOvertime', 'acceptBusinessTrip', 'adjustable', 'cityFlexible', 'hasRelatives', 'hasPunishment']);
const BASIC_NUMBER_FIELDS = new Set(['age', 'workingYears', 'expectedSalaryMin', 'expectedSalaryMax']);
const ARRAY_BOOLEAN_FIELDS: Record<string, Set<string>> = {
  educations: new Set(['isFullTime', 'isHighest', 'is985_211']),
  experiences: new Set(['isCurrent']),
};

/** Exact structural whitelist for AI document parsing. System/meta keys and arbitrary paths are rejected. */
export function isAllowedDocumentCandidatePath(path: string): boolean {
  if (typeof path !== 'string' || path.length > 240) return false;
  const parts = path.split('.').filter(Boolean);
  if (!parts.length || parts.some((part) => UNSAFE_PATH_PARTS.has(part))) return false;
  if (parts[0] === 'basics') {
    if (parts.length === 2) return BASIC_DOCUMENT_FIELDS.has(parts[1]);
    return parts.length === 3 && LOCATION_ROOTS.has(parts[1]) && LOCATION_FIELDS.has(parts[2]);
  }
  if (parts.length !== 3) return false;
  const fields = DOCUMENT_ARRAY_FIELDS[parts[0]];
  if (!fields || !/^\d+$/.test(parts[1]) || Number(parts[1]) > 49) return false;
  return fields.has(parts[2]);
}

function isValidDocumentCandidateValue(path: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const parts = path.split('.');
  if (parts[0] === 'basics' && parts.length === 2) {
    if (BASIC_BOOLEAN_FIELDS.has(parts[1])) return typeof value === 'boolean';
    if (BASIC_NUMBER_FIELDS.has(parts[1])) return typeof value === 'number' && Number.isFinite(value);
    return typeof value === 'string' && !!value.trim();
  }
  if (parts[0] === 'basics' && parts.length === 3) return typeof value === 'string' && !!value.trim();
  if (parts.length === 3 && ARRAY_BOOLEAN_FIELDS[parts[0]]?.has(parts[2])) return typeof value === 'boolean';
  return typeof value === 'string' && !!value.trim();
}

export function validateDocumentParseResponse(
  response: unknown,
  allowedPaths?: Set<string>,
): AIDocumentParseResponse {
  const raw = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const seen = new Set<string>();
  const candidates = rawCandidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.path !== 'string') return [];
    if (allowedPaths ? !allowedPaths.has(item.path) : !isAllowedDocumentCandidatePath(item.path)) return [];
    if (seen.has(item.path) || !isValidDocumentCandidateValue(item.path, item.value)) return [];
    const confidence = Number(item.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return [];
    const evidence = item.evidence && typeof item.evidence === 'object' ? item.evidence as Record<string, unknown> : undefined;
    const page = evidence && typeof evidence.page === 'number' && Number.isInteger(evidence.page) && evidence.page > 0 && evidence.page <= 200
      ? evidence.page
      : undefined;
    const quote = evidence && typeof evidence.quote === 'string' && evidence.quote.trim()
      ? evidence.quote.trim().slice(0, 500)
      : undefined;
    seen.add(item.path);
    return [{
      path: item.path,
      value: item.value,
      confidence,
      evidence: page || quote ? { page, quote } : undefined,
    }];
  });
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim().slice(0, 500)).slice(0, 50)
    : [];
  return { candidates, warnings };
}

/** Helper used by page-analyzer callers to derive a privacy-safe risk label for AI context. */
export function riskForAIContext(field: Pick<FieldDescriptor, 'type'>, resumeKey?: string): ReturnType<typeof classifyFieldRisk> {
  return classifyFieldRisk(field as FieldDescriptor, resumeKey);
}
