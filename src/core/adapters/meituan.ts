import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const meituanAdapter: SiteAdapter = {
  id: 'meituan-adapter',
  name: '美团招聘官网 (Meituan Careers)',
  description: '适配美团校园招聘与社会招聘简历投递系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('zhaopin.meituan.com') ||
      !!document.querySelector('.meituan-apply, [class*="meituan-"]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('美团招聘官网适配器');

    await s.text(
      document,
      ['.name input', 'input[placeholder*="姓名"]', 'input[name="name"]'],
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

    // 最高学历（仅回填第一段）
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.text(
        document,
        ['input[name*="school"]', 'input[placeholder*="学校"]'],
        '学校名称',
        'educations.0.schoolName',
        edu.schoolName
      );

      await s.text(
        document,
        ['input[name*="major"]', 'input[placeholder*="专业"]'],
        '专业名称',
        'educations.0.major',
        edu.major
      );
    }

    await sleep(200);

    return s.finish();
  },
};
