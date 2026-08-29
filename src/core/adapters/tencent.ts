import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const tencentAdapter: SiteAdapter = {
  id: 'tencent-adapter',
  name: '腾讯招聘官网 (Tencent Careers)',
  description: '适配腾讯校园招聘与社会招聘简历投递系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('join.qq.com') ||
      url.includes('careers.tencent.com') ||
      !!document.querySelector('.tencent-resume, [class*="tencent-"]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('腾讯招聘官网适配器');

    await s.text(
      document,
      ['.name-input input', 'input[placeholder*="姓名"]', 'input[name="name"]'],
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

    await s.text(
      document,
      ['input[placeholder*="身份证"]', 'input[name*="idcard"]', 'input[name*="idCard"]'],
      '身份证号',
      'basics.idCardNumber',
      resume.basics.idCardNumber
    );

    // 教育经历（仅回填最高学历一段）
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.text(
        document,
        ['input[name="schoolName"]', 'input[placeholder*="学校"]'],
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
    }

    await s.textarea(
      document,
      ['textarea[placeholder*="自我评价"]', 'textarea[placeholder*="介绍"]'],
      '自我评价',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation
    );

    await sleep(200);

    return s.finish();
  },
};
