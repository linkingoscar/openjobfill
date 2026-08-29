import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const nowcoderAdapter: SiteAdapter = {
  id: 'nowcoder-adapter',
  name: '牛客招聘系统 (Nowcoder)',
  description: '适配牛客网校招与名企内推投递页面',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('nowcoder.com') ||
      !!document.querySelector('.nc-form, [class*="nowcoder"], .job-apply-box')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('牛客招聘系统适配器');

    await s.text(
      document,
      ['.name-item input', 'input[placeholder*="姓名"]', 'input[name="name"]'],
      '姓名',
      'basics.name',
      resume.basics.name
    );

    await s.text(
      document,
      ['input[placeholder*="手机"]', 'input[name="phone"]', 'input[type="tel"]'],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      ['input[placeholder*="邮箱"]', 'input[name="email"]', 'input[type="email"]'],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    // 最高学历学校与专业
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.text(
        document,
        ['input[name="school"]', 'input[placeholder*="学校"]'],
        '学校名称',
        'educations.0.schoolName',
        edu.schoolName
      );

      await s.text(
        document,
        ['input[name="major"]', 'input[placeholder*="专业"]'],
        '专业名称',
        'educations.0.major',
        edu.major
      );

      await s.select(
        document,
        ['.degree-select', '[placeholder*="学历"]'],
        '学历层次',
        'educations.0.degree',
        edu.degree
      );
    }

    await s.text(
      document,
      ['input[placeholder*="GitHub"]', 'input[name*="github"]'],
      'GitHub',
      'basics.githubUrl',
      resume.basics.githubUrl
    );

    await sleep(200);

    return s.finish();
  },
};
