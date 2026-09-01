import type { EducationExperience, ResumeBasics, WorkExperience } from '../../types/resume';

export interface PlatformProfileImport {
  platform: 'boss' | 'zhaopin';
  basics: Partial<ResumeBasics>;
  educations: EducationExperience[];
  experiences: WorkExperience[];
}

function text(root: ParentNode, selectors: string): string {
  return (root.querySelector(selectors)?.textContent || '').trim();
}

function splitPeriod(period: string): [string, string] {
  const matches = period.match(/\d{4}[./年-]\d{1,2}|至今|现在|present/gi) || [];
  return [matches[0]?.replace(/[.年]/g, '-').replace(/月/g, '') || '', matches[1]?.replace(/[.年]/g, '-').replace(/月/g, '') || ''];
}

export function canImportPlatformProfile(url = typeof location !== 'undefined' ? location.href : ''): boolean {
  return /(^|\.)zhipin\.com|(^|\.)zhaopin\.com/i.test(url);
}

/** 只读取当前页面已经展示的个人资料；不请求平台接口，也不绕过登录或权限。 */
export function extractPlatformProfile(doc: Document = document, url = doc.location?.href || ''): PlatformProfileImport {
  const isBoss = /zhipin\.com/i.test(url);
  const isZhaopin = /zhaopin\.com/i.test(url);
  if (!isBoss && !isZhaopin) throw new Error('当前页面不是支持的个人简历页（BOSS 直聘 / 智联招聘）');

  const basics: Partial<ResumeBasics> = {
    name: text(doc, isBoss ? '.user-info .name, .resume-name, .base-info .name' : '.user-name, .candidate-name, .resume-name'),
    phone: text(doc, '.user-info .phone, .contact-phone, .phone, [class*="phone"]'),
    email: text(doc, '.user-info .email, .contact-email, .email, [class*="email"]'),
  };
  const experiences: WorkExperience[] = [];
  doc.querySelectorAll<HTMLElement>('.history-item, .work-experience-item, .work-item, [class*="work-experience"]').forEach((item, index) => {
    const company = text(item, '.company-name, .company, [class*="company"]');
    if (!company) return;
    const [startDate, endDate] = splitPeriod(text(item, '.time, .period, [class*="time"]'));
    experiences.push({
      id: `platform-exp-${Date.now()}-${index}`,
      company,
      title: text(item, '.position-name, .position, [class*="position"]') || '未标注职位',
      startDate,
      endDate: endDate || '至今',
      description: text(item, '.text, .description, .work-desc, [class*="description"]'),
    });
  });

  const educations: EducationExperience[] = [];
  doc.querySelectorAll<HTMLElement>('.education-item, .school-item, [class*="education-item"]').forEach((item, index) => {
    const schoolName = text(item, '.school-name, .school, [class*="school"]');
    if (!schoolName) return;
    const degreeText = text(item, '.degree, .level, [class*="degree"]');
    const degree: EducationExperience['degree'] = degreeText.includes('博') ? '博士' : degreeText.includes('硕') ? '硕士' : degreeText.includes('专') ? '专科' : degreeText.includes('本') ? '本科' : '其他';
    const [startDate, endDate] = splitPeriod(text(item, '.time, .period, [class*="time"]'));
    educations.push({
      id: `platform-edu-${Date.now()}-${index}`,
      schoolName,
      degree,
      major: text(item, '.major-name, .major, [class*="major"]'),
      startDate,
      endDate,
    });
  });

  return {
    platform: isBoss ? 'boss' : 'zhaopin',
    basics: Object.fromEntries(Object.entries(basics).filter(([, value]) => !!value)) as Partial<ResumeBasics>,
    educations,
    experiences,
  };
}
