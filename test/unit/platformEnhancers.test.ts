import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { EMPTY_RESUME } from '@/core/storage/defaultData';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  alibabaEnhancer,
  dayeeEnhancer,
  getEnhancerForUrl,
  getEnhancerMatchTrace,
  greenhouseEnhancer,
  meituanEnhancer,
  nowcoderEnhancer,
  tencentEnhancer,
} from '@/core/adapters/enhancers';

describe('Pipeline 平台增强器注册', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['https://apply.dayee.com/resume', dayeeEnhancer.id],
    ['https://www.nowcoder.com/jobs/apply', nowcoderEnhancer.id],
    ['https://join.qq.com/apply.html', tencentEnhancer.id],
    ['https://talent.alibaba.com/campus/apply', alibabaEnhancer.id],
    ['https://zhaopin.meituan.com/apply', meituanEnhancer.id],
    ['https://boards.greenhouse.io/example/jobs/1', greenhouseEnhancer.id],
    ['https://jobs.lever.co/example/1', greenhouseEnhancer.id],
  ])('URL %s 应命中 %s', (url, expectedId) => {
    expect(getEnhancerForUrl(url, document)?.id).toBe(expectedId);
  });

  it('Greenhouse maps actual first, last and full-name controls to distinct values', () => {
    document.body.innerHTML = '<form><input id="first_name"><input id="last_name"><input name="name"></form>';
    const resume = structuredClone(EMPTY_RESUME);
    Object.assign(resume.basics, { firstName: 'Alex', lastName: 'Chen', name: 'Alex Chen' });
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume, greenhouseEnhancer);
    expect(plan.items.map(item => [item.field.element.id || item.field.name, item.action, item.semanticKey, item.targetValue])).toEqual([
      ['first_name', 'FILL', 'basics.firstName', 'Alex'],
      ['last_name', 'FILL', 'basics.lastName', 'Chen'],
      ['name', 'FILL', 'basics.name', 'Alex Chen'],
    ]);
  });

  it('普通 application-form 不应被误判为 Greenhouse，诊断应保留完整匹配轨迹', () => {
    document.body.innerHTML = '<form class="application-form"><input name="name"></form>';
    expect(getEnhancerForUrl('https://jobs.example.com/apply', document)).toBeNull();
    const trace = getEnhancerMatchTrace('https://jobs.example.com/apply', document);
    expect(trace.length).toBeGreaterThan(0);
    expect(trace.every((candidate) => candidate.matched === false)).toBe(true);
  });
});
