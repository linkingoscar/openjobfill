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

  it('applies record ordering by stable IDs without freezing master record facts', () => {
    const master = migrateToResumeV5(DEMO_RESUME, 1000);
    master.projects = [
      { id: 'p1', projectName: '一', role: '开发', startDate: '2025-01', endDate: '2025-02', description: '旧描述一', responsibility: '职责一' },
      { id: 'p2', projectName: '二', role: '开发', startDate: '2025-03', endDate: '2025-04', description: '描述二', responsibility: '职责二' },
    ];
    const variant = createJobVariant(master, { role: 'Engineer' }, 2000);
    variant.variantOrdering = { projects: ['p2', 'p1'] };
    const updatedMaster = structuredClone(master);
    updatedMaster.projects[0].description = '主档案新描述一';
    const resolved = resolveVariant(updatedMaster, variant);
    expect(resolved.projects.map((project) => project.id)).toEqual(['p2', 'p1']);
    expect(resolved.projects.find((project) => project.id === 'p1')?.description).toBe('主档案新描述一');
  });

  it('applies shortened descriptions to the same record after master insertion and reordering', () => {
    const master = migrateToResumeV5(DEMO_RESUME, 1000);
    master.projects = [
      { id: 'p1', projectName: '一', role: '开发', startDate: '2025-01', endDate: '2025-02', description: '主描述一', responsibility: '职责一' },
      { id: 'p2', projectName: '二', role: '开发', startDate: '2025-03', endDate: '2025-04', description: '主描述二', responsibility: '职责二' },
    ];
    const variant = createJobVariant(master, { role: 'Engineer' }, 2000);
    variant.variantOrdering = { projects: ['p2', 'p1'] };
    variant.variantTextOverrides = [{ collection: 'projects', recordId: 'p2', field: 'description', value: '岗位短版二' }];

    const updatedMaster = structuredClone(master);
    updatedMaster.projects = [
      { id: 'p0', projectName: '新项目', role: '开发', startDate: '2024-11', endDate: '2024-12', description: '新描述', responsibility: '新职责' },
      updatedMaster.projects[0],
      updatedMaster.projects[1],
    ];
    updatedMaster.projects[2].description = '主档案更新后的描述二';

    const resolved = resolveVariant(updatedMaster, variant);
    expect(resolved.projects.find((project) => project.id === 'p2')?.description).toBe('岗位短版二');
    expect(resolved.projects.find((project) => project.id === 'p1')?.description).toBe('主描述一');
    expect(resolved.projects.find((project) => project.id === 'p0')?.description).toBe('新描述');
  });

  it('drops malformed stable text overrides during migration', () => {
    const resume = migrateToResumeV5({
      ...DEMO_RESUME,
      schemaVersion: 5,
      variantTextOverrides: [
        { collection: 'projects', recordId: 'p1', field: 'description', value: '合法短版' },
        { collection: 'experiences', recordId: 'e1', field: 'responsibility', value: '非法字段' },
        { collection: 'projects', recordId: '', field: 'description', value: '无记录' },
      ],
    }, 1000);
    expect(resume.variantTextOverrides).toEqual([
      { collection: 'projects', recordId: 'p1', field: 'description', value: '合法短版' },
    ]);
  });

  it('job-specific link selection hides unselected links only in the resolved variant view', () => {
    const master = migrateToResumeV5(DEMO_RESUME, 1000);
    master.basics.githubUrl = 'https://github.com/example';
    master.basics.blogUrl = 'https://example.com/blog';
    const variant = createJobVariant(master, { role: 'Engineer' }, 2000);
    variant.variantPresentation = { selectedLinkKeys: ['basics.githubUrl'] };
    const resolved = resolveVariant(master, variant);
    expect(resolved.basics.githubUrl).toBe(master.basics.githubUrl);
    expect(resolved.basics.blogUrl).toBe('');
    expect(master.basics.blogUrl).toBe('https://example.com/blog');
  });
});
