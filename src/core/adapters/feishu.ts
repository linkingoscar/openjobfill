import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const feishuAdapter: SiteAdapter = {
  id: 'feishu-adapter',
  name: '飞书招聘系统 (Feishu Hire / 字节跳动)',
  description: '全量适配采用飞书招聘 (jobs.bytedance.com / jobs.feishu.cn / Semi UI) 的网申页面',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('jobs.bytedance.com') ||
      url.includes('jobs.feishu.cn') ||
      url.includes('hire.feishu.cn') ||
      !!document.querySelector('.semi-form, [class*="semi-"], [class*="job-apply"]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('飞书招聘适配器');

    // 0. 自动增行
    if (resume.educations && resume.educations.length > 1) {
      await autoExpandHeuristicSections(['教育', '学历'], resume.educations.length);
    }
    if (resume.experiences && resume.experiences.length > 1) {
      await autoExpandHeuristicSections(['工作', '实习'], resume.experiences.length);
    }
    if (resume.projects && resume.projects.length > 1) {
      await autoExpandHeuristicSections(['项目'], resume.projects.length);
    }

    // 1. 基础身份信息 (Semi UI)
    await s.text(
      document,
      [
        '.semi-input-wrapper input[placeholder*="姓名"]',
        'input[aria-label*="姓名"]',
        'input[name="candidate_name"]',
        'input[name="name"]',
      ],
      '姓名',
      'basics.name',
      resume.basics.name
    );

    await s.text(
      document,
      [
        '.semi-input-wrapper input[placeholder*="手机"]',
        'input[aria-label*="手机"]',
        'input[name="mobile"]',
        'input[name="phone"]',
      ],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      [
        '.semi-input-wrapper input[placeholder*="邮箱"]',
        'input[aria-label*="邮箱"]',
        'input[name="email"]',
      ],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    await s.radioByText(
      document,
      ['.semi-radio', 'label.semi-radio-wrapper'],
      '性别',
      'basics.gender',
      resume.basics.gender
    );

    await s.date(
      document,
      [
        'input[placeholder*="出生日期"]',
        'input[placeholder*="生日"]',
        '.semi-datepicker input',
      ],
      '出生日期',
      'basics.birthDate',
      resume.basics.birthDate
    );

    await s.text(
      document,
      [
        '.semi-input-wrapper input[placeholder*="身份证"]',
        'input[placeholder*="证件号"]',
        'input[name*="id_card"]',
      ],
      '身份证号',
      'basics.idCardNumber',
      resume.basics.idCardNumber
    );

    await s.text(
      document,
      ['input[placeholder*="期望城市"]', 'input[name*="expected_city"]'],
      '期望城市',
      'basics.expectedCity',
      resume.basics.expectedCity
    );

    // 2. 多段教育经历（找不到第 i 个区块则中止，绝不降级到 document）
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.semi-form-section, [class*="education"], [class*="edu_item"], [class*="edu-item"]'
        )
      );

      for (let i = 0; i < resume.educations.length; i++) {
        const edu = resume.educations[i];
        const card = s.section(eduCards, i, '教育经历');
        if (!card) break;
        const prefix = `educations.${i}`;

        await s.text(
          card,
          [
            'input[placeholder*="学校"]',
            'input[aria-label*="学校"]',
            'input[name*="school"]',
          ],
          `毕业院校(${i + 1})`,
          `${prefix}.schoolName`,
          edu.schoolName
        );

        await s.text(
          card,
          ['input[placeholder*="专业"]', 'input[aria-label*="专业"]', 'input[name*="major"]'],
          `专业名称(${i + 1})`,
          `${prefix}.major`,
          edu.major
        );

        await s.select(
          card,
          ['[aria-label*="学历"]', '.semi-select'],
          `学历学位(${i + 1})`,
          `${prefix}.degree`,
          edu.degree
        );
      }
    }

    // 3. 多段工作经历
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[class*="experience"], [class*="work-item"], [class*="exp_item"]'
        )
      );

      for (let i = 0; i < resume.experiences.length; i++) {
        const exp = resume.experiences[i];
        const card = s.section(expCards, i, '工作经历');
        if (!card) break;
        const prefix = `experiences.${i}`;

        await s.text(
          card,
          [
            'input[placeholder*="公司"]',
            'input[aria-label*="公司"]',
            'input[name*="company"]',
          ],
          `公司名称(${i + 1})`,
          `${prefix}.company`,
          exp.company
        );

        await s.text(
          card,
          ['input[placeholder*="职位"]', 'input[aria-label*="职位"]', 'input[name*="title"]'],
          `职位职务(${i + 1})`,
          `${prefix}.title`,
          exp.title
        );

        await s.textarea(
          card,
          [
            'textarea[placeholder*="工作描述"]',
            'textarea[placeholder*="工作内容"]',
            'textarea[name*="description"]',
          ],
          `工作内容(${i + 1})`,
          `${prefix}.description`,
          exp.description
        );
      }
    }

    // 4. 自我评价
    await s.textarea(
      document,
      [
        'textarea[placeholder*="自我评价"]',
        'textarea[placeholder*="自我介绍"]',
        'textarea[name*="self_evaluation"]',
      ],
      '自我评价',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation
    );

    await sleep(200);

    return s.finish();
  },
};
