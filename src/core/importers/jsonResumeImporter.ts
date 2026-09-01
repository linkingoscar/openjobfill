import { parseResumeFromText } from '../parser/resumeParser';
import type { StandardResume } from '../../types/resume';

type JsonObject = Record<string, any>;

function normalizeMonth(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^(\d{4})(?:[-/.年](\d{1,2}))?/);
  if (!match) return value.trim();
  return match[2] ? `${match[1]}-${match[2].padStart(2, '0')}` : match[1];
}

function normalizeDegree(value: unknown): StandardResume['educations'][number]['degree'] {
  const text = String(value || '').toLowerCase();
  if (/博士|ph\.?d|doctor/.test(text)) return '博士';
  if (/硕士|master|mba/.test(text)) return '硕士';
  if (/专科|大专|associate|college/.test(text)) return '专科';
  if (/本科|学士|bachelor/.test(text)) return '本科';
  return '其他';
}

function joinedText(summary: unknown, highlights: unknown): string {
  const lines = [
    typeof summary === 'string' ? summary : '',
    ...(Array.isArray(highlights) ? highlights.filter((item): item is string => typeof item === 'string') : []),
  ].map((line) => line.trim()).filter(Boolean);
  return [...new Set(lines)].join('\n');
}

export function looksLikeJsonResume(value: unknown): value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as JsonObject;
  return !!data.basics && (
    Array.isArray(data.work)
    || Array.isArray(data.education)
    || Array.isArray(data.projects)
    || Array.isArray(data.skills)
    || typeof data.basics.name === 'string'
  );
}

/** 将 JSON Resume 标准及 OpenJobFill 自身导出格式转换为当前 StandardResume。 */
export function importJsonResume(input: string | JsonObject, fallbackTitle = 'JSON Resume 导入简历'): StandardResume {
  const raw = typeof input === 'string' ? JSON.parse(input) as JsonObject : input;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('JSON 顶层必须是对象');
  }

  const now = Date.now();
  const base = parseResumeFromText('', fallbackTitle);

  // 当前产品自身导出的 StandardResume：重新生成实例元数据，防止覆盖已有简历。
  if (raw.basics && Array.isArray(raw.educations) && (
    raw.schemaVersion
    || raw.id
    || raw.educations.some((item: any) => 'schoolName' in (item || {}))
  )) {
    return {
      ...base,
      ...raw,
      id: `resume-${now}`,
      title: String(raw.title || fallbackTitle),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 4,
      basics: { ...base.basics, ...(raw.basics || {}) },
      qaBank: Array.isArray(raw.qaBank) ? raw.qaBank : [],
    } as StandardResume;
  }

  if (!looksLikeJsonResume(raw)) {
    throw new Error('未识别为 JSON Resume 或 OpenJobFill 简历格式');
  }

  const basics = raw.basics || {};
  const profiles = Array.isArray(basics.profiles) ? basics.profiles : [];
  const profileUrl = (network: RegExp) => profiles.find((item: any) => network.test(String(item?.network || '')))?.url || '';
  const location = basics.location || {};

  base.title = String(basics.label || raw.meta?.name || fallbackTitle);
  base.basics = {
    ...base.basics,
    name: String(basics.name || ''),
    phone: String(basics.phone || ''),
    email: String(basics.email || ''),
    currentLocation: {
      province: String(location.region || ''),
      city: String(location.city || ''),
      detail: String(location.address || ''),
    },
    country: String(location.countryCode || ''),
    state: String(location.region || ''),
    postalCode: String(location.postalCode || ''),
    addressLine1: String(location.address || ''),
    expectedRole: String(basics.label || ''),
    selfEvaluation: String(basics.summary || ''),
    githubUrl: String(profileUrl(/github/i)),
    linkedinUrl: String(profileUrl(/linkedin/i)),
    blogUrl: String(basics.url || profileUrl(/blog|website|个人主页/i)),
    hobbies: Array.isArray(raw.interests)
      ? raw.interests.flatMap((item: any) => [item?.name, ...(Array.isArray(item?.keywords) ? item.keywords : [])]).filter(Boolean).join('、')
      : '',
  };

  base.educations = (Array.isArray(raw.education) ? raw.education : []).map((item: any, index: number) => ({
    id: `edu-json-${now}-${index}`,
    schoolName: String(item?.institution || ''),
    degree: normalizeDegree(item?.studyType),
    major: String(item?.area || ''),
    startDate: normalizeMonth(item?.startDate),
    endDate: normalizeMonth(item?.endDate),
    gpa: String(item?.score || ''),
    courses: Array.isArray(item?.courses) ? item.courses.join('、') : '',
  }));

  base.experiences = (Array.isArray(raw.work) ? raw.work : []).map((item: any, index: number) => ({
    id: `work-json-${now}-${index}`,
    company: String(item?.name || item?.company || ''),
    title: String(item?.position || ''),
    city: String(item?.location || ''),
    startDate: normalizeMonth(item?.startDate),
    endDate: normalizeMonth(item?.endDate) || '至今',
    isCurrent: !item?.endDate,
    description: joinedText(item?.summary, item?.highlights),
  }));

  base.projects = (Array.isArray(raw.projects) ? raw.projects : []).map((item: any, index: number) => ({
    id: `project-json-${now}-${index}`,
    projectName: String(item?.name || ''),
    role: String(item?.type || item?.roles?.[0] || '核心成员'),
    startDate: normalizeMonth(item?.startDate),
    endDate: normalizeMonth(item?.endDate),
    projectUrl: String(item?.url || ''),
    description: String(item?.description || ''),
    responsibility: joinedText('', item?.highlights),
    techStack: Array.isArray(item?.keywords) ? item.keywords.join('、') : '',
  }));

  base.skills = (Array.isArray(raw.skills) ? raw.skills : []).flatMap((item: any, groupIndex: number) => {
    const names = Array.isArray(item?.keywords) && item.keywords.length > 0 ? item.keywords : [item?.name];
    return names.filter(Boolean).map((name: unknown, index: number) => ({
      id: `skill-json-${now}-${groupIndex}-${index}`,
      name: String(name),
      level: /精通|expert|master/i.test(String(item?.level || '')) ? '精通' as const
        : /熟练|advanced|proficient/i.test(String(item?.level || '')) ? '熟练' as const
        : /熟悉|intermediate/i.test(String(item?.level || '')) ? '熟悉' as const
        : '了解' as const,
    }));
  });

  base.languages = (Array.isArray(raw.languages) ? raw.languages : []).map((item: any, index: number) => ({
    id: `language-json-${now}-${index}`,
    language: String(item?.language || ''),
    certificateName: String(item?.fluency || ''),
  }));

  base.certificates = (Array.isArray(raw.certificates) ? raw.certificates : []).map((item: any, index: number) => ({
    id: `certificate-json-${now}-${index}`,
    name: String(item?.name || ''),
    issueDate: normalizeMonth(item?.date),
    authority: String(item?.issuer || ''),
  }));

  base.awards = (Array.isArray(raw.awards) ? raw.awards : []).map((item: any, index: number) => ({
    id: `award-json-${now}-${index}`,
    name: String(item?.title || ''),
    issueDate: normalizeMonth(item?.date),
    level: String(item?.awarder || ''),
    description: String(item?.summary || ''),
  }));

  return base;
}

/** JSON 优先、普通 Markdown/纯文本回退的统一文本导入入口。 */
export function importResumeText(text: string, title: string): StandardResume {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      return importJsonResume(trimmed, title);
    } catch (error) {
      if (trimmed.endsWith('}')) throw error;
    }
  }
  return parseResumeFromText(text, title);
}
