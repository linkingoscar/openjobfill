import type { PlatformEnhancer } from '../../types/pipeline';
import type {
  RepeatableWorkflowConfig,
  SiteProfile,
  SiteProfileMatchTrace,
  SiteProfileStructure,
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
  options: Pick<RepeatableWorkflowConfig,
    | 'titleSelectors'
    | 'titleLabels'
    | 'editButtonSelectors'
    | 'saveButtonSelectors'
    | 'addButtonSelectors'> = {},
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
    ...options,
    editButtonLabels: [...CARD_ACTIONS.editButtonLabels],
    saveButtonLabels: [...CARD_ACTIONS.saveButtonLabels],
    addButtonLabels: [...CARD_ACTIONS.addButtonLabels, ...sectionLabels[sectionKey]],
    saveAfterLast: CARD_ACTIONS.saveAfterLast,
    maxRecords: CARD_ACTIONS.maxRecords,
  };
}

function structure(
  formRootSelectors: string[],
  options: Omit<SiteProfileStructure, 'formRootSelectors' | 'evidenceSource'> = {},
): SiteProfileStructure {
  return {
    formRootSelectors,
    ...options,
    evidenceSource: 'offerlink-static-1.8.5',
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
export const OFFERLINK_EXPLICIT_DOMAINS = [
  'join.qq.com', 'careers.tencent.com',
  'talent.alibaba.com', 'campushr.alibaba.com', 'aidc-jobs.alibaba.com', 'careers.aliyun.com',
  'jobs.bytedance.com', 'campus.jd.com', 'campus.163.com', 'zhaopin.meituan.com',
  'campus.didiglobal.com', 'jobs.bilibili.com', 'xiaomi.jobs.f.mioffice.cn',
  'career.papegames.com', 'campus.kuaishou.cn', 'talent.baidu.com', 'job.xiaohongshu.com',
  'career.huawei.com', 'jobs.mihoyo.com', 'career.sicarrier.com', 'picc.zhiye.com',
  'careers.pddglobalhr.com', 'careers.midea.com', 'xiaoyuan.zhaopin.com', 'job.fandow.com',
  'xyz.51job.com', 'c.iguopin.com',
] as const;

export const SITE_PROFILES: readonly SiteProfile[] = [
  profile('tencent-join', '腾讯招聘', ['join.qq.com', 'careers.tencent.com'], {
    baseEnhancerId: 'tencent-enhancer', detectAny: ['.phoenix-input', '.phoenix-select'],
    structure: structure(['.send_box'], {
      titleSelectors: ['.send_title'],
      labelSelectors: ['.subtitle'],
      controlSelectors: {
        input: ['.phoenix-input'], select: ['.el-select', '.phoenix-select'], radio: ['.el-radio__input'],
        upload: ['.el-button.el-button--default.is-round'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: [
      'site-join-qq', 'site-careers-tencent', 'phoenix-input', 'phoenix-select',
    ],
  }),
  profile('alibaba-talent', '阿里系招聘', ['talent.alibaba.com', 'campushr.alibaba.com', 'aidc-jobs.alibaba.com', 'careers.aliyun.com'], {
    baseEnhancerId: 'alibaba-enhancer', detectAny: ['.uxcore-card', '.kuma-label'],
    structure: structure(['.uxcore-card'], {
      titleSelectors: ['.uxcore-card-title-text'], labelSelectors: ['.kuma-label.vertical-align'],
    }),
    status: 'FIXTURE_VERIFIED', fixtures: [
      'site-talent-alibaba', 'site-campushr-alibaba', 'site-aidc-jobs-alibaba', 'site-careers-aliyun',
      'alibaba-basic',
    ],
  }),
  profile('bytedance-jobs', '字节跳动招聘', ['jobs.bytedance.com'], {
    baseEnhancerId: 'feishu-enhancer', detectAny: ['[class*="bytedance" i]'],
    structure: structure([
      '.createFormSection__3y6MP', '.createFormSection-container',
      '.applyFormModuleWrapper-windows', '.applyFormModuleWrapper__2JZaE',
    ], {
      titleSelectors: ['.applyFormModuleWrapper-title', '.createFormSection-title'],
      labelSelectors: ['.ud-formily-item-label', '.atsx-form-item-label'],
      controlSelectors: {
        radio: ['.radio-input'], checkbox: ['.checkbox-input'], date: ['.byte-date-picker'],
        cascader: ['.byte-cascader'], select: ['.byte-select'], upload: ['byte-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-jobs-bytedance', 'semi-controls'],
  }),
  profile('jd-campus', '京东校园招聘', ['campus.jd.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.gridContainer___1K4Rp'], {
      titleSelectors: ['.titleContainer___2E0OM'], labelSelectors: ['.filedName___2rXII'],
      controlSelectors: { radio: ['.ant-radio-wrapper'], upload: ['.ant-btn'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-campus-jd'],
  }),
  profile('netease-campus', '网易校园招聘', ['campus.163.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.ant-card'], {
      titleSelectors: ['.ant-card-head-title'], labelSelectors: ['.ant-form-item-label'],
      controlSelectors: {
        radio: ['.ant-radio'], date: ['.ant-calendar-picker-input.ant-input'],
        cascader: ['.ant-input.ant-cascader-input'], select: ['.ant-select-selection__rendered'],
        upload: ['.file-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-campus-163'],
  }),
  profile('meituan-careers', '美团招聘', ['zhaopin.meituan.com'], {
    baseEnhancerId: 'meituan-enhancer',
    structure: structure(['.base_info_edit', '.model_edit'], {
      titleSelectors: ['.model_title'], labelSelectors: ['.label'],
      controlSelectors: { date: ['.mtd-input-affix-wrapper'], select: ['.mtd-select-filter'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-zhaopin-meituan', 'mtd-controls'],
    workflows: [
      workflow('education', 'save-before-next', ['.model_edit'], ['.model_edit'], {
        titleSelectors: ['.model_title'], titleLabels: ['教育经历'],
        saveButtonSelectors: ['.list_add'], addButtonSelectors: ['.add_icon'],
      }),
      workflow('experience', 'save-before-next', ['.model_edit'], ['.model_edit'], {
        titleSelectors: ['.model_title'], titleLabels: ['工作经历', '实习经历'],
        saveButtonSelectors: ['.list_add'], addButtonSelectors: ['.add_icon'],
      }),
      workflow('project', 'save-before-next', ['.model_edit'], ['.model_edit'], {
        titleSelectors: ['.model_title'], titleLabels: ['项目经历'],
        saveButtonSelectors: ['.list_add'], addButtonSelectors: ['.add_icon'],
      }),
    ],
  }),
  profile('didi-campus', '滴滴校园招聘', ['campus.didiglobal.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['[class^="apply-block-"]'], {
      titleSelectors: ['[class^="text-"][class*="theme-border-color"]'], labelSelectors: ['[class^="title-"]'],
      controlSelectors: {
        date: ['.sd-Input-common-input-2VyCG'], input: ['.sd-Input-input-1WaF0'],
        select: ['.kuma-select2-selection__rendered'], upload: ['.file-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-campus-didi'],
  }),
  profile('bilibili-jobs', '哔哩哔哩招聘', ['jobs.bilibili.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAny: ['.bili-resume-card'],
    structure: structure(['.bili-resume-card'], {
      titleSelectors: ['.bili-form-card-header'], labelSelectors: ['.ant-form-item-no-colon', 'span[data-v-259be428]'],
      controlSelectors: {
        date: ['input.ant-calendar-picker-input'], select: ['.ant-select-selection__rendered'],
        upload: ['.file-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-jobs-bilibili'],
  }),
  profile('xiaomi-jobs', '小米招聘', ['xiaomi.jobs.f.mioffice.cn'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure([
      '.createFormSection__3y6MP', '.createFormSection-container',
      '.applyFormModuleWrapper-windows', '.applyFormModuleWrapper__2JZaE',
    ], {
      titleSelectors: ['.applyFormModuleWrapper-title', '.createFormSection-title'],
      labelSelectors: ['.ud-formily-item-label', '.atsx-form-item-label'],
      controlSelectors: {
        radio: ['.radio-input'], checkbox: ['.checkbox-input'], date: ['.byte-date-picker'],
        cascader: ['.byte-cascader'], select: ['.byte-select'], upload: ['byte-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-xiaomi-mioffice'],
  }),
  profile('papegames-career', '叠纸招聘', ['career.papegames.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure([
      '.createFormSection__3y6MP', '.createFormSection-container',
      '.applyFormModuleWrapper-windows', '.applyFormModuleWrapper__2JZaE',
    ], {
      titleSelectors: ['.applyFormModuleWrapper-title', '.createFormSection-title'],
      labelSelectors: ['.ud-formily-item-label', '.atsx-form-item-label'],
      controlSelectors: {
        radio: ['.radio-input'], checkbox: ['.checkbox-input'], date: ['.byte-date-picker'],
        cascader: ['.byte-cascader'], select: ['.byte-select'], upload: ['byte-upload'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-career-papegames'],
  }),
  profile('kuaishou-campus', '快手校园招聘', ['campus.kuaishou.cn'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.edit-resume-form-item'], {
      titleSelectors: ['.section-gorgeously-title'], labelSelectors: ['.ant-form-item-label'],
      controlSelectors: {
        radio: ['.ant-radio-inner'], select: ['.ant-select-selection-search-input'],
        date: ['.ant-picker-input'], upload: ['.ant-btn'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-campus-kuaishou'],
  }),
  profile('baidu-talent', '百度招聘', ['talent.baidu.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.resume-item__d8ts2'], {
      titleSelectors: ['.common-title__CPGfm'], labelSelectors: ['.brick-field-label'],
      controlSelectors: { upload: ['.ant-btn'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-talent-baidu'],
  }),
  profile('xiaohongshu-jobs', '小红书招聘', ['job.xiaohongshu.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['div:has(> .mb-4)', '.mb-4'], {
      titleSelectors: ['.flex.items-center.text-h6.font-medium'], labelSelectors: ['.ant-form-item-label'],
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-job-xiaohongshu'],
  }),
  profile('huawei-career', '华为招聘', ['career.huawei.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.module-container'], {
      titleSelectors: ['.module-header-title'], labelSelectors: ['label.aui-form-item__label'],
      controlSelectors: { select: ['.aui-form-item__content .aui-select'], radio: ['label.aui-radio[role="radio"]'] },
    }),
    repeaterConfigs: {
      education: { sectionRoot: '.educationExperienceModule', itemSelector: '.module-container:has(.module-main > form.aui-form)', addButton: 'button.addModule-btn' },
      experience: { sectionRoot: '.workExperienceModule', itemSelector: '.module-container:has(.module-main > form.aui-form)', addButton: 'button.addModule-btn' },
      project: { sectionRoot: '.projectExperienceModule', itemSelector: '.module-container:has(.module-main > form.aui-form)', addButton: 'button.addModule-btn' },
    },
    status: 'FIXTURE_VERIFIED', fixtures: ['site-career-huawei'],
  }),
  profile('mihoyo-jobs', '米哈游招聘', ['jobs.mihoyo.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.ant-card'], {
      titleSelectors: ['.ant-card-head-title'], labelSelectors: ['.ant-form-item-label'],
      controlSelectors: { radio: ['.ant-radio-wrapper'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-jobs-mihoyo'],
  }),
  profile('sicarrier-career', '新凯来招聘', ['career.sicarrier.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure([
      '.projectExperience', '.educationExperience', '.workExperience', '.baseInfo',
      '.competitionInfo', '.scholarshipInfo',
    ], {
      titleSelectors: ['.form-title'], labelSelectors: ['.el-form-item__label'],
      controlSelectors: { radio: ['.radio-class'] },
    }),
    repeaterConfigs: {
      education: { sectionRoot: '.educationExperience', itemSelector: '.el-form', addButton: '.el-button.el-button--success' },
      experience: { sectionRoot: '.workExperience', itemSelector: '.el-form', addButton: '.el-button.el-button--success' },
      project: { sectionRoot: '.projectExperience', itemSelector: '.el-form', addButton: '.el-button.el-button--success' },
    },
    status: 'FIXTURE_VERIFIED', fixtures: ['site-career-sicarrier'],
  }),
  profile('picc-zhiye', 'PICC 招聘', ['picc.zhiye.com'], {
    baseEnhancerId: 'beisen-enhancer', fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.sc-iAKWXU'], {
      titleSelectors: ['.sc-efQSVx.eAPYIl'], labelSelectors: ['.form-item__text'],
      controlSelectors: { radio: ['[class*="Radio"][role="radio"]', '.phoenix-radio'] },
    }),
    repeaterConfigs: {
      education: { sectionRoot: '.sc-iAKWXU', itemSelector: '.sc-khQegj', addButton: '[id$="_addButton"] > .sc-iNGGcK' },
    },
    status: 'FIXTURE_VERIFIED', fixtures: ['site-picc-zhiye'],
  }),
  profile('pdd-global', '拼多多招聘', ['careers.pddglobalhr.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure([
      '#basic', '#education', '#language', '#selfAssessment', '#account', '#resume', '#workFile',
      '[class^="wrapper-base-info_wrapper"]', '[class^="wrapper-education-experience_wrapper"]',
    ], {
      titleSelectors: ['[class^="divider"]'], labelSelectors: ['.ant-form-item-label', '[class*="rocket-form-item-label"]'],
      controlSelectors: {
        radio: ['.ant-radio-wrapper', '[class*="rocket-radio"]'], select: ['.ant-select'], cascader: ['.ant-cascader'],
      },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-careers-pdd', 'save-before-next'],
    workflows: [
      workflow('education', 'save-before-next', ['#education', '[class^="wrapper-education-experience_wrapper"]'], ['form > div'], {
        titleSelectors: ['[class^="divider"]'], titleLabels: ['教育经历'],
        saveButtonSelectors: ['.ant-btn-primary', '[class*="save"]'],
        addButtonSelectors: ['[class^="wrapper-education-experience_addBtn"]'],
      }),
    ],
  }),
  profile('midea-careers', '美的招聘', ['careers.midea.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure([
      '.basicResumeForm', '.eduResumeForm', '.internshipWorkResumeForm', '.projectResumeForm',
      '.awardsResumeForm', '.patentResumeForm', '.paperResumeForm', '.languageResumeForm',
      '.specialtyResumeForm', '.remarkResumeForm', '.attachment-form',
    ], {
      titleSelectors: ['.css-ielwhl'], labelSelectors: ['.ant-form-item-label > label > .form-label > .label-content'],
      controlSelectors: { radio: ['.ant-radio-button-wrapper'] },
    }),
    repeaterConfigs: {
      education: { sectionRoot: '.eduResumeForm', itemSelector: '.multiple-block', addButton: '.add-title-btn' },
      experience: { sectionRoot: '.internshipWorkResumeForm', itemSelector: '.multiple-block', addButton: '.add-title-btn' },
      project: { sectionRoot: '.projectResumeForm', itemSelector: '.multiple-block', addButton: '.add-title-btn' },
    },
    status: 'FIXTURE_VERIFIED', fixtures: ['site-careers-midea'],
  }),
  profile('zhaopin-campus', '智联校园招聘', ['xiaoyuan.zhaopin.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAll: ['.apply-module', '.apply-form'],
    structure: structure(['.apply-module'], {
      titleSelectors: ['.form-content--title'], labelSelectors: ['.el-form-item__label'],
      controlSelectors: { radio: ['.radio-class'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-xiaoyuan-zhaopin', 'zhaopin-controls', 'single-card'],
    workflows: [
      workflow('education', 'single-card', ['.apply-module'], ['.apply-form'], {
        titleSelectors: ['.form-content--title'], titleLabels: ['教育经历'],
        editButtonSelectors: ['.icon-box:not(.icon-box-disabled)'], saveButtonSelectors: ['.el-button'], addButtonSelectors: ['.icon-box'],
      }),
      workflow('experience', 'single-card', ['.apply-module'], ['.apply-form'], {
        titleSelectors: ['.form-content--title'], titleLabels: ['工作经历', '实习经历'],
        editButtonSelectors: ['.icon-box:not(.icon-box-disabled)'], saveButtonSelectors: ['.el-button'], addButtonSelectors: ['.icon-box'],
      }),
      workflow('project', 'single-card', ['.apply-module'], ['.apply-form'], {
        titleSelectors: ['.form-content--title'], titleLabels: ['项目经历'],
        editButtonSelectors: ['.icon-box:not(.icon-box-disabled)'], saveButtonSelectors: ['.el-button'], addButtonSelectors: ['.icon-box'],
      }),
    ],
  }),
  profile('fandow-jobs', 'Fandow 招聘', ['job.fandow.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.ivu-row'], {
      titleSelectors: ['.form-part > .title'], labelSelectors: ['.ivu-form-item-label'],
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-job-fandow'],
  }),
  profile('job51-xyz', '前程无忧企业招聘', ['xyz.51job.com'], {
    fieldMappings: GENERIC_FIELD_MAPPINGS, detectAny: ['.dl_basicinfo', '.dl_educationwrap'],
    structure: structure(['#container.cornercol1', '.cornercol1', '.basic-wrapper', '.common'], {
      titleSelectors: ['.basic-header', '.common-header-title'], labelSelectors: ['.el-form-item__label', 'dl[dlcolname] dt'],
      controlSelectors: {
        input: ['.ci input'], cascader: ['.job51-three-layer'], date: ['.setday', '.Wdate'],
      },
    }),
    repeaterConfigs: {
      education: { sectionRoot: '#container.cornercol1, .cornercol1', itemSelector: 'dl[dlcolname]', addButton: 'input.btnAppend[title="添加"], input#btnAppend' },
    },
    status: 'FIXTURE_VERIFIED', fixtures: [
      'site-xyz-51job', '51job-phone', '51job-three-layer', '51job-date',
    ],
  }),
  profile('iguopin-apply', '国聘网申', ['c.iguopin.com'], {
    pathPrefixes: ['/apply'], fieldMappings: GENERIC_FIELD_MAPPINGS,
    structure: structure(['.item-section', '.edit-section'], {
      titleSelectors: ['.section-title .title-info', '.section-title'], labelSelectors: ['.ant-form-item-label label'],
      controlSelectors: { cascader: ['.ant-cascader', '.guopin-cascader'] },
    }),
    status: 'FIXTURE_VERIFIED', fixtures: ['site-c-iguopin', 'guopin-cascader'],
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
  if (candidate.compatibility?.status === 'FIXTURE_VERIFIED' && !candidate.compatibility.fixtureIds.length) {
    errors.push('FIXTURE_VERIFIED requires fixtures');
  }
  if (candidate.structure && !candidate.structure.formRootSelectors.length) {
    errors.push('structure requires form roots');
  }
  for (const config of candidate.workflows || []) {
    if (!config.rootSelectors.length || !config.itemSelectors.length) errors.push(`${config.sectionKey}: selectors are required`);
    if (config.titleLabels?.length && !config.titleSelectors?.length) errors.push(`${config.sectionKey}: title selectors are required`);
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
      formRootSelectors: profile.structure?.formRootSelectors,
      controlSelectors: profile.structure?.controlSelectors,
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
    formRootSelectors: profile.structure?.formRootSelectors,
    controlSelectors: profile.structure?.controlSelectors,
    fieldMappings: profile.fieldMappings || GENERIC_FIELD_MAPPINGS,
    repeaterConfigs: profile.repeaterConfigs,
    workflowConfigs: profile.workflows,
  };
}
