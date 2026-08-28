import type { PlatformEnhancer } from '../../types/pipeline';
import { autoExpandHeuristicSections } from '../engine/repeater';

export const mokaEnhancer: PlatformEnhancer = {
  id: 'moka-enhancer',
  name: 'Moka 招聘系统增强器',
  description: '提供 Moka ATS 特有选择器映射与多卡片增行支持',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('mokahr.com') ||
      url.includes('moka.com') ||
      typeof document !== 'undefined' && !!document.querySelector('.moka-application-form, [class*="moka-"]')
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
  matches: (url: string) => {
    return (
      url.includes('italent.cn') ||
      url.includes('beisen.com') ||
      url.includes('hotjob.cn') ||
      typeof document !== 'undefined' && !!document.querySelector('.beisen-form, [class*="italent"]')
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
  matches: (url: string) => {
    return (
      url.includes('jobs.bytedance.com') ||
      url.includes('feishu.cn') ||
      url.includes('larksuite.com') ||
      typeof document !== 'undefined' && !!document.querySelector('.semi-form, [class*="bytedance"]')
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
  matches: (url: string) => {
    return (
      url.includes('myworkdayjobs.com') ||
      url.includes('workday.com') ||
      typeof document !== 'undefined' && !!document.querySelector('[data-automation-id*="form"], [data-automation-id]')
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

export const ALL_PLATFORM_ENHANCERS: PlatformEnhancer[] = [
  mokaEnhancer,
  beisenEnhancer,
  feishuEnhancer,
  workdayEnhancer,
];

export function getEnhancerForUrl(url: string, doc?: Document): PlatformEnhancer | null {
  const matched = ALL_PLATFORM_ENHANCERS.filter((e) => e.matches(url, doc)).sort((a, b) => b.priority - a.priority);
  return matched.length > 0 ? matched[0] : null;
}
