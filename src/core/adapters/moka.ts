import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep } from '../../utils/dom';

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

    // 1. 姓名
    const nameInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="姓名"], input[name*="name"], input[name*="candidateName"], .moka-name-input input'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到输入框');
    }

    // 2. 手机号
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="手机"], input[name*="phone"], input[name*="mobile"], input[type="tel"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    } else {
      logSkip('手机号', 'basics.phone', '未找到输入框');
    }

    // 3. 邮箱
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="邮箱"], input[placeholder*="Email"], input[name*="email"], input[type="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    } else {
      logSkip('电子邮箱', 'basics.email', '未找到输入框');
    }

    // 4. 性别
    const genderLabels = Array.from(
      document.querySelectorAll<HTMLElement>('.moka-radio-group label, [class*="gender"] label, .el-radio')
    );
    if (genderLabels.length > 0 && resume.basics.gender) {
      const targetGender = resume.basics.gender;
      const target = genderLabels.find((l) => l.textContent?.includes(targetGender));
      if (target) {
        const radio = target.querySelector<HTMLInputElement>('input[type="radio"]');
        if (radio) setNativeRadioChecked(radio, true);
        else target.click();
        logSuccess('性别', 'basics.gender', targetGender);
      }
    }

    // 5. 身份证号
    const idCardInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="身份证"], input[placeholder*="证件号码"], input[name*="idCard"], input[name*="idcard"]'
    );
    if (idCardInput && resume.basics.idCardNumber) {
      setNativeValue(idCardInput, resume.basics.idCardNumber);
      logSuccess('身份证号', 'basics.idCardNumber', resume.basics.idCardNumber);
    }

    // 6. 出生日期 / 生日
    const birthInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="出生"], input[placeholder*="生日"], [class*="birthday"] input'
    );
    if (birthInput && resume.basics.birthDate) {
      await fillDatePicker(birthInput, resume.basics.birthDate);
      logSuccess('出生日期', 'basics.birthDate', resume.basics.birthDate);
    }

    // 7. 现居城市 / 期望城市
    const cityInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="居住地"], input[placeholder*="现居城市"], input[name*="city"], [class*="city"] input'
    );
    if (cityInput && resume.basics.currentLocation?.city) {
      setNativeValue(cityInput, resume.basics.currentLocation.city);
      logSuccess('现居城市', 'basics.currentLocation.city', resume.basics.currentLocation.city);
    }

    // 8. 社交与主页
    const githubInput = document.querySelector<HTMLInputElement>('input[placeholder*="github" i], input[name*="github" i]');
    if (githubInput && resume.basics.githubUrl) {
      setNativeValue(githubInput, resume.basics.githubUrl);
      logSuccess('GitHub', 'basics.githubUrl', resume.basics.githubUrl);
    }

    // 9. 多段教育经历
    if (resume.educations && resume.educations.length > 0) {
      const eduCards = Array.from(document.querySelectorAll<HTMLElement>('.moka-education-item, [class*="education-item"], [class*="edu-item"], [class*="educationCard"]'));
      
      for (let i = 0; i < resume.educations.length; i++) {
        const edu = resume.educations[i];
        const card = eduCards[i] || document;
        const prefix = `educations.${i}`;

        const schoolInput = card.querySelector<HTMLInputElement>('input[placeholder*="学校"], input[name*="school"], [class*="school"] input');
        if (schoolInput && edu.schoolName) {
          setNativeValue(schoolInput, edu.schoolName);
          logSuccess(`毕业院校(${i + 1})`, `${prefix}.schoolName`, edu.schoolName);
        }

        const majorInput = card.querySelector<HTMLInputElement>('input[placeholder*="专业"], input[name*="major"], [class*="major"] input');
        if (majorInput && edu.major) {
          setNativeValue(majorInput, edu.major);
          logSuccess(`专业名称(${i + 1})`, `${prefix}.major`, edu.major);
        }

        const degreeDropdown = card.querySelector<HTMLElement>('[class*="degree"] .el-select, [class*="degree"] .moka-select, [placeholder*="学历"]');
        if (degreeDropdown && edu.degree) {
          await selectCustomOption(degreeDropdown, edu.degree);
          logSuccess(`学历学位(${i + 1})`, `${prefix}.degree`, edu.degree);
        }

        const gpaInput = card.querySelector<HTMLInputElement>('input[placeholder*="GPA"], input[placeholder*="绩点"]');
        if (gpaInput && edu.gpa) {
          setNativeValue(gpaInput, edu.gpa);
          logSuccess(`GPA(${i + 1})`, `${prefix}.gpa`, edu.gpa);
        }
      }
    }

    // 10. 多段工作/实习经历
    if (resume.experiences && resume.experiences.length > 0) {
      const expCards = Array.from(document.querySelectorAll<HTMLElement>('.moka-experience-item, [class*="experience-item"], [class*="work-item"]'));
      
      for (let i = 0; i < resume.experiences.length; i++) {
        const exp = resume.experiences[i];
        const card = expCards[i] || document;
        const prefix = `experiences.${i}`;

        const compInput = card.querySelector<HTMLInputElement>('input[placeholder*="公司"], input[placeholder*="单位"], input[name*="company"]');
        if (compInput && exp.company) {
          setNativeValue(compInput, exp.company);
          logSuccess(`公司名称(${i + 1})`, `${prefix}.company`, exp.company);
        }

        const titleInput = card.querySelector<HTMLInputElement>('input[placeholder*="职位"], input[placeholder*="岗位"], input[name*="title"]');
        if (titleInput && exp.title) {
          setNativeValue(titleInput, exp.title);
          logSuccess(`岗位职位(${i + 1})`, `${prefix}.title`, exp.title);
        }

        const descTextarea = card.querySelector<HTMLTextAreaElement>('textarea[placeholder*="工作描述"], textarea[placeholder*="职责"], textarea[name*="desc"]');
        if (descTextarea && exp.description) {
          setNativeValue(descTextarea, exp.description);
          logSuccess(`工作内容(${i + 1})`, `${prefix}.description`, exp.description);
        }
      }
    }

    // 11. 自我评价
    const selfEvalTextarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="评价"], textarea[placeholder*="介绍"], textarea[name*="self"]'
    );
    if (selfEvalTextarea && resume.basics.selfEvaluation) {
      setNativeValue(selfEvalTextarea, resume.basics.selfEvaluation);
      logSuccess('自我评价', 'basics.selfEvaluation', resume.basics.selfEvaluation);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: 'Moka 招聘系统适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};

