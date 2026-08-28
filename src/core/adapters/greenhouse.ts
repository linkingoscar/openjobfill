import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue } from '../engine/dispatcher';
import { sleep } from '../../utils/dom';

export const greenhouseAdapter: SiteAdapter = {
  id: 'greenhouse-adapter',
  name: 'Greenhouse & Lever 外企招聘系统',
  description: '适配欧美外企及出海独角兽常用的 Greenhouse 与 Lever 招聘网申系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('greenhouse.io') ||
      url.includes('lever.co') ||
      !!document.querySelector('#application_form, .application-form, #lever-form')
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

    // 1. First Name & Last Name (Greenhouse / Lever)
    const nameInput = document.querySelector<HTMLInputElement>(
      'input[name="name"], input#first_name, input[name*="first_name"], input[aria-label*="Full name"]'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    }

    // 2. Email
    const emailInput = document.querySelector<HTMLInputElement>(
      'input#email, input[name="email"], input[type="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    }

    // 3. Phone
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input#phone, input[name="phone"], input[type="tel"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    }

    // 4. LinkedIn & GitHub
    const linkedinInput = document.querySelector<HTMLInputElement>(
      'input[name*="linkedin"], input[name*="urls[LinkedIn]"], input[placeholder*="LinkedIn"]'
    );
    if (linkedinInput && resume.basics.linkedinUrl) {
      setNativeValue(linkedinInput, resume.basics.linkedinUrl);
      logSuccess('LinkedIn', 'basics.linkedinUrl', resume.basics.linkedinUrl);
    }

    const githubInput = document.querySelector<HTMLInputElement>(
      'input[name*="github"], input[name*="urls[GitHub]"], input[placeholder*="GitHub"]'
    );
    if (githubInput && resume.basics.githubUrl) {
      setNativeValue(githubInput, resume.basics.githubUrl);
      logSuccess('GitHub', 'basics.githubUrl', resume.basics.githubUrl);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: 'Greenhouse & Lever 适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
