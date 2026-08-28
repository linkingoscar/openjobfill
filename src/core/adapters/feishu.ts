import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';

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
    const startTime = Date.now();
    const logs: FillLogItem[] = [];
    let filledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const logSuccess = (label: string, field: string, value: string) => {
      filledCount++;
      logs.push({ status: 'success', label, field, value });
    };

    const logSkip = (label: string, field: string, reason: string) => {
      skippedCount++;
      logs.push({ status: 'skipped', label, field, value: '', message: reason });
    };

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

    // 1. 姓名 (Semi UI Input)
    const nameInput = document.querySelector<HTMLInputElement>(
      '.semi-input-wrapper input[placeholder*="姓名"], input[aria-label*="姓名"], input[name="name"], input[name="candidate_name"]'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到姓名输入框');
    }

    // 2. 手机号
    const phoneInput = document.querySelector<HTMLInputElement>(
      '.semi-input-wrapper input[placeholder*="手机"], input[aria-label*="手机"], input[name="mobile"], input[name="phone"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    } else {
      logSkip('手机号', 'basics.phone', '未找到手机号输入框');
    }

    // 3. 邮箱
    const emailInput = document.querySelector<HTMLInputElement>(
      '.semi-input-wrapper input[placeholder*="邮箱"], input[aria-label*="邮箱"], input[name="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    } else {
      logSkip('电子邮箱', 'basics.email', '未找到邮箱输入框');
    }

    // 4. 性别 (Semi Radio)
    const genderLabels = Array.from(document.querySelectorAll<HTMLElement>('.semi-radio, label.semi-radio-wrapper'));
    if (genderLabels.length > 0 && resume.basics.gender) {
      const targetGender = resume.basics.gender;
      const matched = genderLabels.find((l) => l.textContent?.includes(targetGender));
      if (matched) {
        const input = matched.querySelector<HTMLInputElement>('input[type="radio"]');
        if (input) setNativeRadioChecked(input, true);
        else matched.click();
        logSuccess('性别', 'basics.gender', targetGender);
      }
    }

    // 5. 出生日期 (Semi DatePicker)
    const dateInput = document.querySelector<HTMLInputElement>(
      '.semi-datepicker input, input[placeholder*="出生日期"], input[placeholder*="生日"]'
    );
    if (dateInput && resume.basics.birthDate) {
      await fillDatePicker(dateInput, resume.basics.birthDate);
      logSuccess('出生日期', 'basics.birthDate', resume.basics.birthDate);
    }

    // 6. 身份证号
    const idCardInput = document.querySelector<HTMLInputElement>(
      '.semi-input-wrapper input[placeholder*="身份证"], input[placeholder*="证件号"], input[name*="id_card"]'
    );
    if (idCardInput && resume.basics.idCardNumber) {
      setNativeValue(idCardInput, resume.basics.idCardNumber);
      logSuccess('身份证号', 'basics.idCardNumber', resume.basics.idCardNumber);
    }

    // 7. 期望城市与岗位
    const cityInput = document.querySelector<HTMLInputElement>('input[placeholder*="期望城市"], input[name*="expected_city"]');
    if (cityInput && resume.basics.expectedCity) {
      setNativeValue(cityInput, resume.basics.expectedCity);
      logSuccess('期望城市', 'basics.expectedCity', resume.basics.expectedCity);
    }

    // 8. 多段教育经历
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(document.querySelectorAll<HTMLElement>('.semi-form-section, [class*="education"], [class*="edu_item"], [class*="edu-item"]'));

      for (let i = 0; i < resume.educations.length; i++) {
        const edu = resume.educations[i];
        const card = eduCards[i] || document;
        const prefix = `educations.${i}`;

        const schoolInput = card.querySelector<HTMLInputElement>(
          'input[placeholder*="学校"], input[aria-label*="学校"], input[name*="school"]'
        );
        if (schoolInput && edu.schoolName) {
          setNativeValue(schoolInput, edu.schoolName);
          logSuccess(`毕业院校(${i + 1})`, `${prefix}.schoolName`, edu.schoolName);
        }

        const majorInput = card.querySelector<HTMLInputElement>(
          'input[placeholder*="专业"], input[aria-label*="专业"], input[name*="major"]'
        );
        if (majorInput && edu.major) {
          setNativeValue(majorInput, edu.major);
          logSuccess(`专业名称(${i + 1})`, `${prefix}.major`, edu.major);
        }

        const degreeSelect = card.querySelector<HTMLElement>('.semi-select, [aria-label*="学历"]');
        if (degreeSelect && edu.degree) {
          await selectCustomOption(degreeSelect, edu.degree);
          logSuccess(`学历学位(${i + 1})`, `${prefix}.degree`, edu.degree);
        }
      }
    }

    // 9. 多段工作经历
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(document.querySelectorAll<HTMLElement>('[class*="experience"], [class*="work-item"], [class*="exp_item"]'));

      for (let i = 0; i < resume.experiences.length; i++) {
        const exp = resume.experiences[i];
        const card = expCards[i] || document;
        const prefix = `experiences.${i}`;

        const compInput = card.querySelector<HTMLInputElement>('input[placeholder*="公司"], input[aria-label*="公司"], input[name*="company"]');
        if (compInput && exp.company) {
          setNativeValue(compInput, exp.company);
          logSuccess(`公司名称(${i + 1})`, `${prefix}.company`, exp.company);
        }

        const titleInput = card.querySelector<HTMLInputElement>('input[placeholder*="职位"], input[aria-label*="职位"], input[name*="title"]');
        if (titleInput && exp.title) {
          setNativeValue(titleInput, exp.title);
          logSuccess(`职位职务(${i + 1})`, `${prefix}.title`, exp.title);
        }

        const descTextarea = card.querySelector<HTMLTextAreaElement>('textarea[placeholder*="工作描述"], textarea[placeholder*="工作内容"], textarea[name*="description"]');
        if (descTextarea && exp.description) {
          setNativeValue(descTextarea, exp.description);
          logSuccess(`工作内容(${i + 1})`, `${prefix}.description`, exp.description);
        }
      }
    }

    // 10. 自我评价
    const selfEvalTextarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="自我评价"], textarea[placeholder*="自我介绍"], textarea[name*="self_evaluation"]'
    );
    if (selfEvalTextarea && resume.basics.selfEvaluation) {
      setNativeValue(selfEvalTextarea, resume.basics.selfEvaluation);
      logSuccess('自我评价', 'basics.selfEvaluation', resume.basics.selfEvaluation);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '飞书招聘适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};

