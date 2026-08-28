import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { sleep } from '../../utils/dom';

export const workdayAdapter: SiteAdapter = {
  id: 'workday-adapter',
  name: 'Workday 招聘系统',
  description: '适配外企与跨国企业广泛使用的 Workday 网申系统 (myworkdayjobs)',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('myworkdayjobs.com') ||
      url.includes('workday.com') ||
      !!document.querySelector('[data-automation-id]')
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

    // Workday 常用 data-automation-id 映射
    // 1. Legal Name / First Name & Last Name
    const legalNameInput = document.querySelector<HTMLInputElement>(
      'input[data-automation-id="legalNameSection_firstName"], input[data-automation-id*="firstName"]'
    );
    if (legalNameInput && resume.basics.name) {
      setNativeValue(legalNameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    }

    // 2. Phone
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input[data-automation-id="phone-number"], input[data-automation-id*="phone"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    }

    // 3. Email
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[data-automation-id="email"], input[data-automation-id*="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    }

    // 4. Address / City
    const cityInput = document.querySelector<HTMLInputElement>(
      'input[data-automation-id="addressSection_city"], input[data-automation-id*="city"]'
    );
    if (cityInput && resume.basics.currentLocation?.city) {
      setNativeValue(cityInput, resume.basics.currentLocation.city);
      logSuccess('居住城市', 'basics.currentLocation.city', resume.basics.currentLocation.city);
    }

    // 5. School
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];
      const schoolInput = document.querySelector<HTMLInputElement>(
        'input[data-automation-id="school"], input[data-automation-id*="school"]'
      );
      if (schoolInput && edu.schoolName) {
        setNativeValue(schoolInput, edu.schoolName);
        logSuccess('学校名称', 'educations.0.schoolName', edu.schoolName);
      }
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: 'Workday 招聘系统适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
