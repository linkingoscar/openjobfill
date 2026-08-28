import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { sleep } from '../../utils/dom';

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

    // 1. 姓名
    const nameInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="姓名"], input[name="name"], .name-item input'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到输入框');
    }

    // 2. 手机号
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="手机"], input[name="phone"], input[type="tel"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    }

    // 3. 邮箱
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="邮箱"], input[name="email"], input[type="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    }

    // 4. 最高学历学校与专业
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];
      const schoolInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="学校"], input[name="school"]'
      );
      if (schoolInput && edu.schoolName) {
        setNativeValue(schoolInput, edu.schoolName);
        logSuccess('学校名称', 'educations.0.schoolName', edu.schoolName);
      }

      const majorInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="专业"], input[name="major"]'
      );
      if (majorInput && edu.major) {
        setNativeValue(majorInput, edu.major);
        logSuccess('专业名称', 'educations.0.major', edu.major);
      }

      const degreeDropdown = document.querySelector<HTMLElement>(
        '.degree-select, [placeholder*="学历"]'
      );
      if (degreeDropdown && edu.degree) {
        await selectCustomOption(degreeDropdown, edu.degree);
        logSuccess('学历层次', 'educations.0.degree', edu.degree);
      }
    }

    // 5. GitHub 与 个人主页
    const githubInput = document.querySelector<HTMLInputElement>('input[placeholder*="GitHub"], input[name*="github"]');
    if (githubInput && resume.basics.githubUrl) {
      setNativeValue(githubInput, resume.basics.githubUrl);
      logSuccess('GitHub', 'basics.githubUrl', resume.basics.githubUrl);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '牛客招聘系统适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
