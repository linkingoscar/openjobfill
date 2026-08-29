import { describe, expect, it } from 'vitest';
import {
  alibabaEnhancer,
  dayeeEnhancer,
  getEnhancerForUrl,
  greenhouseEnhancer,
  meituanEnhancer,
  nowcoderEnhancer,
  tencentEnhancer,
} from '@/core/adapters/enhancers';

describe('Pipeline 平台增强器注册', () => {
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

  it('Greenhouse 的 first/last/full name 应映射到不同字段', () => {
    expect(greenhouseEnhancer.fieldMappings?.['input#first_name, input[name*="first_name" i], input[aria-label*="First name" i]'])
      .toBe('basics.firstName');
    expect(greenhouseEnhancer.fieldMappings?.['input#last_name, input[name*="last_name" i], input[aria-label*="Last name" i]'])
      .toBe('basics.lastName');
    expect(greenhouseEnhancer.fieldMappings?.['input[name="name"], input[aria-label*="Full name" i]'])
      .toBe('basics.name');
  });
});
