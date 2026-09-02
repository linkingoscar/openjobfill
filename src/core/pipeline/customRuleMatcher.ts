import type { FieldDescriptor } from '../../types/pipeline';
import type { CustomFieldMapping, CustomRuleMatchMethod } from '../../types/rule';

export interface ResolvedCustomRuleMatch {
  mapping: CustomFieldMapping;
  method: CustomRuleMatchMethod;
  score: number;
}

export interface CustomRuleResolution {
  matches: Map<string, ResolvedCustomRuleMatch>;
  staleMappingIds: string[];
  unmatchedMappingIds: string[];
  methodCounts: Record<CustomRuleMatchMethod, number>;
}

function normalized(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function selectorMatches(field: FieldDescriptor, selector: string): boolean {
  if (!selector || !field.element.matches) return false;
  try {
    return field.element.matches(selector);
  } catch {
    return false;
  }
}

function occurrenceMatches(field: FieldDescriptor, mapping: CustomFieldMapping): boolean {
  if (mapping.occurrenceMode === 'FIELD_REPEAT_INDEX') {
    return mapping.locator?.sectionIndex === (field.section?.index ?? 0);
  }
  if (mapping.occurrenceMode === 'STATIC' && Number.isInteger(mapping.staticIndex)) {
    return mapping.staticIndex === (field.section?.index ?? 0);
  }
  return true;
}

function locatorScore(field: FieldDescriptor, mapping: CustomFieldMapping): number {
  const expected = mapping.locator;
  const current = field.locator;
  if (!expected || !current || !occurrenceMatches(field, mapping)) return 0;
  if (expected.host && current.host && normalized(expected.host) !== normalized(current.host)) return 0;
  if (expected.tagName && normalized(expected.tagName) !== normalized(current.tagName)) return 0;
  if (expected.inputType && current.inputType && normalized(expected.inputType) !== normalized(current.inputType)) return 0;

  let score = 1;
  if (expected.id && expected.id === current.id) score += 6;
  if (expected.automationId && expected.automationId === current.automationId) score += 6;
  if (expected.testId && expected.testId === current.testId) score += 6;
  if (expected.name && normalized(expected.name) === normalized(current.name)) score += 4;
  if (expected.role && normalized(expected.role) === normalized(current.role)) score += 2;
  if (expected.sectionType && expected.sectionType === current.sectionType) score += 2;
  if (expected.sectionIndex === current.sectionIndex) score += 1;

  const expectedLabel = normalized(expected.label);
  const currentLabel = normalized(current.label || field.label);
  if (expectedLabel && currentLabel) {
    if (expectedLabel === currentLabel) score += 4;
    else if (expectedLabel.includes(currentLabel) || currentLabel.includes(expectedLabel)) score += 2;
  }

  if ((expected.selectors || []).some((selector) => selectorMatches(field, selector))) score += 5;
  return score;
}

function uniqueBest<T extends { score: number }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  if (sorted.length > 1 && sorted[0].score === sorted[1].score) return null;
  return sorted[0];
}

/**
 * Resolve all learned mappings once per page. A selector contradicted by a strong
 * fingerprint is treated as stale instead of being allowed to target a recycled class.
 */
export function resolveCustomRuleMappings(
  fields: FieldDescriptor[],
  mappings: CustomFieldMapping[] = [],
): CustomRuleResolution {
  const matches = new Map<string, ResolvedCustomRuleMatch>();
  const stale = new Set<string>();
  const unmatched = new Set<string>();
  const methodCounts: Record<CustomRuleMatchMethod, number> = { selector: 0, fingerprint: 0, locator: 0 };

  for (const mapping of mappings) {
    if (mapping.status === 'STALE') {
      stale.add(mapping.id);
      continue;
    }

    const eligible = fields.filter((field) => occurrenceMatches(field, mapping));
    const selectorCandidates = eligible.filter((field) => selectorMatches(field, mapping.selector));
    const expectedFingerprint = mapping.fingerprint || mapping.locator?.fingerprint;
    const fingerprintCandidates = expectedFingerprint
      ? eligible.filter((field) => field.fingerprint === expectedFingerprint || field.locator?.fingerprint === expectedFingerprint)
      : [];

    if (selectorCandidates.length === 1 && fingerprintCandidates.length === 1
      && selectorCandidates[0] !== fingerprintCandidates[0]) {
      stale.add(mapping.id);
      continue;
    }

    let chosen: { field: FieldDescriptor; method: CustomRuleMatchMethod; score: number } | null = null;
    if (selectorCandidates.length === 1) {
      chosen = { field: selectorCandidates[0], method: 'selector', score: 100 };
    } else if (fingerprintCandidates.length === 1) {
      chosen = { field: fingerprintCandidates[0], method: 'fingerprint', score: 95 };
    } else {
      const locatorCandidate = uniqueBest(eligible
        .map((field) => ({ field, score: locatorScore(field, mapping) }))
        .filter((candidate) => candidate.score >= 5));
      if (locatorCandidate) chosen = { ...locatorCandidate, method: 'locator' };
    }

    if (!chosen) {
      if (selectorCandidates.length > 1 || fingerprintCandidates.length > 1) stale.add(mapping.id);
      else unmatched.add(mapping.id);
      continue;
    }

    const existing = matches.get(chosen.field.id);
    if (existing && existing.mapping.resumeKey !== mapping.resumeKey) {
      if (existing.score === chosen.score) {
        matches.delete(chosen.field.id);
        stale.add(existing.mapping.id);
        stale.add(mapping.id);
        continue;
      }
      if (existing.score > chosen.score) {
        stale.add(mapping.id);
        continue;
      }
      stale.add(existing.mapping.id);
      methodCounts[existing.method]--;
    }

    matches.set(chosen.field.id, { mapping, method: chosen.method, score: chosen.score });
    methodCounts[chosen.method]++;
  }

  return {
    matches,
    staleMappingIds: [...stale],
    unmatchedMappingIds: [...unmatched],
    methodCounts,
  };
}
