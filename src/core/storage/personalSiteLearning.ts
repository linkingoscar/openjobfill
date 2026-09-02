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
  /** Explicit evidence that PERSONAL_VERIFIED was confirmed outside fixture-only runs. */
  personalVerifiedAt?: number;
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

  if (attempted.some((value) => value === 'FAIL')) {
    status = compatibility.status === 'PERSONAL_VERIFIED' || compatibility.status === 'DEGRADED' ? 'DEGRADED' : 'PARTIAL';
  } else if (attempted.some((value) => value === 'PARTIAL')) {
    status = 'PARTIAL';
  } else if (compatibility.status === 'PERSONAL_VERIFIED') {
    // A previously explicit real-flow verification stays verified while all newly observed modules pass.
    status = 'PERSONAL_VERIFIED';
  } else {
    // Automated/fixture/runtime observations alone never claim PERSONAL_VERIFIED.
    status = attempted.length ? 'PARTIAL' : 'UNSEEN';
  }

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

/**
 * PERSONAL_VERIFIED is deliberately an explicit transition. Development fixtures and
 * passive execution telemetry must not call this automatically.
 */
export function markPersonalVerified(
  compatibility: PersonalSiteCompatibility,
  options: { now?: number; browserVersion?: string; urlScope?: string } = {},
): PersonalSiteCompatibility {
  const attempted = Object.values(compatibility.modules).filter((value) => value !== 'UNSEEN');
  if (attempted.length < 3 || attempted.some((value) => value !== 'PASS')) {
    throw new Error('至少三个已验证模块全部 PASS 后才能标记 PERSONAL_VERIFIED');
  }
  const now = options.now ?? Date.now();
  return {
    ...compatibility,
    status: 'PERSONAL_VERIFIED',
    personalVerifiedAt: now,
    lastVerifiedAt: now,
    browserVersion: options.browserVersion || compatibility.browserVersion,
    urlScope: options.urlScope || compatibility.urlScope,
  };
}
