export interface OfferLinkSiteFixture {
  id: string;
  profileId: string;
  url: string;
  rootSelector: string;
  html: string;
  expectedType?: 'text' | 'select' | 'cascader' | 'date' | 'radio' | 'checkbox';
}

const decoy = '<form id="login-decoy"><label>登录账号<input name="login"></label></form>';
const fixture = (
  id: string,
  profileId: string,
  url: string,
  rootSelector: string,
  form: string,
  expectedType: OfferLinkSiteFixture['expectedType'] = 'text',
): OfferLinkSiteFixture => ({ id, profileId, url, rootSelector, html: `${decoy}${form}`, expectedType });

/**
 * Privacy-safe structural samples reconstructed from OfferLink 1.8.5's bundled
 * site definitions. They intentionally contain no resume values or live-page data.
 */
export const OFFERLINK_SITE_FIXTURES: readonly OfferLinkSiteFixture[] = [
  fixture('site-join-qq', 'tencent-join', 'https://join.qq.com/apply', '.send_box',
    '<section class="send_box"><h2 class="send_title">个人信息</h2><label class="subtitle">姓名</label><input data-fixture-field name="candidateName"></section>'),
  fixture('site-careers-tencent', 'tencent-join', 'https://careers.tencent.com/apply', '.send_box',
    '<section class="send_box"><h2 class="send_title">基本信息</h2><label class="subtitle">姓名</label><input data-fixture-field name="candidateName"></section>'),
  fixture('site-talent-alibaba', 'alibaba-talent', 'https://talent.alibaba.com/apply', '.uxcore-card',
    '<section class="uxcore-card"><h2 class="uxcore-card-title-text">个人信息</h2><label class="kuma-label vertical-align">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-campushr-alibaba', 'alibaba-talent', 'https://campushr.alibaba.com/apply', '.uxcore-card',
    '<section class="uxcore-card"><h2 class="uxcore-card-title-text">教育经历</h2><label class="kuma-label vertical-align">学校</label><input data-fixture-field name="school"></section>'),
  fixture('site-aidc-jobs-alibaba', 'alibaba-talent', 'https://aidc-jobs.alibaba.com/apply', '.uxcore-card',
    '<section class="uxcore-card"><h2 class="uxcore-card-title-text">Personal information</h2><label class="kuma-label vertical-align">Email</label><input data-fixture-field name="email"></section>'),
  fixture('site-careers-aliyun', 'alibaba-talent', 'https://careers.aliyun.com/apply', '.uxcore-card',
    '<section class="uxcore-card"><h2 class="uxcore-card-title-text">基本信息</h2><label class="kuma-label vertical-align">手机</label><input data-fixture-field name="mobile"></section>'),
  fixture('site-jobs-bytedance', 'bytedance-jobs', 'https://jobs.bytedance.com/campus/apply', '.createFormSection-container',
    '<section class="createFormSection-container"><h2 class="createFormSection-title">基本信息</h2><label class="ud-formily-item-label">城市</label><div data-fixture-field class="byte-select" role="combobox"></div></section>', 'select'),
  fixture('site-campus-jd', 'jd-campus', 'https://campus.jd.com/apply', '.gridContainer___1K4Rp',
    '<section class="gridContainer___1K4Rp"><h2 class="titleContainer___2E0OM">基本信息</h2><label class="filedName___2rXII">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-campus-163', 'netease-campus', 'https://campus.163.com/apply', '.ant-card',
    '<section class="ant-card"><h2 class="ant-card-head-title">个人信息</h2><label class="ant-form-item-label">姓名</label><input data-fixture-field class="ant-input" name="name"></section>'),
  fixture('site-zhaopin-meituan', 'meituan-careers', 'https://zhaopin.meituan.com/apply', '.base_info_edit',
    '<section class="base_info_edit"><h2 class="model_title">基本信息</h2><label class="label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-campus-didi', 'didi-campus', 'https://campus.didiglobal.com/apply', '[class^="apply-block-"]',
    '<section class="apply-block-resume"><h2 class="text-title theme-border-color">基本信息</h2><label class="title-name">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-jobs-bilibili', 'bilibili-jobs', 'https://jobs.bilibili.com/apply', '.bili-resume-card',
    '<section class="bili-resume-card"><h2 class="bili-form-card-header">个人信息</h2><label class="ant-form-item-no-colon">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-xiaomi-mioffice', 'xiaomi-jobs', 'https://xiaomi.jobs.f.mioffice.cn/apply', '.applyFormModuleWrapper-windows',
    '<section class="applyFormModuleWrapper-windows"><h2 class="applyFormModuleWrapper-title">基本信息</h2><label class="atsx-form-item-label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-career-papegames', 'papegames-career', 'https://career.papegames.com/apply', '.applyFormModuleWrapper__2JZaE',
    '<section class="applyFormModuleWrapper__2JZaE"><h2 class="applyFormModuleWrapper-title">个人信息</h2><label class="ud-formily-item-label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-campus-kuaishou', 'kuaishou-campus', 'https://campus.kuaishou.cn/apply', '.edit-resume-form-item',
    '<section class="edit-resume-form-item"><h2 class="section-gorgeously-title">基本信息</h2><label class="ant-form-item-label">姓名</label><input data-fixture-field class="ant-input" name="name"></section>'),
  fixture('site-talent-baidu', 'baidu-talent', 'https://talent.baidu.com/apply', '.resume-item__d8ts2',
    '<section class="resume-item__d8ts2"><h2 class="common-title__CPGfm">个人信息</h2><label class="brick-field-label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-job-xiaohongshu', 'xiaohongshu-jobs', 'https://job.xiaohongshu.com/apply', '.mb-4',
    '<section><div class="mb-4"><h2 class="flex items-center text-h6 font-medium">基本信息</h2><label class="ant-form-item-label">姓名</label><input data-fixture-field class="ant-input" name="name"></div></section>'),
  fixture('site-career-huawei', 'huawei-career', 'https://career.huawei.com/reccampportal/campus4_index.html#/apply', '.module-container',
    '<section class="module-container"><h2 class="module-header-title">基本信息</h2><label class="aui-form-item__label">姓名</label><div class="aui-form-item__content"><input data-fixture-field name="name"></div></section>'),
  fixture('site-jobs-mihoyo', 'mihoyo-jobs', 'https://jobs.mihoyo.com/apply', '.ant-card',
    '<section class="ant-card"><h2 class="ant-card-head-title">基本信息</h2><label class="ant-form-item-label">姓名</label><input data-fixture-field class="ant-input" name="name"></section>'),
  fixture('site-career-sicarrier', 'sicarrier-career', 'https://career.sicarrier.com/apply', '.baseInfo',
    '<section class="baseInfo"><h2 class="form-title">基本信息</h2><label class="el-form-item__label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-picc-zhiye', 'picc-zhiye', 'https://picc.zhiye.com/apply', '.sc-iAKWXU',
    '<section class="sc-iAKWXU"><h2 class="sc-efQSVx eAPYIl">基本信息</h2><label class="form-item__text">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-careers-pdd', 'pdd-global', 'https://careers.pddglobalhr.com/apply', '#basic',
    '<section id="basic"><h2 class="divider-title">基本信息</h2><label class="ant-form-item-label">姓名</label><input data-fixture-field name="name"></section>'),
  fixture('site-careers-midea', 'midea-careers', 'https://careers.midea.com/apply', '.basicResumeForm',
    '<section class="basicResumeForm"><h2 class="css-ielwhl">基本信息</h2><label class="ant-form-item-label"><span class="form-label"><span class="label-content">姓名</span></span></label><input data-fixture-field name="name"></section>'),
  fixture('site-xiaoyuan-zhaopin', 'zhaopin-campus', 'https://xiaoyuan.zhaopin.com/apply', '.apply-module',
    '<section class="apply-module"><h2 class="form-content--title">基本信息</h2><form class="apply-form"><label class="el-form-item__label">姓名</label><input data-fixture-field name="name"></form></section>'),
  fixture('site-job-fandow', 'fandow-jobs', 'https://job.fandow.com/apply', '.ivu-row',
    '<section class="ivu-row"><div class="form-part"><h2 class="title">基本信息</h2><label class="ivu-form-item-label">姓名</label><input data-fixture-field name="name"></div></section>'),
  fixture('site-xyz-51job', 'job51-xyz', 'https://xyz.51job.com/apply', '#container.cornercol1',
    '<section id="container" class="cornercol1"><h2 class="common-header-title">基本信息</h2><dl dlcolname="basic"><dt>姓名</dt><dd class="ci"><input data-fixture-field name="name"></dd></dl></section>'),
  fixture('site-c-iguopin', 'iguopin-apply', 'https://c.iguopin.com/apply/resume', '.item-section',
    '<section class="item-section"><h2 class="section-title"><span class="title-info">基本信息</span></h2><label class="ant-form-item-label"><span>姓名</span></label><input data-fixture-field name="name"></section>'),
] as const;
