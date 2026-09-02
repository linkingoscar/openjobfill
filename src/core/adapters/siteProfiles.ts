import type { PlatformEnhancer } from '../../types/pipeline';
import type {
  RepeatableWorkflowConfig,
  SiteProfile,
  SiteProfileMatchTrace,
} from '../../types/siteProfile';

const GENERIC_FIELD_MAPPINGS: Record<string, string> = {
  'input[name="name"], input[name*="candidateName" i], input[placeholder*="姓名"]': 'basics.name',
  'input[type="tel"], input[name*="mobile" i], input[placeholder*="手机"]': 'basics.phone',
  'input[type="email"], input[name*="email" i], input[placeholder*="邮箱"]': 'basics.email',
  'input[name*="idCard" i], input[name*="certNo" i], input[placeholder*="身份证"]': 'basics.idCardNumber',
  'input[name*="school" i], input[placeholder*="学校"], input[placeholder*="院校"]': 'educations.0.schoolName',
  'input[name*="major" i], input[placeholder*="专业"]': 'educations.0.major',
  'input[name*="company" i], input[placeholder*="公司"]': 'experiences.0.company',
  'input[name*="jobTitle" i], input[placeholder*="职位"], input[placeholder*="岗位"]': 'experiences.0.title',
  'textarea[name*="description" i], textarea[placeholder*="描述"]': 'experiences.0.description',
};

const CARD_ACTIONS = {
  editButtonLabels: ['编辑', '修改', 'Edit'],
  saveButtonLabels: ['保存', '确定', '完成', 'Save'],
  addButtonLabels: ['新增', '添加', '新增经历', '添加经历', 'Add'],
  saveAfterLast: true,
  maxRecords: 10,
} as const;

function workflow(
  sectionKey: RepeatableWorkflowConfig['sectionKey'],
  mode: RepeatableWorkflowConfig['mode'],
  rootSelectors: string[],
  itemSelectors: string[],
): RepeatableWorkflowConfig {
  const sectionLabels: Record<RepeatableWorkflowConfig['sectionKey'], string[]> = {
    education: ['新增教育经历', '添加教育经历'],
    experience: ['新增工作经历', '添加工作经历', '新增实习经历', '添加实习经历'],
    project: ['新增项目经历', '添加项目经历'],
    family: ['新增家庭成员', '添加家庭成员'],
  };
  return {
    sectionKey,
    mode,
    rootSelectors,
    itemSelectors,
    editButtonLabels: [...CARD_ACTIONS.editButtonLabels],
    saveButtonLabels: [...CARD_ACTIONS.saveButtonLabels],
    addButtonLabels: [...CARD_ACTIONS.addButtonLabels, ...sectionLabels[sectionKey]],
    saveAfterLast: CARD_ACTIONS.saveAfterLast,
    maxRecords: CARD_ACTIONS.maxRecords,
  };
}

function profile(
  id: string,
  name: string,
  domains: string[],
  options: Partial<Omit<SiteProfile, 'id' | 'version' | 'name' | 'domains' | 'compatibility'>> & {
    status?: SiteProfile['compatibility']['status'];
    fixtures?: string[];
    notes?: string;
  } = {},
): SiteProfile {
  const { status = 'ROUTE_VERIFIED', fixtures = [], notes, ...rest } = options;
  return {
    id,
    version: 1,
    name,
    domains,
    ...rest,
    compatibility: { status, fixtureIds: fixtures, notes },
  };
}

/**
 * Bundled site catalog. These profiles contain data only: selectors, mappings,
 * and a constrained repeat-card workflow. They are intentionally not remotely
 * executable and their verification level is kept separate from registration.
 */
export const SITE_PROFILES: readonly SiteProfile[] = [
  profile('tencent-join', '腾讯招聘', ['join.qq.com', 'careers.tencent.com'], {
    baseEnhancerId: 'tencent-enhancer', detectAny: ['.phoenix-input', '.phoenix-select'],
    status: 'FIXTURE_VERIFIED', fixtures: ['phoenix-input', 'phoenix-select'],
  }),
  profile('alibaba-talent', '阿里系招聘', ['talent.alibaba.com', 'campushr.alibaba.com', 'aidc-jobs.alibaba.com', 'careers.aliyun.com'], {
    baseEnhancerId: 'alibaba-enhancer', detectAny: ['.uxcore-card', '.kuma-label'],
    status: 'FIXTURE_VERIFIED', fixtures: ['alibaba-basic'],
  }),
  profile('bytedance-jobs', '字节跳动招聘', ['jobs.bytedance.com'], {
    baseEnhancerId: 'feishu-enhancer', detectAny: ['[class*="bytedance" i]'],
    status: 'FIXTURE_VERIFIED', fixtures: ['semi-controls'],
  }),
  profile('jd-campus', '京东校园招聘', ['campus.jd.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('netease-campus', '网易校园招聘', ['campus.163.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
  }),
  profile('meituan-careers', '美团招聘', ['zhaopin.meituan.com'], {
    baseEnhancerId: 'meituan-enhancer', status: 'FIXTURE_VERIFIED', fixtures: ['mtd-controls'],
    workflows: [
      workflow('education', 'save-before-next', ['[data-section="education"]', '[class*="education-section" i]'], ['[class*="education-card" i]', '.ant-card']),
      workflow('experience', 'save-before-next', ['[data-section="experience"]', '[class*="experience-section" i]'], ['[class*="experience-card" i]', '.ant-card']),
      workflow('project', 'save-before-next', ['[data-section="project"]', '[class*="project-section" i]'], ['[class*="project-card" i]', '.ant-card']),
    ],
  }),
  profile('didi-campus', '滴滴校园招聘', ['campus.didiglobal.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('bilibili-jobs', '哔哩哔哩招聘', ['jobs.bilibili.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAny: ['.bili-resume-card'],
  }),
  profile('xiaomi-jobs', '小米招聘', ['xiaomi.jobs.f.mioffice.cn'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('papegames-career', '叠纸招聘', ['career.papegames.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('kuaishou-campus', '快手校园招聘', ['campus.kuaishou.cn'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('baidu-talent', '百度招聘', ['talent.baidu.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('xiaohongshu-jobs', '小红书招聘', ['job.xiaohongshu.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('huawei-career', '华为招聘', ['career.huawei.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('mihoyo-jobs', '米哈游招聘', ['jobs.mihoyo.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('sicarrier-career', '新凯来招聘', ['career.sicarrier.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('picc-zhiye', 'PICC 招聘', ['picc.zhiye.com'], {
    baseEnhancerId: 'beisen-enhancer', fieldMappings: GENERIC_FIELD_MAPPINGS,
  }),
  profile('pdd-global', '拼多多招聘', ['careers.pddglobalhr.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, status: 'FIXTURE_VERIFIED', fixtures: ['save-before-next'],
    workflows: [
      workflow('education', 'save-before-next', ['[data-section="education"]', 'section[class*="education" i]', '[class*="education-section" i]'], ['[class*="education-card" i]', '.ant-card']),
      workflow('experience', 'save-before-next', ['[data-section="experience"]', 'section[class*="experience" i]', '[class*="experience-section" i]'], ['[class*="experience-card" i]', '.ant-card']),
      workflow('project', 'save-before-next', ['[data-section="project"]', 'section[class*="project" i]', '[class*="project-section" i]'], ['[class*="project-card" i]', '.ant-card']),
    ],
  }),
  profile('midea-careers', '美的招聘', ['careers.midea.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('zhaopin-campus', '智联校园招聘', ['xiaoyuan.zhaopin.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAll: ['.apply-module', '.apply-form'],
    status: 'FIXTURE_VERIFIED', fixtures: ['zhaopin-controls', 'single-card'],
    workflows: [
      workflow('education', 'single-card', ['[data-section="education"]', '.apply-module[class*="education" i]'], ['.apply-form', '[class*="education-card" i]']),
      workflow('experience', 'single-card', ['[data-section="experience"]', '.apply-module[class*="experience" i]'], ['.apply-form', '[class*="experience-card" i]']),
      workflow('project', 'single-card', ['[data-section="project"]', '.apply-module[class*="project" i]'], ['.apply-form', '[class*="project-card" i]']),
    ],
  }),
  profile('fandow-jobs', 'Fandow 招聘', ['job.fandow.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('job51-xyz', '前程无忧企业招聘', ['xyz.51job.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAny: ['.dl_basicinfo', '.dl_educationwrap'],
    status: 'FIXTURE_VERIFIED', fixtures: ['51job-phone', '51job-three-layer', '51job-date'],
  }),
  profile('iguopin-apply', '国聘网申', ['c.iguopin.com'], {
    pathPrefixes: ['/apply'], fieldMappings: GENERIC_FIELD_MAPPINGS,
    status: 'FIXTURE_VERIFIED', fixtures: ['guopin-cascader'],
  }),
  profile('byd-career', '比亚迪招聘', ['job.byd.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('cmb-career', '招商银行招聘', ['career.cmbchina.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('nhrdc-zhaopin', 'NHRDC 招聘', ['zhaopin.nhrdc.cn'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
  profile('zhaopin-jobs', '智联招聘', ['jobs.zhaopin.com', 'zhaopin.com'], { fieldMappings: GENERIC_FIELD_MAPPINGS }),
] as const;

const ALLOWED_ACTION_LABELS = new Set([
  '编辑', '修改', 'Edit', '保存', '确定', '完成', 'Save',
  '新增', '添加', '新增经历', '添加经历', 'Add',
  '新增教育经历', '添加教育经历', '新增工作经历', '添加工作经历',
  '新增实习经历', '添加实习经历', '新增项目经历', '添加项目经历',
  '新增家庭成员', '添加家庭成员',
]);

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

function hostnameMatches(actual: string, expected: string): boolean {
  const host = normalizeHostname(actual);
  const target = normalizeHostname(expected);
  return host === target || host.endsWith(`.${target}`);
}

function pathMatches(pathname: string, prefixes?: string[]): boolean {
  if (!prefixes?.length) return true;
  return prefixes.some((raw) => {
    const prefix = raw.startsWith('/') ? raw : `/${raw}`;
    return pathname === prefix || pathname.startsWith(`${prefix.replace(/\/$/, '')}/`);
  });
}

function selectorsMatch(doc: Document | undefined, selectors?: string[]): boolean {
  if (!doc || !selectors?.length) return false;
  return selectors.some((selector) => {
    try {
      return !!doc.querySelector(selector);
    } catch {
      return false;
    }
  });
}

function allSelectorsMatch(doc: Document | undefined, selectors?: string[]): boolean {
  if (!doc || !selectors?.length) return false;
  return selectors.every((selector) => {
    try {
      return !!doc.querySelector(selector);
    } catch {
      return false;
    }
  });
}

export function validateSiteProfile(candidate: SiteProfile): string[] {
  const errors: string[] = [];
  if (!candidate.id || !/^[a-z0-9-]+$/.test(candidate.id)) errors.push('invalid id');
  if (candidate.version !== 1) errors.push('unsupported version');
  if (!candidate.domains.length) errors.push('at least one domain is required');
  if (candidate.domains.some((domain) => !/^[a-z0-9.-]+$/i.test(domain))) errors.push('invalid domain');
  if (!candidate.compatibility?.status) errors.push('compatibility status is required');
  for (const config of candidate.workflows || []) {
    if (!config.rootSelectors.length || !config.itemSelectors.length) errors.push(`${config.sectionKey}: selectors are required`);
    if ((config.maxRecords || 10) > 20) errors.push(`${config.sectionKey}: maxRecords exceeds 20`);
    const labels = [...(config.editButtonLabels || []), ...(config.saveButtonLabels || []), ...(config.addButtonLabels || [])];
    if (labels.some((label) => !ALLOWED_ACTION_LABELS.has(label))) errors.push(`${config.sectionKey}: unsafe action label`);
  }
  return errors;
}

export function getSiteProfileMatchTrace(url: string, doc?: Document): SiteProfileMatchTrace[] {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // Template detection may still provide a match for malformed/about URLs.
  }
  return SITE_PROFILES.map((candidate) => {
    const domainMatch = !!parsed
      && candidate.domains.some((domain) => hostnameMatches(parsed!.hostname, domain))
      && pathMatches(parsed.pathname, candidate.pathPrefixes);
    const templateMatch = !domainMatch
      && (selectorsMatch(doc, candidate.detectAny) || allSelectorsMatch(doc, candidate.detectAll));
    return {
      id: candidate.id,
      name: candidate.name,
      version: candidate.version,
      matchedBy: domainMatch ? 'domain' : templateMatch ? 'template' : null,
      status: candidate.compatibility.status,
    };
  });
}

export function getSiteProfileForUrl(url: string, doc?: Document): SiteProfile | null {
  const matched = getSiteProfileMatchTrace(url, doc).find((item) => item.matchedBy);
  return matched ? SITE_PROFILES.find((candidate) => candidate.id === matched.id) || null : null;
}

export function createProfileEnhancer(profile: SiteProfile, base?: PlatformEnhancer): PlatformEnhancer {
  const profileMeta = {
    id: profile.id,
    version: profile.version,
    verificationStatus: profile.compatibility.status,
  };
  if (base) {
    return {
      ...base,
      name: `${base.name} · ${profile.name}`,
      siteProfile: profileMeta,
      fieldMappings: { ...(profile.fieldMappings || {}), ...(base.fieldMappings || {}) },
      repeaterConfigs: { ...(base.repeaterConfigs || {}), ...(profile.repeaterConfigs || {}) },
      workflowConfigs: profile.workflows || base.workflowConfigs,
    };
  }
  return {
    id: `site-profile-${profile.id}`,
    name: `${profile.name}站点画像`,
    description: '由版本化声明式站点画像提供字段和重复区块规则',
    priority: 89,
    matches: (url, doc) => getSiteProfileForUrl(url, doc)?.id === profile.id,
    siteProfile: profileMeta,
    fieldMappings: profile.fieldMappings || GENERIC_FIELD_MAPPINGS,
    repeaterConfigs: profile.repeaterConfigs,
    workflowConfigs: profile.workflows,
  };
}
