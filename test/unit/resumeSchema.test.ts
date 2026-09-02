import { describe, expect, it } from 'vitest';
import { parseResumePayload, ResumeSchemaError } from '@/core/schema/resumeSchema';
import { importJsonResume } from '@/core/importers/jsonResumeImporter';

describe('StandardResume runtime schema', () => {
  it('按版本迁移旧字段名，而不是只覆盖 schemaVersion', () => {
    const result = parseResumePayload({
      id: 'legacy-v2',
      title: '旧版简历',
      schemaVersion: 2,
      basics: { name: '张三', height: 180, workingYears: 1 },
      educations: [{ id: 'edu-1', school: '示例大学', degree: '本科', major: '软件工程', startDate: '2020-09', endDate: '2024-06', mainCourses: '数据结构' }],
      experiences: [{ id: 'exp-1', company: '示例公司', position: '工程师', startDate: '2024-07', endDate: '至今', description: '研发', achievement: '上线项目' }],
      qaBank: [{ id: 'qa-1', question: '为什么加入', tags: ['动机'], answer: '共同成长' }],
    }, { strict: true, now: 1000 });

    expect(result.migratedFrom).toBe(2);
    expect(result.resume.schemaVersion).toBe(4);
    expect(result.resume.basics.height).toBe('180');
    expect(result.resume.educations[0]).toMatchObject({ schoolName: '示例大学', courses: '数据结构' });
    expect(result.resume.experiences[0]).toMatchObject({ title: '工程师', achievements: '上线项目' });
    expect(result.resume.qaBank[0]).toMatchObject({ keyword: '动机', answer: '共同成长', scope: 'global' });
  });

  it('拒绝未来版本和损坏的已知字段类型', () => {
    expect(() => parseResumePayload({ schemaVersion: 99, basics: {} }, { strict: true }))
      .toThrow(ResumeSchemaError);
    expect(() => parseResumePayload({
      id: 'broken',
      schemaVersion: 4,
      basics: { name: '张三' },
      educations: 'not-an-array',
    }, { strict: true })).toThrow(/educations 必须是数组/);
  });

  it('导入时删除未知字段并拒绝损坏的数组项', () => {
    const clean = parseResumePayload({
      id: 'known',
      title: '已知结构',
      schemaVersion: 4,
      basics: { name: '张三', injected: 'drop-me' },
      educations: [],
      privatePayload: { arbitrary: true },
    }, { strict: true }).resume as unknown as Record<string, unknown>;
    expect(clean.privatePayload).toBeUndefined();
    expect((clean.basics as Record<string, unknown>).injected).toBeUndefined();

    expect(() => importJsonResume({
      id: 'broken-import',
      schemaVersion: 4,
      basics: { name: '张三' },
      educations: ['bad-item'],
    })).toThrow(/educations\[0\] 必须是对象/);
  });
});
