import { beforeEach, describe, expect, it } from 'vitest';
import { ruleStorage, validateCustomSiteRule } from '@/core/storage/ruleStorage';
import type { CustomSiteRule } from '@/types/rule';

const validRule: CustomSiteRule = {
  id: 'rule-valid',
  name: '测试站点',
  domainPattern: 'jobs.example.com',
  enabled: true,
  fields: [
    { id: 'field-name', selector: 'input[name="name"]', resumeKey: 'basics.name' },
  ],
};

describe('自定义规则校验与容错', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<input name="name" />';
  });

  it('接受合法规则', () => {
    expect(validateCustomSiteRule(validRule, document)).toBeNull();
  });

  it('拒绝空或非法 CSS 选择器', () => {
    expect(validateCustomSiteRule({
      ...validRule,
      fields: [{ ...validRule.fields[0], selector: '' }],
    }, document)).toContain('不能为空');

    expect(validateCustomSiteRule({
      ...validRule,
      fields: [{ ...validRule.fields[0], selector: 'input[' }],
    }, document)).toContain('CSS 选择器无效');
  });

  it('拒绝非法域名正则', () => {
    expect(validateCustomSiteRule({ ...validRule, domainPattern: '[' }, document))
      .toContain('域名匹配模式');
  });

  it('存量坏规则不会阻断其他页面的自动填写分析', async () => {
    localStorage.setItem('openjobfill_custom_rules', JSON.stringify([
      { ...validRule, domainPattern: '[' },
    ]));
    await expect(ruleStorage.findMatchingRuleForUrl('https://other.example/apply'))
      .resolves.toBeNull();
  });
});
