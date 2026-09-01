import { describe, expect, it } from 'vitest';
import { canImportPlatformProfile, extractPlatformProfile } from '@/core/importers/platformProfileImporter';

describe('platformProfileImporter', () => {
  it('从 BOSS 个人简历可见 DOM 提取基本信息与经历', () => {
    document.body.innerHTML = `
      <div class="user-info"><span class="name">张三</span><span class="phone">13800138000</span></div>
      <div class="work-item"><span class="company-name">示例科技</span><span class="position-name">工程师</span><span class="time">2023.01 - 至今</span><p class="description">负责前端</p></div>
      <div class="education-item"><span class="school-name">示例大学</span><span class="degree">硕士</span><span class="major">软件工程</span><span class="time">2020.09 - 2023.06</span></div>
    `;
    const result = extractPlatformProfile(document, 'https://www.zhipin.com/web/geek/resume');
    expect(result.basics.name).toBe('张三');
    expect(result.experiences[0]).toMatchObject({ company: '示例科技', title: '工程师', startDate: '2023-01', endDate: '至今' });
    expect(result.educations[0]).toMatchObject({ schoolName: '示例大学', degree: '硕士', major: '软件工程' });
  });

  it('仅在支持的平台显示同步入口', () => {
    expect(canImportPlatformProfile('https://www.zhaopin.com/resume')).toBe(true);
    expect(canImportPlatformProfile('https://example.com')).toBe(false);
  });
});
