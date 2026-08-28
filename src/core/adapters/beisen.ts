import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';

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

    // 1. 姓名
    const nameInput = document.querySelector<HTMLInputElement>(
      'input[id*="Name" i], input[name*="Name" i], input[placeholder*="姓名"]'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到姓名输入框');
    }

    // 2. 手机号
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input[id*="Mobile" i], input[name*="Mobile" i], input[id*="phone" i], input[placeholder*="手机"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    } else {
      logSkip('手机号', 'basics.phone', '未找到手机输入框');
    }

    // 3. 邮箱
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[id*="Email" i], input[name*="Email" i], input[id*="mail" i], input[placeholder*="邮箱"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    } else {
      logSkip('电子邮箱', 'basics.email', '未找到邮箱输入框');
    }

    // 4. 身份证号
    const idCardInput = document.querySelector<HTMLInputElement>(
      'input[id*="IdCard" i], input[id*="CertNo" i], input[name*="IdCard" i], input[placeholder*="身份证"]'
    );
    if (idCardInput && resume.basics.idCardNumber) {
      setNativeValue(idCardInput, resume.basics.idCardNumber);
      logSuccess('身份证号', 'basics.idCardNumber', resume.basics.idCardNumber);
    }

    // 5. 性别
    const genderLabels = Array.from(document.querySelectorAll<HTMLElement>('.beisen-radio, [class*="gender"] label, .el-radio'));
    if (genderLabels.length > 0 && resume.basics.gender) {
      const targetGender = resume.basics.gender;
      const matched = genderLabels.find((l) => l.textContent?.includes(targetGender));
      if (matched) {
        const radio = matched.querySelector<HTMLInputElement>('input[type="radio"]');
        if (radio) setNativeRadioChecked(radio, true);
        else matched.click();
        logSuccess('性别', 'basics.gender', targetGender);
      }
    }

    // 6. 出生年月
    const birthInput = document.querySelector<HTMLInputElement>(
      'input[id*="Birth" i], input[name*="Birth" i], input[placeholder*="出生"]'
    );
    if (birthInput && resume.basics.birthDate) {
      await fillDatePicker(birthInput, resume.basics.birthDate);
      logSuccess('出生年月', 'basics.birthDate', resume.basics.birthDate);
    }

    // 7. 政治面貌下拉
    const polDropdown = document.querySelector<HTMLElement>(
      '[id*="Political" i], [class*="political" i], [placeholder*="政治面貌"]'
    );
    if (polDropdown && resume.basics.politicalStatus) {
      await selectCustomOption(polDropdown, resume.basics.politicalStatus);
      logSuccess('政治面貌', 'basics.politicalStatus', resume.basics.politicalStatus);
    }

    // 8. 籍贯 / 居住城市
    const nativeInput = document.querySelector<HTMLElement>('[id*="Native" i], [class*="native" i], [placeholder*="籍贯"]');
    if (nativeInput && resume.basics.nativePlace?.city) {
      await selectCascaderOptions(nativeInput, resume.basics.nativePlace.city);
      logSuccess('籍贯', 'basics.nativePlace.city', resume.basics.nativePlace.city);
    }

    // 9. 多段教育经历回填
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(document.querySelectorAll<HTMLElement>('.italent-education, [class*="education-item"], [class*="edu-item"], [class*="education"] .form-item-group'));

      for (let i = 0; i < resume.educations.length; i++) {
        const edu = resume.educations[i];
        const card = eduCards[i] || document;
        const prefix = `educations.${i}`;

        const schoolInput = card.querySelector<HTMLInputElement>(
          'input[id*="School" i], input[name*="School" i], input[id*="College" i], input[placeholder*="学校"]'
        );
        if (schoolInput && edu.schoolName) {
          setNativeValue(schoolInput, edu.schoolName);
          logSuccess(`学校名称(${i + 1})`, `${prefix}.schoolName`, edu.schoolName);
        }

        const majorInput = card.querySelector<HTMLInputElement>(
          'input[id*="Major" i], input[name*="Major" i], input[placeholder*="专业"]'
        );
        if (majorInput && edu.major) {
          setNativeValue(majorInput, edu.major);
          logSuccess(`专业名称(${i + 1})`, `${prefix}.major`, edu.major);
        }

        const degreeSelect = card.querySelector<HTMLElement>('[id*="Degree" i], [class*="degree" i], [placeholder*="学历"]');
        if (degreeSelect && edu.degree) {
          await selectCustomOption(degreeSelect, edu.degree);
          logSuccess(`学历(${i + 1})`, `${prefix}.degree`, edu.degree);
        }
      }
    }

    // 10. 多段工作实习经历回填
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(document.querySelectorAll<HTMLElement>('.italent-work, [class*="work-item"], [class*="experience-item"]'));

      for (let i = 0; i < resume.experiences.length; i++) {
        const exp = resume.experiences[i];
        const card = expCards[i] || document;
        const prefix = `experiences.${i}`;

        const compInput = card.querySelector<HTMLInputElement>('input[placeholder*="公司"], input[id*="Company" i], input[name*="Company" i]');
        if (compInput && exp.company) {
          setNativeValue(compInput, exp.company);
          logSuccess(`公司名称(${i + 1})`, `${prefix}.company`, exp.company);
        }

        const titleInput = card.querySelector<HTMLInputElement>('input[placeholder*="职位"], input[id*="Title" i], input[id*="Job" i]');
        if (titleInput && exp.title) {
          setNativeValue(titleInput, exp.title);
          logSuccess(`职务名称(${i + 1})`, `${prefix}.title`, exp.title);
        }

        const descTextarea = card.querySelector<HTMLTextAreaElement>('textarea[placeholder*="工作描述"], textarea[placeholder*="职责"]');
        if (descTextarea && exp.description) {
          setNativeValue(descTextarea, exp.description);
          logSuccess(`工作内容(${i + 1})`, `${prefix}.description`, exp.description);
        }
      }
    }

    // 11. 自我评价
    const evalTextarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[id*="Eval" i], textarea[placeholder*="自我评价"], textarea[placeholder*="介绍"]'
    );
    if (evalTextarea && resume.basics.selfEvaluation) {
      setNativeValue(evalTextarea, resume.basics.selfEvaluation);
      logSuccess('自我评价', 'basics.selfEvaluation', resume.basics.selfEvaluation);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '北森招聘系统适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};

