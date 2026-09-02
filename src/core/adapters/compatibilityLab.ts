import { CONTROL_ADAPTER_IDS } from './controlAdapters';
import { SITE_PROFILES, validateSiteProfile } from './siteProfiles';
import type { SiteProfileVerificationStatus } from '../../types/siteProfile';

export interface CompatibilityFixtureDefinition {
  id: string;
  layer: 'control' | 'workflow' | 'site-template';
  testFile: string;
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
] as const;

export interface CompatibilityAudit {
  valid: boolean;
  errors: string[];
  controlAdapterCount: number;
  siteProfileCount: number;
  profilesByStatus: Record<SiteProfileVerificationStatus, number>;
}

export function auditCompatibilityCatalog(): CompatibilityAudit {
  const errors: string[] = [];
  const fixtureIds = new Set(COMPATIBILITY_FIXTURES.map((fixture) => fixture.id));
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

  if (new Set(CONTROL_ADAPTER_IDS).size !== CONTROL_ADAPTER_IDS.length) errors.push('duplicate control adapter id');
  if (CONTROL_ADAPTER_IDS.length !== 58) errors.push(`expected 58 control adapters, got ${CONTROL_ADAPTER_IDS.length}`);

  return {
    valid: errors.length === 0,
    errors,
    controlAdapterCount: CONTROL_ADAPTER_IDS.length,
    siteProfileCount: SITE_PROFILES.length,
    profilesByStatus,
  };
}
