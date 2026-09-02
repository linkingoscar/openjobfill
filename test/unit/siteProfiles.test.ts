import { describe, expect, it } from 'vitest';
import {
  SITE_PROFILES,
  getEnhancerForUrl,
  getSiteProfileForUrl,
  getSiteProfileMatchTrace,
  validateSiteProfile,
} from '@/core/adapters';
import { auditCompatibilityCatalog } from '@/core/adapters/compatibilityLab';

describe('声明式站点画像与兼容性目录', () => {
  it('所有内置画像均通过安全校验，且兼容目录完整引用现有 fixture', () => {
    expect(SITE_PROFILES).toHaveLength(27);
    for (const profile of SITE_PROFILES) expect(validateSiteProfile(profile)).toEqual([]);
    expect(auditCompatibilityCatalog()).toMatchObject({
      valid: true,
      controlAdapterCount: 58,
      siteProfileCount: 27,
    });
  });

  it('优先按 hostname/path 匹配，不把查询字符串当站点范围', () => {
    expect(getSiteProfileForUrl('https://c.iguopin.com/apply/resume?next=https://evil.example')?.id).toBe('iguopin-apply');
    expect(getSiteProfileForUrl('https://c.iguopin.com/jobs?next=/apply')).toBeNull();
    expect(getEnhancerForUrl('https://campus.jd.com/apply', document)?.id).toBe('site-profile-jd-campus');
  });

  it('未知企业域名可由共享 SaaS DOM 证据匹配 Phoenix 模板', () => {
    document.body.innerHTML = '<form><input class="phoenix-input"></form>';
    const trace = getSiteProfileMatchTrace('https://careers.example.com/apply', document);
    expect(trace.find((item) => item.id === 'tencent-join')?.matchedBy).toBe('template');
  });

  it('不能把只有通用 Ant Select 的未知页面误识别成具体招聘站点', () => {
    document.body.innerHTML = '<form class="ant-form"><div class="ant-select"></div></form>';
    expect(getSiteProfileForUrl('https://careers.example.com/apply', document)).toBeNull();
  });

  it('配置层拒绝提交或下一步一类危险动作', () => {
    const source = SITE_PROFILES.find((item) => item.id === 'pdd-global')!;
    const unsafe = structuredClone(source);
    unsafe.workflows![0].saveButtonLabels = ['提交申请'];
    expect(validateSiteProfile(unsafe)).toContain('education: unsafe action label');
  });
});
