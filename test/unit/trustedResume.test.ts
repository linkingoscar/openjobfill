import { describe, expect, it } from 'vitest';
import { DEMO_RESUME } from '../../src/core/storage/defaultData';
import { confirmField, createJobVariant, mergeParsedCandidates, migrateToResumeV5, resolveVariant, setResumeValue } from '../../src/core/schema/trustedResume';

describe('trusted resume v5', () => {
  it('migrates v4 resumes without losing existing facts', () => {
    const migrated = migrateToResumeV5(DEMO_RESUME, 1000);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.basics.name).toBe(DEMO_RESUME.basics.name);
    expect(migrated.fieldMeta).toEqual({});
    expect(migrated.variantType).toBe('master');
  });

  it('never overwrites a locked confirmed fact during import', () => {
    let resume = migrateToResumeV5(DEMO_RESUME, 1000);
    resume = confirmField(resume, 'basics.name', { lock: true, now: 1100 });
    const result = mergeParsedCandidates(resume, [{
      path: 'basics.name', value: '李四', confidence: 0.99,
      evidence: [{ type: 'text-range', text: '李四' }], parserRule: 'header-name',
    }], 'ai-parser', 1200);
    expect(result.resume.basics.name).toBe(DEMO_RESUME.basics.name);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('locked');
  });

  it('inherits master changes for non-overridden variant fields', () => {
    const master = migrateToResumeV5(DEMO_RESUME, 1000);
    const variant = createJobVariant(master, { company: 'Example', role: 'Engineer' }, 2000);
    const updatedMaster = structuredClone(master);
    updatedMaster.basics.phone = '13900000000';
    updatedMaster.updatedAt = 3000;
    const resolved = resolveVariant(updatedMaster, variant);
    expect(resolved.basics.phone).toBe('13900000000');
  });

  it('preserves explicit job-variant overrides', () => {
    const master = migrateToResumeV5(DEMO_RESUME, 1000);
    const variant = createJobVariant(master, { company: 'Example', role: 'Engineer' }, 2000);
    setResumeValue(variant, 'basics.selfEvaluation', '岗位专属版本');
    variant.variantOverrides = ['basics.selfEvaluation'];
    const updatedMaster = structuredClone(master);
    updatedMaster.basics.selfEvaluation = '主档案新版本';
    const resolved = resolveVariant(updatedMaster, variant);
    expect(resolved.basics.selfEvaluation).toBe('岗位专属版本');
  });
});
