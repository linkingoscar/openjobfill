import type { FieldLocatorEvidence } from '../../types/pipeline';

export type PersonalRuleStatus = 'ACTIVE' | 'STALE' | 'DISABLED';
export type PersonalCompatibilityStatus = 'UNSEEN' | 'DETECTED' | 'PARTIAL' | 'PERSONAL_VERIFIED' | 'DEGRADED';
export type CompatibilityModule = 'basics' | 'education' | 'experience' | 'project' | 'date' | 'region' | 'attachment' | 'qa';

export interface PersonalSiteMapping {
  id: string;
  hostname: string;
  pathPrefix?: string;
  resumeKey: string;
  selector: string;
  fingerprint?: string;
  locator?: FieldLocatorEvidence;
  sectionType?: string;
  occurrenceMode?: string;
  createdFrom: 'manual-fill' | 'preview-correction' | 'rule-import';
  status: PersonalRuleStatus;
  successCount: number;
  failureCount: number;
  lastVerifiedAt?: number;
  lastFailureReason?: string;
}

export interface PersonalSiteCompatibility {
  hostname: string;
  status: PersonalCompatibilityStatus;
  lastVerifiedAt?: number;
  browserVersion?: string;
  urlScope?: string;
  modules: Record<CompatibilityModule, 'UNSEEN' | 'PASS' | 'PARTIAL' | 'FAIL'>;
  knownLimitations: string[];
  lastFailureCode?: string;
}

export function recordMappingVerification(mapping: PersonalSiteMapping, result: { verified: boolean; reason?: string; now?: number }): PersonalSiteMapping {
  const now = result.now ?? Date.now();
  if (mapping.status === 'DISABLED') return { ...mapping };
  if (result.verified) {
    return {
      ...mapping,
      status: 'ACTIVE',
      successCount: mapping.successCount + 1,
      lastVerifiedAt: now,
      lastFailureReason: undefined,
    };
  }
  const failureCount = mapping.failureCount + 1;
  return {
    ...mapping,
    failureCount,
    status: failureCount >= 2 ? 'STALE' : mapping.status,
    lastFailureReason: result.reason || 'verification_mismatch',
  };
}

export function markSelectorFingerprintConflict(mapping: PersonalSiteMapping, reason = 'selector_fingerprint_conflict'): PersonalSiteMapping {
  return { ...mapping, status: 'STALE', failureCount: mapping.failureCount + 1, lastFailureReason: reason };
}

export function canAutoUsePersonalMapping(mapping: PersonalSiteMapping): boolean {
  return mapping.status === 'ACTIVE' && mapping.successCount >= mapping.failureCount;
}

export function createCompatibility(hostname: string): PersonalSiteCompatibility {
  return {
    hostname,
    status: 'UNSEEN',
    modules: { basics: 'UNSEEN', education: 'UNSEEN', experience: 'UNSEEN', project: 'UNSEEN', date: 'UNSEEN', region: 'UNSEEN', attachment: 'UNSEEN', qa: 'UNSEEN' },
    knownLimitations: [],
  };
}

export function updateCompatibility(
  compatibility: PersonalSiteCompatibility,
  module: CompatibilityModule,
  result: 'PASS' | 'PARTIAL' | 'FAIL',
  options: { now?: number; browserVersion?: string; urlScope?: string; failureCode?: string } = {},
): PersonalSiteCompatibility {
  const modules = { ...compatibility.modules, [module]: result };
  const values = Object.values(modules);
  const attempted = values.filter((value) => value !== 'UNSEEN');
  let status: PersonalCompatibilityStatus = attempted.length ? 'DETECTED' : 'UNSEEN';
  if (attempted.some((value) => value === 'FAIL')) status = compatibility.status === 'PERSONAL_VERIFIED' ? 'DEGRADED' : 'PARTIAL';
  else if (attempted.some((value) => value === 'PARTIAL')) status = 'PARTIAL';
  else if (attempted.length >= 3 && attempted.every((value) => value === 'PASS')) status = 'PERSONAL_VERIFIED';
  else if (attempted.length) status = 'PARTIAL';

  return {
    ...compatibility,
    status,
    modules,
    lastVerifiedAt: options.now ?? Date.now(),
    browserVersion: options.browserVersion || compatibility.browserVersion,
    urlScope: options.urlScope || compatibility.urlScope,
    lastFailureCode: result === 'FAIL' ? options.failureCode || compatibility.lastFailureCode : compatibility.lastFailureCode,
  };
}
