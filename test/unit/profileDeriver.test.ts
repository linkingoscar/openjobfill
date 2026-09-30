import { describe, expect, it } from 'vitest';
import { EMPTY_RESUME } from '@/core/storage/defaultData';
import {
  deriveCombinedExperience,
  deriveEducationHonors,
  deriveLanguageSummary,
  deriveWillingnessDecision,
} from '@/core/derivation/profileDeriver';

describe('profileDeriver', () => {
  it('把工作和项目经历合并并按开始时间倒序排列', () => {
    const experience = { id: 'work', company: '公司', title: '工程师', startDate: '2023-01', endDate: '2023-12', description: '工作职责' };
    const resume = { ...EMPTY_RESUME, experiences: [experience], projects: [
      { id: 'older', projectName: '旧项目', role: '成员', startDate: '2022-01', endDate: '2022-12', description: '', responsibility: '' },
      { id: 'newer', projectName: '新项目', role: '负责人', startDate: '2024-01', endDate: '2024-12', description: '项目介绍', responsibility: '设计', achievements: '上线', techStack: 'Vue' },
    ] };
    const before = structuredClone(resume);
    const combined = deriveCombinedExperience(resume);
    expect(combined.map((item) => item.id)).toEqual(['newer', 'work', 'older']);
    expect(combined[0]).toMatchObject({ company: '新项目', title: '负责人', description: '项目介绍\n技术栈：Vue', achievements: '设计\n上线', techStack: 'Vue' });
    expect(combined[1]).toEqual(experience);
    expect(resume).toEqual(before);
  });

  it('汇总多语言能力且不丢失证书分数', () => {
    const summary = deriveLanguageSummary({ ...EMPTY_RESUME, languages: [
      { id: 'english', language: '英语', certificateName: 'IELTS', score: '7.5', proficiency: '熟练' },
      { id: 'japanese', language: '日语', certificateName: 'JLPT N1', score: '160' },
      { id: 'chinese', language: '中文', proficiency: '母语' },
    ] });
    expect(summary).toBe('英语 (IELTS 7.5分) 熟练；日语 (JLPT N1 160分)；中文 母语');
    expect(deriveLanguageSummary({ ...EMPTY_RESUME, languages: [] })).toBe('');
  });

  it('按教育时间挂靠荣誉', () => {
    const resume = {
      ...EMPTY_RESUME,
      educations: [{ id: 'edu', schoolName: '示例大学', degree: '本科' as const, major: '软件工程', startDate: '2020-09', endDate: '2024-06' }],
      awards: [
        { id: 'before', name: '入学前奖项', issueDate: '2020-08' },
        { id: 'start', name: '国家奖学金', issueDate: '2020-09', level: '国家级' },
        { id: 'end', name: '毕业荣誉', issueDate: '2024-06' },
        { id: 'after', name: '毕业后奖项', issueDate: '2024-07' },
        { id: 'unknown', name: '日期未知' },
      ],
    };
    expect(deriveEducationHonors(resume)).toEqual({
      edu: ['2020-09 国家奖学金 (国家级)', '2024-06 毕业荣誉'],
      示例大学本科: ['2020-09 国家奖学金 (国家级)', '2024-06 毕业荣誉'],
    });
  });

  it('未回答意愿题时拒绝盲猜', () => {
    const resume = (answer: boolean | undefined) => ({ ...EMPTY_RESUME, basics: { ...EMPTY_RESUME.basics, acceptOvertime: answer } });
    expect(deriveWillingnessDecision('是否接受加班', resume(undefined))).toBeNull();
    expect(deriveWillingnessDecision('是否接受加班', resume(true))).toEqual({ targetText: '是', isAffirmative: true });
    expect(deriveWillingnessDecision('是否接受加班', resume(false))).toEqual({ targetText: '否', isAffirmative: false });
    expect(deriveWillingnessDecision('喜欢什么颜色', resume(true))).toBeNull();
  });
});
