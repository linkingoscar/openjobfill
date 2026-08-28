import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { sleep } from '../../utils/dom';

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
      'input[placeholder*="姓名"], input[name="name"], .name input'
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

    // 4. 最高学历
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];
      const schoolInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="学校"], input[name*="school"]'
      );
      if (schoolInput && edu.schoolName) {
        setNativeValue(schoolInput, edu.schoolName);
        logSuccess('学校名称', 'educations.0.schoolName', edu.schoolName);
      }

      const majorInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="专业"], input[name*="major"]'
      );
      if (majorInput && edu.major) {
        setNativeValue(majorInput, edu.major);
        logSuccess('专业名称', 'educations.0.major', edu.major);
      }
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '美团招聘官网适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
