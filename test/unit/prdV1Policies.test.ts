import { describe, expect, it } from 'vitest';
import { decideFill } from '../../src/core/pipeline/decisionPolicy';
import { sanitizeFieldMappingSuggestions } from '../../src/core/ai/protocolV2';
import { learnQA, matchScopedQA } from '../../src/core/engine/scopedQABank';
import { createCompatibility, markPersonalVerified, markSelectorFingerprintConflict, recordMappingVerification, updateCompatibility } from '../../src/core/storage/personalSiteLearning';

const field = (overrides: Record<string, unknown> = {}) => ({
  id: 'f', element: document.createElement('input'), type: 'text', label: '姓名', placeholder: '', name: '', ariaLabel: '', required: true,
  disabled: false, readOnly: false, currentValue: '', contextText: '', ...overrides,
}) as any;

describe('PRD v1 policies', () => {
  it('requires review for critical generic matches even when confidence is high', () => {
    const result = decideFill({ field: field(), resumeKey: 'basics.name', confidence: 0.99, source: 'semantic_dictionary', hasValue: true, firstVisit: true });
    expect(result.decision).toBe('FILL_REVIEW_REQUIRED');
  });

  it('keeps optional low confidence fields visible instead of silently skipping them', () => {
    const result = decideFill({ field: field({ required: false }), confidence: 0.2, source: 'fallback', hasValue: false });
    expect(result.decision).toBe('OPTIONAL_UNMATCHED');
  });

  it('filters AI identity mappings into other-person fields', () => {
    const result = sanitizeFieldMappingSuggestions([
      { fieldIndex: 0, resumeKey: 'basics.phone', confidence: 0.99, reasonCode: 'label_match' },
    ], [{ index: 0, label: '紧急联系人手机号', placeholder: '', name: '', ariaLabel: '', inputType: 'text', required: true }], [
      { resumeKey: 'basics.phone', label: '手机号', hasValue: true, riskLevel: 'CRITICAL' },
    ]);
    expect(result).toEqual([]);
  });

  it('prioritizes company scoped QA over global QA', () => {
    const global = learnQA({ question: '为什么选择我们', answer: '全局', scope: 'global', source: 'manual', confirmedByUser: true, now: 1 });
    const company = learnQA({ question: '为什么选择我们', answer: '公司专属', scope: 'company-domain', companyDomain: 'example.com', source: 'manual', confirmedByUser: true, now: 2 });
    expect(matchScopedQA('为什么选择我们', [global, company], { hostname: 'jobs.example.com' })?.version.answer).toBe('公司专属');
  });

  it('keeps fixture telemetry separate until PERSONAL_VERIFIED is explicitly confirmed', () => {
    const mapping = { id: 'm', hostname: 'example.com', resumeKey: 'basics.name', selector: '#name', createdFrom: 'manual-fill', status: 'ACTIVE', successCount: 2, failureCount: 0 } as const;
    expect(markSelectorFingerprintConflict(mapping).status).toBe('STALE');
    expect(recordMappingVerification({ ...mapping }, { verified: true, now: 10 }).successCount).toBe(3);

    let compat = createCompatibility('example.com');
    compat = updateCompatibility(compat, 'basics', 'PASS', { now: 1 });
    compat = updateCompatibility(compat, 'education', 'PASS', { now: 2 });
    compat = updateCompatibility(compat, 'date', 'PASS', { now: 3 });
    expect(compat.status).toBe('PARTIAL');
    expect(compat.personalVerifiedAt).toBeUndefined();

    compat = markPersonalVerified(compat, { now: 4, urlScope: 'https://example.com' });
    expect(compat.status).toBe('PERSONAL_VERIFIED');
    expect(compat.personalVerifiedAt).toBe(4);

    compat = updateCompatibility(compat, 'attachment', 'FAIL', { now: 5, failureCode: 'attachment_unverified' });
    expect(compat.status).toBe('DEGRADED');
  });
});
