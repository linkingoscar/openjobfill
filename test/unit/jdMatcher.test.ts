import { afterEach, describe, expect, it } from 'vitest';
import { analyzeJDMatch } from '@/core/matcher/jdMatcher';
import { EMPTY_RESUME } from '@/core/storage/defaultData';

afterEach(() => { document.body.innerHTML = ''; });
describe('关键词覆盖反馈', () => {
  it('没有可用关键词时不制造匹配分数', () => {
    document.body.innerHTML = '<h1>行政岗位</h1><p>负责办公用品登记和会议安排。</p>';
    const result = analyzeJDMatch(structuredClone(EMPTY_RESUME));
    expect(result.matchScore).toBeNull();
    expect(result.diagnosticTips.join('')).toContain('无法评估');
  });
  it('零命中为0，部分命中按真实比例显示，不承诺初筛或录用', () => {
    document.body.innerHTML = '<h1>开发岗位</h1><p>要求 Java 和 Python。</p>';
    const resume = structuredClone(EMPTY_RESUME);
    expect(analyzeJDMatch(resume).matchScore).toBe(0);
    resume.skills = [{ id: 'python', name: 'Python' }];
    const result = analyzeJDMatch(resume);
    expect(result.matchScore).toBe(50);
    expect(result.matchedKeywords).toEqual(['Python']);
    expect(result.missingKeywords).toEqual(['Java']);
    expect(result.diagnosticTips.join('')).not.toMatch(/排名|几率很高/);
    expect(result.pageUrl).toBe(window.location.href);
  });
});
