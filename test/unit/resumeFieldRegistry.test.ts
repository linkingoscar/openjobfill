import { describe, expect, it } from 'vitest';
import { buildResumeBindingGroups, buildResumeClipboardItems, getResumeFieldDefinition, RESUME_FIELD_REGISTRY } from '@/core/schema/resumeFieldRegistry';
import { buildResumeKeyOptions } from '@/core/ai/fieldMapper';
import { scrubSensitiveData } from '@/core/privacy/privacyScrubber';
import type { StandardResume } from '@/types/resume';

describe('resume metadata center', () => {
  const resume = { basics: { name: 'Alice', workingYears: 0, visaSponsorship: false, phone: '' }, educations: [{ schoolName: 'A', major: '软件工程' }, { schoolName: 'B' }], qaBank: [{ keyword: 'why', answer: 'domain-only answer', scope: 'domain', domain: 'example.com' }] } as StandardResume;
  it('provides a unique normalized definition with type, group and privacy policy', () => {
    expect(new Set(RESUME_FIELD_REGISTRY.map((field) => field.path)).size).toBe(RESUME_FIELD_REGISTRY.length);
    expect(getResumeFieldDefinition('educations[12].schoolName')).toMatchObject({ path: 'educations[].schoolName', cardinality: 'MANY', group: 'educations' });
    expect(getResumeFieldDefinition('basics.disabilityStatus')).toMatchObject({ sensitivity: 'SENSITIVE', diagnosticExport: false });
    expect(getResumeFieldDefinition('basics.visaSponsorship')?.valueKind).toBe('BOOLEAN');
  });
  it('shares field coverage without sending resume values or domain QA to AI', () => {
    const options = buildResumeKeyOptions(resume);
    expect(options.map((option) => option.resumeKey)).toEqual(expect.arrayContaining(['basics.workingYears', 'basics.visaSponsorship', 'educations.1.schoolName']));
    expect(options.some((option) => option.resumeKey === 'basics.phone' || option.resumeKey.startsWith('qaBank.'))).toBe(false);
    expect(JSON.stringify(options)).not.toContain('Alice');
    const clipboard = buildResumeClipboardItems(resume);
    expect(clipboard.find((field) => field.id === 'basics.workingYears')?.value).toBe('0');
    expect(clipboard.find((field) => field.id === 'basics.visaSponsorship')?.value).toBe('否');
  });
  it('redacts actual schema data under nested resume wrappers without destroying diagnostic field labels', () => {
    const safe = scrubSensitiveData({ resume, field: { name: 'candidateName' }, targetValue: 'unusual private text' });
    expect(safe.resume.basics.name).toBe('[REDACTED]');
    expect(safe.resume.educations[0].schoolName).toBe('[REDACTED]');
    expect(safe.field.name).toBe('candidateName');
    expect(safe.targetValue).toBe('[REDACTED]');
  });
  it('manual bindings include real repeated records and empty editable fields, never synthetic or private QA paths', () => {
    const groups = buildResumeBindingGroups(resume);
    const options = groups.flatMap((group) => group.options);
    expect(options).toContainEqual({ label: '就读学校(2)', value: 'educations.1.schoolName' });
    expect(options.map((option) => option.value)).toEqual(expect.arrayContaining(['basics.phone', 'educations.1.major', 'basics.visaSponsorship']));
    expect(options.some((option) => /^(qaBank|experiences|educations\.2)\./.test(option.value))).toBe(false);
    expect(options.some((option) => option.value === 'basics.avatarUrl')).toBe(false);
    expect(JSON.stringify(groups)).not.toContain('domain-only answer');
  });
});
