import { describe, expect, it } from 'vitest';
import {
  SITE_PROFILES,
  getEnhancerForUrl,
  getSiteProfileForUrl,
  getSiteProfileMatchTrace,
  validateSiteProfile,
} from '@/core/adapters';
import { auditCompatibilityCatalog } from '@/core/adapters/compatibilityLab';
import { PageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { PlanGenerator } from '@/core/pipeline/planGenerator';
import { repeatableSectionWorkflowRunner } from '@/core/engine/sectionWorkflow';
import { DEMO_RESUME } from '@/core/storage/defaultData';
import { OFFERLINK_SITE_FIXTURES } from '../fixtures/offerlinkSiteProfiles';

describe('声明式站点画像与兼容性目录', () => {
  it('所有内置画像均通过安全校验，且兼容目录完整引用现有 fixture', () => {
    expect(SITE_PROFILES).toHaveLength(27);
    for (const profile of SITE_PROFILES) expect(validateSiteProfile(profile)).toEqual([]);
    expect(auditCompatibilityCatalog()).toMatchObject({
      valid: true,
      controlAdapterCount: 58,
      siteProfileCount: 27,
      offerLinkDomainFixtureCount: 27,
      profilesByStatus: {
        REGISTERED: 0,
        ROUTE_VERIFIED: 4,
        FIXTURE_VERIFIED: 23,
        SITE_VERIFIED: 0,
      },
    });
  });

  it('27 个 OfferLink 明确域名均有脱敏结构 fixture，并由画像约束扫描范围', () => {
    expect(OFFERLINK_SITE_FIXTURES).toHaveLength(27);
    for (const fixture of OFFERLINK_SITE_FIXTURES) {
      document.body.innerHTML = fixture.html;
      const profile = getSiteProfileForUrl(fixture.url, document);
      const enhancer = getEnhancerForUrl(fixture.url, document);
      expect(profile?.id, fixture.id).toBe(fixture.profileId);
      expect(profile?.compatibility.fixtureIds, fixture.id).toContain(fixture.id);
      expect(enhancer?.formRootSelectors?.length, fixture.id).toBeGreaterThan(0);

      const analyzer = new PageAnalyzer();
      const fields = analyzer.analyzePage(document, {
        formRootSelectors: enhancer?.formRootSelectors,
        controlSelectors: enhancer?.controlSelectors,
      });
      const fixtureField = fields.find((field) => field.element.hasAttribute('data-fixture-field'));
      expect(fixtureField?.type, fixture.id).toBe(fixture.expectedType);
      expect(fields.some((field) => field.name === 'login'), fixture.id).toBe(false);
      expect(analyzer.getLastDiagnostics().formRoots.some((root) => root.selected && root.profileHint), fixture.id).toBe(true);

      const plan = new PlanGenerator().generatePlan(fields, DEMO_RESUME, enhancer);
      expect(plan.items.some((item) => item.semanticKey), fixture.id).toBe(true);
    }
  });

  it('相同根节点类可通过标题证据定位正确的重复区块', () => {
    document.body.innerHTML = `
      <section class="model_edit"><h2 class="model_title">工作经历</h2><input></section>
      <section class="model_edit" data-target><h2 class="model_title">教育经历</h2><input></section>
    `;
    const config = SITE_PROFILES.find((profile) => profile.id === 'meituan-careers')!
      .workflows!.find((workflow) => workflow.sectionKey === 'education')!;
    expect(repeatableSectionWorkflowRunner.findSectionRoot(config)?.hasAttribute('data-target')).toBe(true);
  });

  it('优先按 hostname/path 匹配，不把查询字符串当站点范围', () => {
    expect(getSiteProfileForUrl('https://c.iguopin.com/apply/resume?next=https://evil.example')?.id).toBe('iguopin-apply');
    expect(getSiteProfileForUrl('https://c.iguopin.com/jobs?next=/apply')).toBeNull();
    expect(getEnhancerForUrl('https://campus.jd.com/apply', document)?.id).toBe('site-profile-jd-campus');
  });

  it('未知企业域名可由共享 SaaS DOM 证据匹配 Phoenix 模板', () => {
    document.body.innerHTML = '<form><input class="phoenix-input"></form>';
    const trace = getSiteProfileMatchTrace('https://careers.example.com/apply', document);
    expect(trace.find((item) => item.id === 'tencent-join')?.matchedBy).toBe('template');
  });

  it('不能把只有通用 Ant Select 的未知页面误识别成具体招聘站点', () => {
    document.body.innerHTML = '<form class="ant-form"><div class="ant-select"></div></form>';
    expect(getSiteProfileForUrl('https://careers.example.com/apply', document)).toBeNull();
  });

  it('配置层拒绝提交或下一步一类危险动作', () => {
    const source = SITE_PROFILES.find((item) => item.id === 'pdd-global')!;
    const unsafe = structuredClone(source);
    unsafe.workflows![0].saveButtonLabels = ['提交申请'];
    expect(validateSiteProfile(unsafe)).toContain('education: unsafe action label');
  });
});
