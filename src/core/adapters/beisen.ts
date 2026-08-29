import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const beisenAdapter: SiteAdapter = {
  id: 'beisen-adapter',
  name: '北森 (Beisen) 招聘系统',
  description: '全量适配北森 (italent / beisen) 校园招聘与社会招聘简历网申系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('beisen.com') ||
      url.includes('italent.cn') ||
      url.includes('beisen.cn') ||
      !!document.querySelector('[id*="beisen"], [class*="beisen"], .italent-form')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('北森招聘系统适配器');

    // 0. 经历自动增行
    if (resume.educations && resume.educations.length > 1) {
      await autoExpandHeuristicSections(['教育', '学历'], resume.educations.length);
    }
    if (resume.experiences && resume.experiences.length > 1) {
      await autoExpandHeuristicSections(['工作', '实习'], resume.experiences.length);
    }
    if (resume.projects && resume.projects.length > 1) {
      await autoExpandHeuristicSections(['项目'], resume.projects.length);
    }

    // 1. 基础身份信息
    await s.text(
      document,
      ['input[placeholder*="姓名"]', 'input[id*="Name" i]', 'input[name*="Name" i]'],
      '姓名',
      'basics.name',
      resume.basics.name
    );

    await s.text(
      document,
      [
        'input[placeholder*="手机"]',
        'input[id*="Mobile" i]',
        'input[name*="Mobile" i]',
        'input[id*="phone" i]',
      ],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      [
        'input[placeholder*="邮箱"]',
        'input[id*="Email" i]',
        'input[name*="Email" i]',
        'input[id*="mail" i]',
      ],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    await s.text(
      document,
      [
        'input[placeholder*="身份证"]',
        'input[id*="IdCard" i]',
        'input[id*="CertNo" i]',
        'input[name*="IdCard" i]',
      ],
      '身份证号',
      'basics.idCardNumber',
      resume.basics.idCardNumber
    );

    await s.radioByText(
      document,
      ['.beisen-radio', '[class*="gender"] label', '.el-radio'],
      '性别',
      'basics.gender',
      resume.basics.gender
    );

    // 2. 日期与下拉
    await s.date(
      document,
      ['input[placeholder*="出生"]', 'input[id*="Birth" i]', 'input[name*="Birth" i]'],
      '出生年月',
      'basics.birthDate',
      resume.basics.birthDate
    );

    await s.select(
      document,
      ['[placeholder*="政治面貌"]', '[id*="Political" i]', '[class*="political" i]'],
      '政治面貌',
      'basics.politicalStatus',
      resume.basics.politicalStatus
    );

    await s.area(
      document,
      ['[placeholder*="籍贯"]', '[id*="Native" i]', '[class*="native" i]'],
      '籍贯',
      'basics.nativePlace.city',
      resume.basics.nativePlace?.city
    );

    // 3. 多段教育经历（找不到第 i 个区块则中止，绝不降级到 document）
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.italent-education, [class*="education-item"], [class*="edu-item"], [class*="education"] .form-item-group'
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
            'input[id*="School" i]',
            'input[name*="School" i]',
            'input[id*="College" i]',
          ],
          `学校名称(${i + 1})`,
          `${prefix}.schoolName`,
          edu.schoolName
        );

        await s.text(
          card,
          ['input[placeholder*="专业"]', 'input[id*="Major" i]', 'input[name*="Major" i]'],
          `专业名称(${i + 1})`,
          `${prefix}.major`,
          edu.major
        );

        await s.select(
          card,
          ['[placeholder*="学历"]', '[id*="Degree" i]', '[class*="degree" i]'],
          `学历(${i + 1})`,
          `${prefix}.degree`,
          edu.degree
        );
      }
    }

    // 4. 多段工作实习经历
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.italent-work, [class*="work-item"], [class*="experience-item"]'
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
            'input[id*="Company" i]',
            'input[name*="Company" i]',
          ],
          `公司名称(${i + 1})`,
          `${prefix}.company`,
          exp.company
        );

        await s.text(
          card,
          ['input[placeholder*="职位"]', 'input[id*="Title" i]', 'input[id*="Job" i]'],
          `职务名称(${i + 1})`,
          `${prefix}.title`,
          exp.title
        );

        await s.textarea(
          card,
          ['textarea[placeholder*="工作描述"]', 'textarea[placeholder*="职责"]'],
          `工作内容(${i + 1})`,
          `${prefix}.description`,
          exp.description
        );
      }
    }

    // 5. 自我评价
    await s.textarea(
      document,
      [
        'textarea[placeholder*="自我评价"]',
        'textarea[placeholder*="介绍"]',
        'textarea[id*="Eval" i]',
      ],
      '自我评价',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation
    );

    await sleep(200);

    return s.finish();
  },
};
