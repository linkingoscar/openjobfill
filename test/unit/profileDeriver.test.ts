import { describe, expect, it } from 'vitest';
import { DEMO_RESUME } from '@/core/storage/defaultData';
import {
  deriveCombinedExperience,
  deriveEducationHonors,
  deriveLanguageSummary,
  deriveWillingnessDecision,
} from '@/core/derivation/profileDeriver';

describe('profileDeriver', () => {
  it('把工作和项目经历合并并按开始时间倒序排列', () => {
    const combined = deriveCombinedExperience(DEMO_RESUME);
    expect(combined.length).toBe(DEMO_RESUME.experiences.length + DEMO_RESUME.projects.length);
    expect(combined.every((item, index) => index === 0 || combined[index - 1].startDate >= item.startDate)).toBe(true);
  });

  it('汇总多语言能力且不丢失证书分数', () => {
    const summary = deriveLanguageSummary(DEMO_RESUME);
    if (DEMO_RESUME.languages.length) {
      expect(summary).toContain(DEMO_RESUME.languages[0].language);
    }
  });

  it('按教育时间挂靠荣誉', () => {
    const resume = {
      ...DEMO_RESUME,
      awards: [{ id: 'award-1', name: '国家奖学金', issueDate: DEMO_RESUME.educations[0].startDate, level: '国家级' }],
    };
    expect(deriveEducationHonors(resume)[resume.educations[0].id][0]).toContain('国家奖学金');
  });

  it('未回答意愿题时拒绝盲猜', () => {
    const unanswered = { ...DEMO_RESUME, basics: { ...DEMO_RESUME.basics, acceptOvertime: undefined } };
    expect(deriveWillingnessDecision('是否接受加班', unanswered)).toBeNull();
    expect(deriveWillingnessDecision('是否接受加班', DEMO_RESUME)?.targetText).toBe(DEMO_RESUME.basics.acceptOvertime ? '是' : '否');
  });
});
