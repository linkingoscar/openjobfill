import { CONTROL_ADAPTER_IDS } from './controlAdapters';
import { OFFERLINK_EXPLICIT_DOMAINS, SITE_PROFILES, validateSiteProfile } from './siteProfiles';
import type { SiteProfileVerificationStatus } from '../../types/siteProfile';

export interface CompatibilityFixtureDefinition {
  id: string;
  layer: 'control' | 'workflow' | 'site-template';
  testFile: string;
  domain?: string;
  profileId?: string;
}
export const COMPATIBILITY_FIXTURES: readonly CompatibilityFixtureDefinition[] = [
  { id: 'phoenix-input', layer: 'control', testFile: 'test/unit/controlAdapterRouting.test.ts' },
  { id: 'phoenix-select', layer: 'control', testFile: 'test/unit/controlAdapters.test.ts' },
  { id: 'alibaba-basic', layer: 'site-template', testFile: 'test/unit/platformEnhancers.test.ts' },
  { id: 'semi-controls', layer: 'control', testFile: 'test/unit/controlCompatibility.test.ts' },
  { id: 'mtd-controls', layer: 'control', testFile: 'test/unit/controlAdapterRouting.test.ts' },
  { id: 'save-before-next', layer: 'workflow', testFile: 'test/unit/sectionWorkflow.test.ts' },
  { id: 'single-card', layer: 'workflow', testFile: 'test/unit/sectionWorkflow.test.ts' },
  { id: 'zhaopin-controls', layer: 'control', testFile: 'test/unit/controlAdapterRouting.test.ts' },
  { id: '51job-phone', layer: 'control', testFile: 'test/unit/controlAdapters.test.ts' },
  { id: '51job-three-layer', layer: 'control', testFile: 'test/unit/controlAdapters.test.ts' },
  { id: '51job-date', layer: 'control', testFile: 'test/unit/controlAdapterRouting.test.ts' },
  { id: 'guopin-cascader', layer: 'control', testFile: 'test/unit/controlAdapterRouting.test.ts' },
  { id: 'site-join-qq', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'join.qq.com', profileId: 'tencent-join' },
  { id: 'site-careers-tencent', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'careers.tencent.com', profileId: 'tencent-join' },
  { id: 'site-talent-alibaba', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'talent.alibaba.com', profileId: 'alibaba-talent' },
  { id: 'site-campushr-alibaba', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'campushr.alibaba.com', profileId: 'alibaba-talent' },
  { id: 'site-aidc-jobs-alibaba', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'aidc-jobs.alibaba.com', profileId: 'alibaba-talent' },
  { id: 'site-careers-aliyun', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'careers.aliyun.com', profileId: 'alibaba-talent' },
  { id: 'site-jobs-bytedance', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'jobs.bytedance.com', profileId: 'bytedance-jobs' },
  { id: 'site-campus-jd', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'campus.jd.com', profileId: 'jd-campus' },
  { id: 'site-campus-163', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'campus.163.com', profileId: 'netease-campus' },
  { id: 'site-zhaopin-meituan', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'zhaopin.meituan.com', profileId: 'meituan-careers' },
  { id: 'site-campus-didi', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'campus.didiglobal.com', profileId: 'didi-campus' },
  { id: 'site-jobs-bilibili', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'jobs.bilibili.com', profileId: 'bilibili-jobs' },
  { id: 'site-xiaomi-mioffice', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'xiaomi.jobs.f.mioffice.cn', profileId: 'xiaomi-jobs' },
  { id: 'site-career-papegames', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'career.papegames.com', profileId: 'papegames-career' },
  { id: 'site-campus-kuaishou', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'campus.kuaishou.cn', profileId: 'kuaishou-campus' },
  { id: 'site-talent-baidu', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'talent.baidu.com', profileId: 'baidu-talent' },
  { id: 'site-job-xiaohongshu', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'job.xiaohongshu.com', profileId: 'xiaohongshu-jobs' },
  { id: 'site-career-huawei', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'career.huawei.com', profileId: 'huawei-career' },
  { id: 'site-jobs-mihoyo', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'jobs.mihoyo.com', profileId: 'mihoyo-jobs' },
  { id: 'site-career-sicarrier', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'career.sicarrier.com', profileId: 'sicarrier-career' },
  { id: 'site-picc-zhiye', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'picc.zhiye.com', profileId: 'picc-zhiye' },
  { id: 'site-careers-pdd', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'careers.pddglobalhr.com', profileId: 'pdd-global' },
  { id: 'site-careers-midea', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'careers.midea.com', profileId: 'midea-careers' },
  { id: 'site-xiaoyuan-zhaopin', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'xiaoyuan.zhaopin.com', profileId: 'zhaopin-campus' },
  { id: 'site-job-fandow', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'job.fandow.com', profileId: 'fandow-jobs' },
  { id: 'site-xyz-51job', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'xyz.51job.com', profileId: 'job51-xyz' },
  { id: 'site-c-iguopin', layer: 'site-template', testFile: 'test/unit/siteProfiles.test.ts', domain: 'c.iguopin.com', profileId: 'iguopin-apply' },
] as const;

export interface CompatibilityAudit {
  valid: boolean;
  errors: string[];
  controlAdapterCount: number;
  siteProfileCount: number;
  offerLinkDomainFixtureCount: number;
  profilesByStatus: Record<SiteProfileVerificationStatus, number>;
}

export function auditCompatibilityCatalog(): CompatibilityAudit {
  const errors: string[] = [];
  const fixtureIds = new Set(COMPATIBILITY_FIXTURES.map((fixture) => fixture.id));
  if (fixtureIds.size !== COMPATIBILITY_FIXTURES.length) errors.push('duplicate fixture id');
  const domains = new Map<string, string>();
  const profilesByStatus: Record<SiteProfileVerificationStatus, number> = {
    REGISTERED: 0,
    ROUTE_VERIFIED: 0,
    FIXTURE_VERIFIED: 0,
    SITE_VERIFIED: 0,
  };

  for (const profile of SITE_PROFILES) {
    for (const error of validateSiteProfile(profile)) errors.push(`${profile.id}: ${error}`);
    profilesByStatus[profile.compatibility.status]++;
    for (const fixtureId of profile.compatibility.fixtureIds) {
      if (!fixtureIds.has(fixtureId)) errors.push(`${profile.id}: unknown fixture ${fixtureId}`);
    }
    if (profile.compatibility.status === 'SITE_VERIFIED' && !profile.compatibility.lastVerifiedAt) {
      errors.push(`${profile.id}: SITE_VERIFIED requires lastVerifiedAt`);
    }
    for (const domain of profile.domains) {
      const owner = domains.get(domain);
      if (owner && owner !== profile.id) errors.push(`${domain}: duplicate profiles ${owner}/${profile.id}`);
      domains.set(domain, profile.id);
    }
  }

  const domainFixtures = COMPATIBILITY_FIXTURES.filter((fixture) => fixture.layer === 'site-template' && fixture.domain);
  const fixtureDomains = new Set<string>();
  for (const fixture of domainFixtures) {
    const owner = SITE_PROFILES.find((profile) => profile.id === fixture.profileId);
    if (!owner) errors.push(`${fixture.id}: unknown profile ${fixture.profileId}`);
    else if (!owner.domains.includes(fixture.domain!)) errors.push(`${fixture.id}: domain/profile mismatch`);
    if (fixtureDomains.has(fixture.domain!)) errors.push(`${fixture.domain}: duplicate site fixture`);
    fixtureDomains.add(fixture.domain!);
  }
  for (const domain of OFFERLINK_EXPLICIT_DOMAINS) {
    if (!fixtureDomains.has(domain)) errors.push(`${domain}: missing OfferLink site fixture`);
  }
  if (OFFERLINK_EXPLICIT_DOMAINS.length !== 27) {
    errors.push(`expected 27 OfferLink domains, got ${OFFERLINK_EXPLICIT_DOMAINS.length}`);
  }

  if (new Set(CONTROL_ADAPTER_IDS).size !== CONTROL_ADAPTER_IDS.length) errors.push('duplicate control adapter id');
  if (CONTROL_ADAPTER_IDS.length !== 58) errors.push(`expected 58 control adapters, got ${CONTROL_ADAPTER_IDS.length}`);

  return {
    valid: errors.length === 0,
    errors,
    controlAdapterCount: CONTROL_ADAPTER_IDS.length,
    siteProfileCount: SITE_PROFILES.length,
    offerLinkDomainFixtureCount: domainFixtures.length,
    profilesByStatus,
  };
}
