import type { DriverType } from '../../types/pipeline';
import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';

export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MISMATCH' | 'UNREADABLE' | 'NOT_HANDLED';
export type VerificationValueType = 'PHONE' | 'EMAIL' | 'ID' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATE_RANGE' | 'ENUM' | 'REGION' | 'URL' | 'TEXT' | 'LONG_TEXT' | 'SELECT';

export interface VerificationResult {
  status: VerificationStatus;
  actual: unknown;
  expected: unknown;
  normalizedActual?: unknown;
  normalizedExpected?: unknown;
  reason?: string;
}

function text(value: unknown): string { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function digits(value: unknown): string { return text(value).replace(/\D/g, ''); }
function normalizePhone(value: unknown): string {
  let normalized = digits(value);
  if (normalized.startsWith('86') && normalized.length === 13) normalized = normalized.slice(2);
  return normalized;
}
function normalizeEmail(value: unknown): string { return text(value).toLowerCase(); }
function normalizeId(value: unknown): string { return text(value).replace(/\s+/g, '').toUpperCase(); }
function normalizeUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return decodeURIComponent(url.toString()).replace(/^https?:\/\//i, '').toLowerCase();
  } catch { return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase(); }
}
function normalizeDate(value: unknown): string {
  const raw = text(value);
  if (/至今|目前|现在|present|current/i.test(raw)) return 'PRESENT';
  const nums = raw.match(/\d+/g) || [];
  if (!nums.length) return '';
  const year = nums[0]?.padStart(4, '0');
  const month = nums[1]?.padStart(2, '0');
  const day = nums[2]?.padStart(2, '0');
  return [year, month, day].filter(Boolean).join('-');
}
function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const raw = text(value).toLowerCase();
  if (['true', '1', 'yes', 'y', '是', '同意'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', '否', '不同意', ''].includes(raw)) return false;
  return null;
}
function normalizeRegion(value: unknown): string[] {
  return text(value)
    .replace(/[省市区县]/g, '')
    .split(/[\s,，/＞>→\-]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function normalizeSelect(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[／/＞>→－—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
function normalizeAdministrativeText(value: unknown): string {
  const raw = text(value);
  return raw.length >= 3 && /[省市区县]$/.test(raw) ? raw.slice(0, -1) : raw;
}

export function inferVerificationValueType(driverType: DriverType, semanticKey?: string): VerificationValueType {
  const key = semanticKey || '';
  if (/phone/i.test(key)) return 'PHONE';
  if (/email/i.test(key)) return 'EMAIL';
  if (/idCard|passport|certificateNumber/i.test(key)) return 'ID';
  if (/salary|age|workingYears|height|weight|score/i.test(key)) return 'NUMBER';
  if (/DateRange/i.test(key) || driverType === 'date-range') return 'DATE_RANGE';
  if (/Date|birthDate/i.test(key) || driverType === 'date') return 'DATE';
  if (/Location|Place|City|province|district|address/i.test(key) && (driverType === 'select' || driverType === 'cascader')) return 'REGION';
  if (/Url$/i.test(key)) return 'URL';
  if (driverType === 'checkbox') return 'BOOLEAN';
  if (driverType === 'select' || driverType === 'cascader' || driverType === 'radio') return 'SELECT';
  if (driverType === 'contenteditable') return 'LONG_TEXT';
  return 'TEXT';
}

function equalDate(actual: unknown, expected: unknown): VerificationStatus {
  const a = normalizeDate(actual); const e = normalizeDate(expected);
  if (!a || !e) return 'MISMATCH';
  if (a === e) return 'VERIFIED';
  if (a === 'PRESENT' || e === 'PRESENT') return 'MISMATCH';
  if (e.length === 7 && a.length === 10 && a.startsWith(`${e}-`)) return 'VERIFIED';
  if (e.length === 4 && a.length >= 7 && a.startsWith(e)) return 'VERIFIED';
  if (a.length < e.length && a.length >= 7 && e.startsWith(a)) return 'PARTIALLY_VERIFIED';
  return 'MISMATCH';
}

function equalSelect(actual: unknown, expected: unknown): { status: VerificationStatus; actual: string; expected: string } {
  const a = normalizeSelect(actual); const e = normalizeSelect(expected);
  if (!a || !e) return { status: 'MISMATCH', actual: a, expected: e };
  if (a === e) return { status: 'VERIFIED', actual: a, expected: e };
  const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
  for (const domain of domains) {
    const canonicalActual = optionResolver.toCanonical(domain, a);
    const canonicalExpected = optionResolver.toCanonical(domain, e);
    if (canonicalActual && canonicalExpected && canonicalActual === canonicalExpected) return { status: 'VERIFIED', actual: canonicalActual, expected: canonicalExpected };
  }
  return { status: 'MISMATCH', actual: a, expected: e };
}

export function verifyTypedValue(actual: unknown, expected: unknown, valueType: VerificationValueType): VerificationResult {
  if (actual === undefined || actual === null) return { status: 'UNREADABLE', actual, expected, reason: '页面状态不可读' };
  let normalizedActual: unknown = actual; let normalizedExpected: unknown = expected; let status: VerificationStatus = 'MISMATCH';
  switch (valueType) {
    case 'PHONE': normalizedActual = normalizePhone(actual); normalizedExpected = normalizePhone(expected); status = normalizedActual === normalizedExpected && !!normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'EMAIL': normalizedActual = normalizeEmail(actual); normalizedExpected = normalizeEmail(expected); status = normalizedActual === normalizedExpected && !!normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'ID': normalizedActual = normalizeId(actual); normalizedExpected = normalizeId(expected); status = normalizedActual === normalizedExpected && !!normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'NUMBER': {
      const a = Number(text(actual)); const e = Number(text(expected)); normalizedActual = a; normalizedExpected = e;
      status = Number.isFinite(a) && Number.isFinite(e) && a === e ? 'VERIFIED' : 'MISMATCH'; break;
    }
    case 'BOOLEAN': normalizedActual = normalizeBoolean(actual); normalizedExpected = normalizeBoolean(expected); status = normalizedActual !== null && normalizedActual === normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'DATE': status = equalDate(actual, expected); normalizedActual = normalizeDate(actual); normalizedExpected = normalizeDate(expected); break;
    case 'DATE_RANGE': {
      if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return { status: 'MISMATCH', actual, expected, reason: '日期范围结构不一致' };
      const a = actual as { startDate?: unknown; endDate?: unknown }; const e = expected as { startDate?: unknown; endDate?: unknown };
      const start = equalDate(a.startDate, e.startDate); const end = equalDate(a.endDate, e.endDate);
      status = start === 'VERIFIED' && end === 'VERIFIED' ? 'VERIFIED' : (start === 'MISMATCH' || end === 'MISMATCH' ? 'MISMATCH' : 'PARTIALLY_VERIFIED');
      normalizedActual = { startDate: normalizeDate(a.startDate), endDate: normalizeDate(a.endDate) }; normalizedExpected = { startDate: normalizeDate(e.startDate), endDate: normalizeDate(e.endDate) }; break;
    }
    case 'REGION': normalizedActual = normalizeRegion(actual); normalizedExpected = normalizeRegion(expected); status = JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected) && (normalizedExpected as string[]).length > 0 ? 'VERIFIED' : 'MISMATCH'; break;
    case 'URL': normalizedActual = normalizeUrl(actual); normalizedExpected = normalizeUrl(expected); status = normalizedActual === normalizedExpected && !!normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'ENUM':
    case 'SELECT': {
      const result = equalSelect(actual, expected); status = result.status; normalizedActual = result.actual; normalizedExpected = result.expected; break;
    }
    case 'LONG_TEXT': normalizedActual = text(actual); normalizedExpected = text(expected); status = normalizedActual === normalizedExpected ? 'VERIFIED' : 'MISMATCH'; break;
    case 'TEXT': {
      normalizedActual = text(actual); normalizedExpected = text(expected);
      if (normalizedActual === normalizedExpected) status = 'VERIFIED';
      else {
        const adminActual = normalizeAdministrativeText(actual); const adminExpected = normalizeAdministrativeText(expected);
        status = adminActual.length >= 2 && adminActual === adminExpected ? 'VERIFIED' : 'MISMATCH';
      }
      break;
    }
  }
  return { status, actual, expected, normalizedActual, normalizedExpected, reason: status === 'MISMATCH' ? '读回值与目标值不严格等价' : undefined };
}

export function verifyByField(actual: unknown, expected: unknown, driverType: DriverType, semanticKey?: string): VerificationResult {
  if (driverType === 'cascader') {
    const aSegments = normalizeRegion(actual); const eSegments = normalizeRegion(expected);
    if (aSegments.length >= 2 && eSegments.length >= 2) return verifyTypedValue(actual, expected, 'REGION');
  }
  return verifyTypedValue(actual, expected, inferVerificationValueType(driverType, semanticKey));
}
