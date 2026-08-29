import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const alibabaAdapter: SiteAdapter = {
  id: 'alibaba-adapter',
  name: '阿里巴巴 / 淘天招聘官网',
  description: '适配阿里巴巴集团与淘天招聘在线网申简历系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('talent.alibaba.com') ||
      url.includes('talent.taotao.com') ||
      url.includes('job.alibaba.com') ||
      !!document.querySelector('.ali-apply, [class*="alibaba-"]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('阿里巴巴招聘官网适配器');

    // 1. 基础身份信息
    await s.text(
      document,
      ['input[placeholder*="姓名"]', 'input[aria-label*="姓名"]', 'input[name*="name"]'],
      '姓名',
      'basics.name',
      resume.basics.name
    );

    await s.text(
      document,
      ['input[placeholder*="手机"]', 'input[aria-label*="手机"]', 'input[type="tel"]'],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      ['input[placeholder*="邮箱"]', 'input[aria-label*="邮箱"]', 'input[type="email"]'],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    // 2. 最高学历（仅回填第一段）
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.text(
        document,
        ['input[placeholder*="学校"]', 'input[aria-label*="学校"]'],
        '学校名称',
        'educations.0.schoolName',
        edu.schoolName
      );

      await s.text(
        document,
        ['input[placeholder*="专业"]', 'input[aria-label*="专业"]'],
        '专业名称',
        'educations.0.major',
        edu.major
      );
    }

    // 3. 个人总结
    await s.textarea(
      document,
      ['textarea[placeholder*="总结"]', 'textarea[placeholder*="评价"]'],
      '个人总结',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation
    );

    await sleep(200);

    return s.finish();
  },
};
