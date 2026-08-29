import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const mokaAdapter: SiteAdapter = {
  id: 'moka-adapter',
  name: 'Moka 招聘系统',
  description: '全量适配采用 Moka 系统的企业招聘门户、校招与社招网申系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('mokahr.com') ||
      url.includes('moka.com') ||
      !!document.querySelector('.moka-application-form, [class*="moka-"]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('Moka 招聘系统适配器');

    // 0. 多段经历自动增行
    if (resume.educations && resume.educations.length > 1) {
      await autoExpandHeuristicSections(['教育', '学历'], resume.educations.length);
    }
    if (resume.experiences && resume.experiences.length > 1) {
      await autoExpandHeuristicSections(['工作', '实习'], resume.experiences.length);
    }
    if (resume.projects && resume.projects.length > 1) {
      await autoExpandHeuristicSections(['项目'], resume.projects.length);
    }

    // 1. 基础身份信息（选择器按置信度从高到低：站点专属 → 中文语义 → 字段名 → 宽泛兜底）
    await s.text(
      document,
      [
        '.moka-name-input input',
        'input[placeholder*="姓名"]',
        'input[name*="candidateName"]',
        'input[name*="name"]',
      ],
      '姓名',
      'basics.name',
      resume.basics.name
    );

    await s.text(
      document,
      [
        'input[placeholder*="手机"]',
        'input[name*="phone"]',
        'input[name*="mobile"]',
        'input[type="tel"]',
      ],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      [
        'input[placeholder*="邮箱"]',
        'input[placeholder*="Email"]',
        'input[name*="email"]',
        'input[type="email"]',
      ],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    await s.radioByText(
      document,
      ['.moka-radio-group label', '[class*="gender"] label', '.el-radio'],
      '性别',
      'basics.gender',
      resume.basics.gender
    );

    // 2. 证件与日期
    await s.text(
      document,
      [
        'input[placeholder*="身份证"]',
        'input[placeholder*="证件号码"]',
        'input[name*="idCard"]',
        'input[name*="idcard"]',
      ],
      '身份证号',
      'basics.idCardNumber',
      resume.basics.idCardNumber
    );

    await s.date(
      document,
      ['input[placeholder*="出生"]', 'input[placeholder*="生日"]', '[class*="birthday"] input'],
      '出生日期',
      'basics.birthDate',
      resume.basics.birthDate
    );

    await s.text(
      document,
      [
        'input[placeholder*="居住地"]',
        'input[placeholder*="现居城市"]',
        'input[name*="city"]',
        '[class*="city"] input',
      ],
      '现居城市',
      'basics.currentLocation.city',
      resume.basics.currentLocation?.city
    );

    await s.text(
      document,
      ['input[placeholder*="github" i]', 'input[name*="github" i]'],
      'GitHub',
      'basics.githubUrl',
      resume.basics.githubUrl
    );

    // 3. 多段教育经历
    //    找不到第 i 个区块时必须 break：降级到 document 会让第 i 段覆写第 1 段
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.moka-education-item, [class*="education-item"], [class*="edu-item"], [class*="educationCard"]'
        )
      );

      for (let i = 0; i < resume.educations.length; i++) {
        const edu = resume.educations[i];
        const card = s.section(eduCards, i, '教育经历');
        if (!card) break;
        const prefix = `educations.${i}`;

        await s.text(
          card,
          ['input[placeholder*="学校"]', 'input[name*="school"]', '[class*="school"] input'],
          `毕业院校(${i + 1})`,
          `${prefix}.schoolName`,
          edu.schoolName
        );

        await s.text(
          card,
          ['input[placeholder*="专业"]', 'input[name*="major"]', '[class*="major"] input'],
          `专业名称(${i + 1})`,
          `${prefix}.major`,
          edu.major
        );

        await s.select(
          card,
          ['[class*="degree"] .el-select', '[class*="degree"] .moka-select', '[placeholder*="学历"]'],
          `学历学位(${i + 1})`,
          `${prefix}.degree`,
          edu.degree
        );

        await s.text(
          card,
          ['input[placeholder*="GPA"]', 'input[placeholder*="绩点"]'],
          `GPA(${i + 1})`,
          `${prefix}.gpa`,
          edu.gpa
        );
      }
    }

    // 4. 多段工作 / 实习经历
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.moka-experience-item, [class*="experience-item"], [class*="work-item"]'
        )
      );

      for (let i = 0; i < resume.experiences.length; i++) {
        const exp = resume.experiences[i];
        const card = s.section(expCards, i, '工作经历');
        if (!card) break;
        const prefix = `experiences.${i}`;

        await s.text(
          card,
          ['input[placeholder*="公司"]', 'input[placeholder*="单位"]', 'input[name*="company"]'],
          `公司名称(${i + 1})`,
          `${prefix}.company`,
          exp.company
        );

        await s.text(
          card,
          ['input[placeholder*="职位"]', 'input[placeholder*="岗位"]', 'input[name*="title"]'],
          `岗位职位(${i + 1})`,
          `${prefix}.title`,
          exp.title
        );

        await s.textarea(
          card,
          [
            'textarea[placeholder*="工作描述"]',
            'textarea[placeholder*="职责"]',
            'textarea[name*="desc"]',
          ],
          `工作内容(${i + 1})`,
          `${prefix}.description`,
          exp.description
        );
      }
    }

    // 5. 自我评价
    await s.textarea(
      document,
      ['textarea[placeholder*="评价"]', 'textarea[placeholder*="介绍"]', 'textarea[name*="self"]'],
      '自我评价',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation
    );

    await sleep(200);

    return s.finish();
  },
};
