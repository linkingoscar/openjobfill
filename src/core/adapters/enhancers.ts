import type { PlatformEnhancer } from '../../types/pipeline';
import { createProfileEnhancer, getSiteProfileForUrl } from './siteProfiles';

export const mokaEnhancer: PlatformEnhancer = {
  id: 'moka-enhancer',
  name: 'Moka 招聘系统增强器',
  description: '提供 Moka ATS 特有选择器映射与多卡片增行支持',
  priority: 100,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('mokahr.com') ||
      url.includes('moka.com') ||
      !!root?.querySelector('.moka-application-form, [class*="moka-"]')
    );
  },
  fieldMappings: {
    'input[name*="candidateName"], .moka-name-input input': 'basics.name',
    'input[name*="mobile"], input[type="tel"]': 'basics.phone',
    'input[name*="email"], input[type="email"]': 'basics.email',
    'input[name*="idCard"], input[name*="idcard"]': 'basics.idCardNumber',
    '[class*="birthday"] input': 'basics.birthDate',
    'input[name*="city"], [class*="city"] input': 'basics.currentLocation.city',
    'input[placeholder*="github" i]': 'basics.githubUrl',
    'input[name*="school"], [class*="school"] input': 'educations.0.schoolName',
    'input[name*="major"], [class*="major"] input': 'educations.0.major',
    'input[name*="company"]': 'experiences.0.company',
    'input[name*="title"]': 'experiences.0.title',
    'textarea[name*="desc"]': 'experiences.0.description',
    'textarea[name*="self"]': 'basics.selfEvaluation',
  },
  repeaterConfigs: {
    education: {
      sectionRoot: '.moka-education-section, [class*="education-section"], [data-section="education"]',
      itemSelector: '.moka-education-item, .moka-card, [class*="education-item"]',
      addButton: '.moka-add-education, [class*="add-education"]',
    },
    experience: {
      sectionRoot: '.moka-experience-section, [class*="experience-section"], [data-section="experience"]',
      itemSelector: '.moka-experience-item, [class*="experience-item"]',
      addButton: '.moka-add-experience, [class*="add-experience"]',
    },
    project: {
      sectionRoot: '.moka-project-section, [class*="project-section"]',
      itemSelector: '.moka-project-item, [class*="project-item"]',
      addButton: '.moka-add-project, [class*="add-project"]',
    },
  },
};

export const beisenEnhancer: PlatformEnhancer = {
  id: 'beisen-enhancer',
  name: '北森 iTalent 增强器',
  priority: 95,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('italent.cn') ||
      url.includes('beisen.com') ||
      url.includes('hotjob.cn') ||
      !!root?.querySelector('.beisen-form, [class*="italent"]')
    );
  },
  fieldMappings: {
    'input[id*="Name"], input[id*="name"]': 'basics.name',
    'input[id*="Mobile"], input[id*="phone"]': 'basics.phone',
    'input[id*="Email"], input[id*="email"]': 'basics.email',
    'input[id*="IDCard"], input[id*="idcard"]': 'basics.idCardNumber',
    'input[id*="School"], input[id*="school"]': 'educations.0.schoolName',
    'input[id*="Major"], input[id*="major"]': 'educations.0.major',
    'input[id*="Company"], input[id*="company"]': 'experiences.0.company',
  },
};

export const feishuEnhancer: PlatformEnhancer = {
  id: 'feishu-enhancer',
  name: '飞书招聘 / 字节跳动增强器',
  priority: 95,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('jobs.bytedance.com') ||
      url.includes('feishu.cn') ||
      url.includes('larksuite.com') ||
      !!root?.querySelector('.semi-form, [class*="bytedance"]')
    );
  },
  fieldMappings: {
    'input[placeholder*="姓名"]': 'basics.name',
    'input[placeholder*="手机"]': 'basics.phone',
    'input[placeholder*="邮箱"]': 'basics.email',
    'input[placeholder*="就读学校"], input[placeholder*="毕业院校"]': 'educations.0.schoolName',
    'input[placeholder*="专业"]': 'educations.0.major',
    'input[placeholder*="公司"]': 'experiences.0.company',
    'input[placeholder*="职位"]': 'experiences.0.title',
  },
};

export const workdayEnhancer: PlatformEnhancer = {
  id: 'workday-enhancer',
  name: 'Workday 国际招聘系统增强器',
  priority: 90,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('myworkdayjobs.com') ||
      url.includes('workday.com') ||
      !!root?.querySelector('[data-automation-id*="form"], [data-automation-id]')
    );
  },
  fieldMappings: {
    'input[data-automation-id*="firstName"], [data-automation-id*="firstName"] input, input[data-automation-id="legalNameSection_firstName"], [data-automation-id="legalNameSection_firstName"] input': 'basics.firstName',
    'input[data-automation-id*="lastName"], [data-automation-id*="lastName"] input, input[data-automation-id="legalNameSection_lastName"], [data-automation-id="legalNameSection_lastName"] input': 'basics.lastName',
    'input[data-automation-id*="preferredName"], [data-automation-id*="preferredName"] input': 'basics.preferredName',
    'input[data-automation-id*="phone-number"], [data-automation-id*="phone-number"] input, [data-automation-id*="phone-number"]': 'basics.phone',
    'input[data-automation-id*="email"], [data-automation-id*="email"] input, [data-automation-id="email"]': 'basics.email',
    '[data-automation-id="addressSection_countryRegion"], select[data-automation-id*="country"], [data-automation-id*="country"]': 'basics.country',
    'input[data-automation-id*="postalCode"], [data-automation-id*="postalCode"] input': 'basics.postalCode',
    'input[data-automation-id*="addressLine1"], [data-automation-id*="addressLine1"] input': 'basics.addressLine1',
    'input[data-automation-id*="addressSection_city"], [data-automation-id*="addressSection_city"] input, input[data-automation-id*="city"], [data-automation-id*="city"] input': 'basics.currentLocation.city',
    'input[data-automation-id*="school"], [data-automation-id*="school"] input': 'educations.0.schoolName',
    '[data-automation-id*="degree"], select[data-automation-id*="degree"]': 'educations.0.degree',
    'input[data-automation-id*="field-of-study"], [data-automation-id*="field-of-study"] input, input[data-automation-id*="major"], [data-automation-id*="major"] input': 'educations.0.major',
    'input[data-automation-id*="company"], [data-automation-id*="company"] input': 'experiences.0.company',
    'input[data-automation-id*="jobTitle"], [data-automation-id*="jobTitle"] input': 'experiences.0.title',
    'input[data-automation-id*="startDate"], [data-automation-id*="startDate"] input': 'experiences.0.startDate',
    'input[data-automation-id*="endDate"], [data-automation-id*="endDate"] input': 'experiences.0.endDate',
    'textarea[data-automation-id*="description"], [data-automation-id*="description"] textarea': 'experiences.0.description',
  },
  repeaterConfigs: {
    education: {
      sectionRoot: '[data-automation-id="educationSection"]',
      itemSelector: '[data-automation-id="educationSection"] [data-automation-id="panelSet"]',
      addButton: '[data-automation-id="Add Another Education"], [data-automation-id="add-education-button"]',
    },
    experience: {
      sectionRoot: '[data-automation-id="workExperienceSection"]',
      itemSelector: '[data-automation-id="workExperienceSection"] [data-automation-id="panelSet"]',
      addButton: '[data-automation-id="Add Another Work Experience"], [data-automation-id="add-work-experience-button"]',
    },
  },
};

export const dayeeEnhancer: PlatformEnhancer = {
  id: 'dayee-enhancer',
  name: '用友大易招聘系统增强器',
  description: '覆盖大易 / 万才 ATS 的字段命名、级联选择与经历卡片',
  priority: 98,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('dayee.com') ||
      url.includes('wintalent.cn') ||
      url.includes('yonyou.com') ||
      !!root?.querySelector('[id*="dayee" i], [class*="dayee" i], #resumeFrame')
    );
  },
  fieldMappings: {
    'input[name*="candidateName" i], input[id*="candidateName" i]': 'basics.name',
    'input[name*="mobile" i], input[id*="mobile" i], input[type="tel"]': 'basics.phone',
    'input[name*="email" i], input[id*="email" i], input[type="email"]': 'basics.email',
    'input[name*="idCard" i], input[name*="certNo" i], input[id*="idCard" i]': 'basics.idCardNumber',
    'input[name*="birth" i], input[id*="birth" i], [class*="birthday" i] input': 'basics.birthDate',
    '[name*="political" i], [name*="party" i], [id*="political" i]': 'basics.politicalStatus',
    '[name*="native" i], [id*="native" i], [class*="native-place" i]': 'basics.nativePlace.city',
    'input[name*="school" i], input[id*="school" i]': 'educations.0.schoolName',
    'input[name*="major" i], input[id*="major" i]': 'educations.0.major',
    '[name*="degree" i], [id*="degree" i]': 'educations.0.degree',
    'input[name*="company" i], input[id*="company" i]': 'experiences.0.company',
    'input[name*="jobTitle" i], input[id*="jobTitle" i]': 'experiences.0.title',
    'textarea[name*="evaluation" i], textarea[name*="self" i]': 'basics.selfEvaluation',
  },
  repeaterConfigs: {
    education: {
      sectionRoot: '[class*="education-section" i], [data-section="education"]',
      itemSelector: '[class*="education-item" i], [class*="education-card" i]',
      addButton: '[class*="add-education" i], [data-action="add-education"]',
    },
    experience: {
      sectionRoot: '[class*="experience-section" i], [data-section="experience"]',
      itemSelector: '[class*="experience-item" i], [class*="experience-card" i]',
      addButton: '[class*="add-experience" i], [data-action="add-experience"]',
    },
  },
};

export const nowcoderEnhancer: PlatformEnhancer = {
  id: 'nowcoder-enhancer',
  name: '牛客招聘系统增强器',
  priority: 94,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return url.includes('nowcoder.com') || !!root?.querySelector('.nc-form, [class*="nowcoder" i], .job-apply-box');
  },
  fieldMappings: {
    '.name-item input, input[name="name"], input[placeholder*="姓名"]': 'basics.name',
    'input[name="phone"], input[type="tel"], input[placeholder*="手机"]': 'basics.phone',
    'input[name="email"], input[type="email"], input[placeholder*="邮箱"]': 'basics.email',
    'input[name="school"], input[placeholder*="学校"]': 'educations.0.schoolName',
    'input[name="major"], input[placeholder*="专业"]': 'educations.0.major',
    '.degree-select, [placeholder*="学历"]': 'educations.0.degree',
    'input[name*="github" i], input[placeholder*="GitHub" i]': 'basics.githubUrl',
  },
};

export const tencentEnhancer: PlatformEnhancer = {
  id: 'tencent-enhancer',
  name: '腾讯招聘官网增强器',
  priority: 93,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('join.qq.com') ||
      url.includes('careers.tencent.com') ||
      !!root?.querySelector('.tencent-resume, [class*="tencent-" i]')
    );
  },
  fieldMappings: {
    '.name-input input, input[name="name"], input[placeholder*="姓名"]': 'basics.name',
    'input[name="phone"], input[type="tel"], input[placeholder*="手机"]': 'basics.phone',
    'input[name="email"], input[type="email"], input[placeholder*="邮箱"]': 'basics.email',
    'input[name*="idCard" i], input[placeholder*="身份证"]': 'basics.idCardNumber',
    'input[name="schoolName"], input[placeholder*="学校"]': 'educations.0.schoolName',
    'input[name="major"], input[placeholder*="专业"]': 'educations.0.major',
    'textarea[placeholder*="自我评价"], textarea[placeholder*="介绍"]': 'basics.selfEvaluation',
  },
};

export const alibabaEnhancer: PlatformEnhancer = {
  id: 'alibaba-enhancer',
  name: '阿里巴巴 / 淘天招聘增强器',
  priority: 92,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('talent.alibaba.com') ||
      url.includes('talent.taotao.com') ||
      url.includes('job.alibaba.com') ||
      url.includes('campus.alibaba.com') ||
      !!root?.querySelector('.ali-apply, [class*="alibaba-" i]')
    );
  },
  fieldMappings: {
    'input[placeholder*="姓名"], input[aria-label*="姓名"], input[name="name"]': 'basics.name',
    'input[placeholder*="手机"], input[aria-label*="手机"], input[type="tel"]': 'basics.phone',
    'input[placeholder*="邮箱"], input[aria-label*="邮箱"], input[type="email"]': 'basics.email',
    'input[placeholder*="学校"], input[aria-label*="学校"]': 'educations.0.schoolName',
    'input[placeholder*="专业"], input[aria-label*="专业"]': 'educations.0.major',
    'textarea[placeholder*="总结"], textarea[placeholder*="评价"]': 'basics.selfEvaluation',
  },
};

export const meituanEnhancer: PlatformEnhancer = {
  id: 'meituan-enhancer',
  name: '美团招聘官网增强器',
  priority: 91,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return url.includes('zhaopin.meituan.com') || !!root?.querySelector('.meituan-apply, [class*="meituan-" i]');
  },
  fieldMappings: {
    '.name input, input[name="name"], input[placeholder*="姓名"]': 'basics.name',
    'input[name="phone"], input[type="tel"], input[placeholder*="手机"]': 'basics.phone',
    'input[name="email"], input[type="email"], input[placeholder*="邮箱"]': 'basics.email',
    'input[name*="school" i], input[placeholder*="学校"]': 'educations.0.schoolName',
    'input[name*="major" i], input[placeholder*="专业"]': 'educations.0.major',
  },
};

export const greenhouseEnhancer: PlatformEnhancer = {
  id: 'greenhouse-enhancer',
  name: 'Greenhouse / Lever 招聘增强器',
  priority: 90,
  matches: (url: string, doc?: Document) => {
    const root = doc || (typeof document !== 'undefined' ? document : null);
    return (
      url.includes('greenhouse.io') ||
      url.includes('lever.co') ||
      !!root?.querySelector('#application_form input#first_name, #application_form input#last_name, #lever-form')
    );
  },
  fieldMappings: {
    'input#first_name, input[name*="first_name" i], input[aria-label*="First name" i]': 'basics.firstName',
    'input#last_name, input[name*="last_name" i], input[aria-label*="Last name" i]': 'basics.lastName',
    'input[name="name"], input[aria-label*="Full name" i]': 'basics.name',
    'input#email, input[name="email"], input[type="email"]': 'basics.email',
    'input#phone, input[name="phone"], input[type="tel"]': 'basics.phone',
    'input[name*="linkedin" i], input[placeholder*="LinkedIn" i]': 'basics.linkedinUrl',
    'input[name*="github" i], input[placeholder*="GitHub" i]': 'basics.githubUrl',
  },
};

export const ALL_PLATFORM_ENHANCERS: PlatformEnhancer[] = [
  mokaEnhancer,
  dayeeEnhancer,
  beisenEnhancer,
  feishuEnhancer,
  nowcoderEnhancer,
  tencentEnhancer,
  alibabaEnhancer,
  meituanEnhancer,
  workdayEnhancer,
  greenhouseEnhancer,
];

export interface PlatformEnhancerMatchTrace {
  id: string;
  name: string;
  priority: number;
  matched: boolean;
}

export function getEnhancerMatchTrace(url: string, doc?: Document): PlatformEnhancerMatchTrace[] {
  return ALL_PLATFORM_ENHANCERS.map((enhancer) => {
    let matched = false;
    try {
      matched = enhancer.matches(url, doc);
    } catch {
      // A site-specific detector must never stop the generic pipeline.
    }
    return { id: enhancer.id, name: enhancer.name, priority: enhancer.priority, matched };
  }).sort((a, b) => b.priority - a.priority);
}

export function getEnhancerForUrl(url: string, doc?: Document): PlatformEnhancer | null {
  const profile = getSiteProfileForUrl(url, doc);
  if (profile) {
    const base = profile.baseEnhancerId
      ? ALL_PLATFORM_ENHANCERS.find((enhancer) => enhancer.id === profile.baseEnhancerId)
      : undefined;
    return createProfileEnhancer(profile, base);
  }
  const matchedId = getEnhancerMatchTrace(url, doc).find((candidate) => candidate.matched)?.id;
  return matchedId ? ALL_PLATFORM_ENHANCERS.find((enhancer) => enhancer.id === matchedId) || null : null;
}
