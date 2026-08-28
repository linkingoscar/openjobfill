import type { SiteAdapter, FillResult, FillLogItem } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue, setNativeRadioChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep, getAllFormElementsAcrossIframes } from '../../utils/dom';

export const dayeeAdapter: SiteAdapter = {
  id: 'dayee-adapter',
  name: '用友大易招聘系统 (Dayee)',
  description: '全量适配采用用友大易 ATS 系统的国企、央企、银行及大型制造业招聘门户 (含 Iframe 嵌套穿透)',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('dayee.com') ||
      url.includes('wintalent.cn') ||
      url.includes('yonyou.com') ||
      !!document.querySelector('[id*="dayee"], [class*="dayee"], #resumeFrame')
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

    // 获取包含同源 Iframe 的所有可见输入框
    const allInputs = getAllFormElementsAcrossIframes();

    const findInput = (keywords: string[]): HTMLElement | null => {
      for (const el of allInputs) {
        const id = (el.id || '').toLowerCase();
        const name = (el.getAttribute('name') || '').toLowerCase();
        const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
        const label = (el.parentElement?.textContent || '').toLowerCase();

        if (keywords.some(k => id.includes(k) || name.includes(k) || placeholder.includes(k) || label.includes(k))) {
          return el;
        }
      }
      return null;
    };

    // 1. 姓名
    const nameInput = findInput(['name', 'candidate', '姓名']) as HTMLInputElement;
    if (nameInput && resume.basics.name) {
      setNativeValue(nameInput, resume.basics.name);
      logSuccess('姓名', 'basics.name', resume.basics.name);
    } else {
      logSkip('姓名', 'basics.name', '未找到输入框');
    }

    // 2. 手机号
    const phoneInput = findInput(['mobile', 'phone', '手机']) as HTMLInputElement;
    if (phoneInput && resume.basics.phone) {
      setNativeValue(phoneInput, resume.basics.phone);
      logSuccess('手机号', 'basics.phone', resume.basics.phone);
    } else {
      logSkip('手机号', 'basics.phone', '未找到输入框');
    }

    // 3. 邮箱
    const emailInput = findInput(['email', 'mail', '邮箱']) as HTMLInputElement;
    if (emailInput && resume.basics.email) {
      setNativeValue(emailInput, resume.basics.email);
      logSuccess('电子邮箱', 'basics.email', resume.basics.email);
    } else {
      logSkip('电子邮箱', 'basics.email', '未找到输入框');
    }

    // 4. 证件号 / 身份证
    const idInput = findInput(['idcard', 'certno', '身份证', '证件号']) as HTMLInputElement;
    if (idInput && resume.basics.idCardNumber) {
      setNativeValue(idInput, resume.basics.idCardNumber);
      logSuccess('身份证号', 'basics.idCardNumber', resume.basics.idCardNumber);
    }

    // 5. 性别
    const genderLabels = Array.from(document.querySelectorAll<HTMLElement>('label, .dayee-radio, .el-radio'));
    if (genderLabels.length > 0 && resume.basics.gender) {
      const matched = genderLabels.find((l) => l.textContent?.includes(resume.basics.gender));
      if (matched) {
        const radio = matched.querySelector<HTMLInputElement>('input[type="radio"]');
        if (radio) setNativeRadioChecked(radio, true);
        else matched.click();
        logSuccess('性别', 'basics.gender', resume.basics.gender);
      }
    }

    // 6. 出生年月
    const birthInput = findInput(['birth', '出生', '生日']) as HTMLInputElement;
    if (birthInput && resume.basics.birthDate) {
      await fillDatePicker(birthInput, resume.basics.birthDate);
      logSuccess('出生年月', 'basics.birthDate', resume.basics.birthDate);
    }

    // 7. 政治面貌
    const polDropdown = findInput(['political', 'party', '政治面貌']);
    if (polDropdown && resume.basics.politicalStatus) {
      await selectCustomOption(polDropdown, resume.basics.politicalStatus);
      logSuccess('政治面貌', 'basics.politicalStatus', resume.basics.politicalStatus);
    }

    // 8. 籍贯 / 户籍
    const nativeEl = findInput(['native', '籍贯', '生源']);
    if (nativeEl && resume.basics.nativePlace?.city) {
      await selectCascaderOptions(nativeEl, resume.basics.nativePlace.city);
      logSuccess('籍贯', 'basics.nativePlace.city', resume.basics.nativePlace.city);
    }

    // 9. 最高教育经历
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];
      const schoolInput = findInput(['school', 'college', '学校', '毕业院校']) as HTMLInputElement;
      if (schoolInput && edu.schoolName) {
        setNativeValue(schoolInput, edu.schoolName);
        logSuccess('毕业学校', 'educations.0.schoolName', edu.schoolName);
      }

      const majorInput = findInput(['major', '专业']) as HTMLInputElement;
      if (majorInput && edu.major) {
        setNativeValue(majorInput, edu.major);
        logSuccess('所学专业', 'educations.0.major', edu.major);
      }

      const degreeDropdown = findInput(['degree', '学历', '学位']);
      if (degreeDropdown && edu.degree) {
        await selectCustomOption(degreeDropdown, edu.degree);
        logSuccess('学历学位', 'educations.0.degree', edu.degree);
      }
    }

    // 10. 紧急联系人 / 家庭信息
    if (resume.familyMembers && resume.familyMembers.length > 0) {
      const fm = resume.familyMembers[0];
      const fmNameInput = findInput(['emergency', 'contact', '紧急联系人', '家属姓名']) as HTMLInputElement;
      if (fmNameInput && fm.name) {
        setNativeValue(fmNameInput, fm.name);
        logSuccess('紧急联系人', 'familyMembers.0.name', fm.name);
      }
    }

    // 11. 自我评价
    const evalTextarea = findInput(['evaluation', 'self', '评价', '自我介绍']) as HTMLTextAreaElement;
    if (evalTextarea && resume.basics.selfEvaluation) {
      setNativeValue(evalTextarea, resume.basics.selfEvaluation);
      logSuccess('自我评价', 'basics.selfEvaluation', resume.basics.selfEvaluation);
    }

    await sleep(200);

    return {
      success: filledCount > 0,
      adapterName: '用友大易招聘系统适配器',
      filledCount,
      skippedCount,
      failedCount,
      logs,
      durationMs: Date.now() - startTime,
    };
  },
};
