import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { setNativeValue } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { fillDatePicker } from '../engine/datepicker';
import { autoExpandHeuristicSections } from '../engine/repeater';
import { sleep, getAllFormElementsAcrossIframes } from '../../utils/dom';
import { createFillSession, isIdentityExcluded, type FieldQueryOptions } from './adapterKit';

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
    const s = createFillSession('用友大易招聘系统适配器');

    // 0. 自动增行
    if (resume.educations && resume.educations.length > 1) {
      await autoExpandHeuristicSections(['教育', '学历'], resume.educations.length);
    }
    if (resume.experiences && resume.experiences.length > 1) {
      await autoExpandHeuristicSections(['工作', '实习'], resume.experiences.length);
    }

    // 大易大量页面把表单嵌在同源 Iframe 中，必须遍历跨帧元素集合而非主文档选择器
    const allInputs = getAllFormElementsAcrossIframes();

    const makeFinder = (options: FieldQueryOptions = {}) => {
      return (keywords: string[]): HTMLElement | null => {
        for (const el of allInputs) {
          // 身份排斥过滤（紧急联系人等第三方字段需显式豁免）
          if (isIdentityExcluded(el, options)) continue;

          const id = (el.id || '').toLowerCase();
          const name = (el.getAttribute('name') || '').toLowerCase();
          const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
          const label = (el.parentElement?.textContent || '').toLowerCase();

          if (keywords.some((k) => id.includes(k) || name.includes(k) || placeholder.includes(k) || label.includes(k))) {
            return el;
          }
        }
        return null;
      };
    };

    const findInput = makeFinder();
    // 用于定位本就属于第三方的控件（紧急联系人 / 家属），必须豁免身份排斥
    const findThirdParty = makeFinder({ allowIdentityTerms: true });

    const writeText = (el: Element, value: string) => {
      setNativeValue(el as HTMLInputElement, value);
      return true;
    };

    const writeTextarea = (el: Element, value: string) => {
      setNativeValue(el as HTMLTextAreaElement, value);
      return true;
    };

    // 1. 基础身份信息
    await s.apply(findInput(['name', 'candidate', '姓名']), '姓名', 'basics.name', resume.basics.name, writeText);

    await s.apply(findInput(['mobile', 'phone', '手机']), '手机号', 'basics.phone', resume.basics.phone, writeText);

    await s.apply(findInput(['email', 'mail', '邮箱']), '电子邮箱', 'basics.email', resume.basics.email, writeText);

    await s.apply(findInput(['idcard', 'certno', '身份证', '证件号']), '身份证号', 'basics.idCardNumber', resume.basics.idCardNumber, writeText);

    // 2. 性别单选
    await s.radioByText(
      document,
      ['.dayee-radio', '.el-radio', '[class*="gender"] label'],
      '性别',
      'basics.gender',
      resume.basics.gender
    );

    // 3. 日期与下拉
    await s.apply(
      findInput(['birth', '出生', '生日']),
      '出生年月',
      'basics.birthDate',
      resume.basics.birthDate,
      async (el, value) => {
        await fillDatePicker(el as HTMLInputElement, value);
        return true;
      }
    );

    await s.apply(
      findInput(['political', 'party', '政治面貌']),
      '政治面貌',
      'basics.politicalStatus',
      resume.basics.politicalStatus,
      (el, value) => selectCustomOption(el as HTMLElement, value)
    );

    await s.apply(
      findInput(['native', '籍贯', '生源']),
      '籍贯',
      'basics.nativePlace.city',
      resume.basics.nativePlace?.city,
      (el, value) => selectCascaderOptions(el as HTMLElement, value)
    );

    // 4. 最高教育经历
    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.apply(findInput(['school', 'college', '学校', '毕业院校']), '毕业学校', 'educations.0.schoolName', edu.schoolName, writeText);

      await s.apply(findInput(['major', '专业']), '所学专业', 'educations.0.major', edu.major, writeText);

      await s.apply(
        findInput(['degree', '学历', '学位']),
        '学历学位',
        'educations.0.degree',
        edu.degree,
        (el, value) => selectCustomOption(el as HTMLElement, value)
      );
    }

    // 5. 第三方联系人信息（豁免身份排斥，这类字段本就属于他人）
    if (resume.familyMembers && resume.familyMembers.length > 0) {
      const fm = resume.familyMembers[0];

      await s.apply(
        findThirdParty(['emergency', 'contact', '紧急联系人', '家属姓名']),
        '紧急联系人',
        'familyMembers.0.name',
        fm.name,
        writeText
      );
    }

    // 6. 自我评价
    await s.apply(
      findInput(['evaluation', 'self', '评价', '自我介绍']),
      '自我评价',
      'basics.selfEvaluation',
      resume.basics.selfEvaluation,
      writeTextarea
    );

    await sleep(200);

    return s.finish();
  },
};
