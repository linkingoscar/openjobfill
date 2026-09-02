import type { StandardResume } from '../../types/resume';
import type { VerificationStatus } from '../pipeline/strictVerification';

export type ConsistencySeverity = 'BLOCKER' | 'WARNING' | 'INFO';

export interface FilledFieldSnapshot {
  semanticKey?: string;
  label: string;
  value?: unknown;
  verificationStatus: VerificationStatus;
}

export interface ConsistencyIssue {
  id: string;
  severity: ConsistencySeverity;
  code: string;
  message: string;
  resumeKey?: string;
  pageLabel?: string;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function runPreSubmitConsistencyChecks(input: {
  resume: StandardResume;
  pageFields: FilledFieldSnapshot[];
  currentCompany?: string;
  currentRole?: string;
  attachmentStatus?: VerificationStatus;
}): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const byKey = new Map(input.pageFields.filter((field) => field.semanticKey).map((field) => [field.semanticKey as string, field]));

  for (const key of ['basics.phone', 'basics.email', 'basics.idCardNumber'] as const) {
    const page = byKey.get(key);
    if (!page) continue;
    const resumeValue = key === 'basics.phone' ? input.resume.basics.phone : key === 'basics.email' ? input.resume.basics.email : input.resume.basics.idCardNumber;
    if (page.verificationStatus !== 'VERIFIED' || normalized(page.value) !== normalized(resumeValue)) {
      issues.push({ id: `contact-${key}`, severity: 'BLOCKER', code: 'identity_mismatch', message: `${page.label} 与当前档案不一致或尚未严格验证`, resumeKey: key, pageLabel: page.label });
    }
  }

  input.resume.experiences.forEach((experience, index) => {
    if (experience.isCurrent && experience.endDate && !/至今|present|current/i.test(experience.endDate)) {
      issues.push({ id: `current-date-${index}`, severity: 'BLOCKER', code: 'current_job_date_conflict', message: `${experience.company || '工作经历'}标记为目前在职，但结束日期不是“至今”`, resumeKey: `experiences.${index}.endDate` });
    }
    if (experience.startDate && experience.endDate && !/至今|present|current/i.test(experience.endDate) && experience.startDate > experience.endDate) {
      issues.push({ id: `work-range-${index}`, severity: 'BLOCKER', code: 'date_range_conflict', message: `${experience.company || '工作经历'}开始日期晚于结束日期`, resumeKey: `experiences.${index}.startDate` });
    }
  });

  input.resume.educations.forEach((education, index) => {
    if (education.startDate && education.endDate && education.startDate > education.endDate) {
      issues.push({ id: `edu-range-${index}`, severity: 'BLOCKER', code: 'education_date_conflict', message: `${education.schoolName || '教育经历'}开始日期晚于结束日期`, resumeKey: `educations.${index}.startDate` });
    }
  });

  if (input.currentCompany) {
    const company = normalized(input.currentCompany);
    for (const field of input.pageFields) {
      if (!field.semanticKey?.startsWith('qaBank.') && !/textarea|回答|原因|规划|优势|评价/i.test(field.label)) continue;
      const text = normalized(field.value);
      const otherCompanyToken = text.match(/(?:加入|选择|认可|看好)([^，。,.]{2,20})(?:公司|集团|科技)/);
      if (otherCompanyToken && !normalized(otherCompanyToken[1]).includes(company) && !company.includes(normalized(otherCompanyToken[1]))) {
        issues.push({ id: `company-name-${field.label}`, severity: 'BLOCKER', code: 'other_company_name', message: `${field.label} 可能包含其他公司名称，请人工核对`, pageLabel: field.label });
      }
    }
  }

  for (const field of input.pageFields) {
    if (field.verificationStatus === 'MISMATCH' || field.verificationStatus === 'UNREADABLE') {
      issues.push({ id: `verify-${field.label}-${field.semanticKey || ''}`, severity: 'WARNING', code: 'field_not_verified', message: `${field.label} 尚未验证成功`, resumeKey: field.semanticKey, pageLabel: field.label });
    }
  }

  if (input.attachmentStatus && input.attachmentStatus !== 'VERIFIED') {
    issues.push({ id: 'attachment', severity: 'BLOCKER', code: 'attachment_unverified', message: '简历附件缺失或未完成可靠验证' });
  }

  return issues;
}
