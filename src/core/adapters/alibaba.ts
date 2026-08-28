import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { sleep } from '../../utils/dom';

export const alibabaAdapter: SiteAdapter = {
  id: 'alibaba-adapter',
  name: '阿里巴巴 / 淘天招聘官网',
  description: '适配阿里巴巴集团与淘天招聘在线网申简历系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('talent.alibaba.com') ||
      url.includes('talent.taotao.com') ||
      url.includes('job.alibaba.com') ||
      !!document.querySelector('.ali-apply, [class*="alibaba-"]')
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
      'input[placeholder*="姓名"], input[aria-label*="姓名"], input[name*="name"]'
    );
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到输入框');
    }

    // 2. 手机号
    const phoneInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="手机"], input[aria-label*="手机"], input[type="tel"]'
    );
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    }

    // 3. 邮箱
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="邮箱"], input[aria-label*="邮箱"], input[type="email"]'
    );
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    }

    // 4. 最高学历
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];
      const schoolInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="学校"], input[aria-label*="学校"]'
      );
      if (schoolInput && edu.schoolName) {
        setNativeValue(schoolInput, edu.schoolName);
        logSuccess('学校名称', 'educations.0.schoolName', edu.schoolName);
      }

      const majorInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="专业"], input[aria-label*="专业"]'
      );
      if (majorInput && edu.major) {
        setNativeValue(majorInput, edu.major);
        logSuccess('专业名称', 'educations.0.major', edu.major);
      }
    }

    // 5. 个人总结
    const summaryInput = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="总结"], textarea[placeholder*="评价"]'
    );
    if (summaryInput && resume.basics.selfEvaluation) {
      setNativeValue(summaryInput, resume.basics.selfEvaluation);
      logSuccess('个人总结', 'basics.selfEvaluation', resume.basics.selfEvaluation);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '阿里巴巴招聘官网适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
