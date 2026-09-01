import { resumeStorage } from '../storage/resumeStorage';
import type { StandardResume } from '../../types/resume';
import { isRecruitmentPage } from '../whitelist';
import { isAutofillTouched } from './dispatcher';
import { isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';

const BANNER_ID = 'openjobfill-qa-learner-banner';

/**
 * 提取表单控件的题目标题 (Label)，严禁将 Radio/Checkbox 自身的选项文字当成题干
 */
function getFieldLabel(input: HTMLElement): string {
  // 如果是 Radio / Checkbox，优先查找外层 fieldset 或 form-item 标题
  if (isInputElement(input) && (input.type === 'radio' || input.type === 'checkbox')) {
    const parentContainer = input.closest('fieldset, .form-item, .el-form-item, .ant-form-item, .semi-form-field, .radio-group, .checkbox-group, [class*="group"], [class*="question"]');
    if (parentContainer) {
      // 1. 优先查找 legend
      const legend = parentContainer.querySelector('legend');
      if (legend && legend.textContent) {
        const text = legend.textContent.replace(/[:：*]/g, '').trim();
        if (text.length >= 2 && text.length <= 40) return text;
      }

      // 2. 查找结构化标题 (严格排除包裹当前 input 本身的 option label)
      const labelEls = Array.from(
        parentContainer.querySelectorAll(
          '.ant-form-item-label, .el-form-item__label, [class*="form-item-label"], [class*="item-label"], [class*="question-title"], [class*="item-title"], label'
        )
      );
      for (const lbl of labelEls) {
        if (lbl.contains(input)) continue; // 关键：排除包含 input 的选项 label (如“是/否”)
        const text = (lbl.textContent || '').replace(/[:：*]/g, '').trim();
        if (text.length >= 2 && text.length <= 40) return text;
      }
    }
  }

  if (isInputElement(input) || isTextAreaElement(input)) {
    if (input.placeholder && input.placeholder.length < 20) {
      return input.placeholder.replace(/^(请输入|请选择)/, '').replace(/[:：*]/g, '').trim();
    }
  }

  // 1. 查找关联的 label 标签 (排除包裹自身的 label)
  if (input.id) {
    const doc = input.ownerDocument || document;
    const labelEl = doc.querySelector(`label[for="${input.id}"]`);
    if (labelEl && labelEl.textContent && !labelEl.contains(input)) {
      return labelEl.textContent.replace(/[:：*]/g, '').trim();
    }
  }

  // 2. 向上查找最近的表单项容器
  const parentContainer = input.closest('.form-item, .el-form-item, .ant-form-item, .semi-form-field, tr, .field-wrapper, .item');
  if (parentContainer) {
    const labelEls = Array.from(parentContainer.querySelectorAll('label, .label, .title, .ant-form-item-label, th'));
    for (const lbl of labelEls) {
      if (lbl.contains(input)) continue;
      const text = (lbl.textContent || '').replace(/[:：*]/g, '').trim();
      if (text.length >= 2 && text.length < 35) return text;
    }
  }

  // 3. 查找前一个兄弟文本
  const prev = input.previousElementSibling;
  if (prev && prev.textContent && prev.textContent.length < 20) {
    return prev.textContent.replace(/[:：*]/g, '').trim();
  }

  return input.getAttribute('name') || input.getAttribute('aria-label') || '';
}

/**
 * 结构化简历档案字段映射判定 (上下文感知 + 消歧防碰撞)
 */
export function mapLabelToProfileField(
  label: string,
  contextText = '',
  sectionType = ''
): { key: string; name: string } | null {
  const clean = label.replace(/[:：*()（）[\]【】]/g, '').trim().toLowerCase();
  const cleanContext = (contextText + ' ' + sectionType).toLowerCase();

  if (/身高|height/i.test(clean)) return { key: 'basics.height', name: '身高' };
  if (/体重|weight/i.test(clean)) return { key: 'basics.weight', name: '体重' };
  if (/健康|health/i.test(clean)) return { key: 'basics.healthStatus', name: '健康状况' };
  if (/籍贯|生源/i.test(clean)) return { key: 'basics.nativePlace.detail', name: '籍贯' };
  if (/户口|户籍/i.test(clean)) return { key: 'basics.hukouLocation.detail', name: '户口所在地' };
  if (/现居|居住地|现住址/i.test(clean)) return { key: 'basics.currentLocation.detail', name: '现居住地' };

  // 消歧：入职时间 / 到岗时间
  if (/到岗|到职|可入职时间|最快入职/i.test(clean)) {
    return { key: 'basics.availableTime', name: '到岗时间' };
  }
  if (/入职时间/i.test(clean)) {
    // 若处于工作经历、实习、项目等历史模块，严禁污染 basics.availableTime
    if (
      /工作|经历|实习|项目|公司|experience|internship|project|job|employer/i.test(cleanContext) ||
      /experience|education|project/i.test(sectionType)
    ) {
      return null;
    }
    if (/求职意向|期望|基本信息|意向/i.test(cleanContext)) {
      return { key: 'basics.availableTime', name: '到岗时间' };
    }
    return null; // 无法确定上下文时拒绝盲猜
  }

  if (/婚姻|婚育/i.test(clean)) return { key: 'basics.maritalStatus', name: '婚姻状况' };
  if (/民族|ethnicity/i.test(clean)) return { key: 'basics.ethnicity', name: '民族' };
  if (/期望薪|薪资要求/i.test(clean)) return { key: 'basics.expectedSalaryMin', name: '期望薪资' };
  if (/期望城市|意向城市/i.test(clean)) return { key: 'basics.expectedCity', name: '期望城市' };
  if (/求职状态|工作状态/i.test(clean)) return { key: 'basics.jobStatus', name: '求职状态' };
  return null;
}

/**
 * 弹出安全 DOM 浮条，提供“一键记住 / 补全到档案”交互 (完全杜绝 innerHTML XSS)
 */
function showLearnerBanner(
  type: 'profile' | 'qa',
  keyword: string, 
  answer: string, 
  onSave: () => void,
  onDismiss: () => void
) {
  const old = document.getElementById(BANNER_ID);
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 24px;
    z-index: 2147483647;
    background: #0f172a;
    color: #fff;
    padding: 10px 14px;
    border-radius: 14px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 440px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    animation: openjobfill-slide-in 0.25s ease-out;
  `;

  // Icon
  const iconSpan = document.createElement('span');
  iconSpan.textContent = type === 'profile' ? '✨' : '💡';
  iconSpan.style.fontSize = '16px';
  banner.appendChild(iconSpan);

  // Content Container
  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;';

  const prefixSpan = document.createElement('span');
  prefixSpan.style.color = '#94a3b8';
  prefixSpan.textContent = type === 'profile' ? '补全档案：' : '记住问答：';
  contentDiv.appendChild(prefixSpan);

  const titleStrong = document.createElement('strong');
  titleStrong.style.color = '#60a5fa';
  titleStrong.textContent = `【${keyword}】`;
  contentDiv.appendChild(titleStrong);

  const valueSpan = document.createElement('span');
  valueSpan.style.color = '#f8fafc';
  const displayVal = answer.length > 16 ? answer.slice(0, 16) + '...' : answer;
  valueSpan.textContent = ` = "${displayVal}"`;
  contentDiv.appendChild(valueSpan);

  if (type === 'qa') {
    const scopeTag = document.createElement('span');
    scopeTag.style.cssText = 'margin-left:6px; font-size:10px; padding:1px 5px; background:rgba(59,130,246,0.2); color:#93c5fd; border-radius:4px;';
    scopeTag.textContent = '当前站点专属';
    contentDiv.appendChild(scopeTag);
  }

  banner.appendChild(contentDiv);

  // Buttons Container
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex; align-items:center; gap:6px; flex-shrink:0;';

  const rememberBtn = document.createElement('button');
  rememberBtn.style.cssText = 'background:#2563eb; color:#fff; border:none; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer; transition:background 0.2s;';
  rememberBtn.textContent = type === 'profile' ? '补全到档案' : '一键记住';
  rememberBtn.addEventListener('mouseenter', () => (rememberBtn.style.background = '#1d4ed8'));
  rememberBtn.addEventListener('mouseleave', () => (rememberBtn.style.background = '#2563eb'));

  const ignoreBtn = document.createElement('button');
  ignoreBtn.style.cssText = 'background:transparent; color:#94a3b8; border:none; padding:4px 6px; font-size:12px; cursor:pointer;';
  ignoreBtn.textContent = '✕';

  btnGroup.appendChild(rememberBtn);
  btnGroup.appendChild(ignoreBtn);
  banner.appendChild(btnGroup);

  document.body.appendChild(banner);

  let autoDismissTimer: any = setTimeout(() => {
    banner.remove();
    onDismiss();
  }, 10000);

  rememberBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    banner.remove();
    onSave();
  });

  ignoreBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    banner.remove();
    onDismiss();
  });
}

/**
 * 启动全局资料与智能问答主动学习监听器 (支持手填文本、Select、Radio 组及 Checkbox)
 */
export function initSmartQALearner(): () => void {
  const learnedKeysThisSession = new Set<string>();

  const handleChange = async (e: Event) => {
    // 扩展上下文失效时立即退出
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    
    // 门禁异步判断
    const isRecruitment = await isRecruitmentPage(window.location.href);
    if (!isRecruitment) return;

    const target = e.target;
    if (!target || typeof target !== 'object') return;
    if (isAutofillTouched(target as Element)) return;

    if (!(isInputElement(target) || isTextAreaElement(target) || isSelectElement(target))) {
      return;
    }

    // 忽略密码框与文件上传
    if (isInputElement(target) && ['password', 'hidden', 'file'].includes(target.type)) {
      return;
    }

    let value = '';
    if (isInputElement(target) && target.type === 'radio') {
      if (!target.checked) return;
      value = (target.parentElement?.textContent || target.value).replace(/[:：*]/g, '').trim();
    } else if (isInputElement(target) && target.type === 'checkbox') {
      value = target.checked ? '是' : '否';
    } else {
      value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
    }

    if (!value || value.length < 1) return;

    // 提取字段 Label
    const label = getFieldLabel(target as HTMLElement);
    if (!label || label.length < 2 || label.length > 40) return;

    if (learnedKeysThisSession.has(label)) return;

    try {
      const resume = await resumeStorage.getActiveResume();
      if (!resume) return;

      const contextText = (target as HTMLElement).closest('.form-section, .section, form, .card, .form-item')?.textContent || '';

      // 二分法：1. 优先尝试映射到 Profile 结构化字段
      const profileMatch = mapLabelToProfileField(label, contextText);
      if (profileMatch) {
        learnedKeysThisSession.add(label);
        showLearnerBanner(
          'profile',
          profileMatch.name,
          value,
          async () => {
            if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
            // 通过 background 的串行更新入口写入 Profile，避免覆盖管理页刚保存的其它字段。
            await resumeStorage.updateResumeFields(resume.id, { [profileMatch.key]: value });
            console.log(`[OpenJobFill] 资料已自动补全到简历 Profile: ${profileMatch.key} = "${value}"`);
          },
          () => {}
        );
        return;
      }

      // 二分法：2. 开放式问答归档至 QABank (默认当前域名专属)
      const currentHost = window.location.hostname || '';
      const existingQA = resume.qaBank?.find(
        (qa) => qa.keyword === label && (qa.scope !== 'domain' || qa.domain === currentHost)
      );
      if (existingQA) return;

      // 避免基础姓名、手机号等被当成开放问答
      const basicsKeys = ['姓名', '手机', '电话', '邮箱', '身份证', '性别', '学校', '专业', '验证码'];
      if (basicsKeys.some((k) => label.includes(k))) return;

      learnedKeysThisSession.add(label);

      showLearnerBanner(
        'qa',
        label,
        value,
        async () => {
          if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
          const qaItem = {
            id: `qa-${Date.now()}`,
            keyword: label,
            answer: value,
            scope: 'domain', // 默认专属当前域名
            domain: currentHost,
          } as const;
          await resumeStorage.appendResumeArrayItem(resume.id, 'qaBank', qaItem);
          console.log(`[OpenJobFill] 智能问答已存入 QA 库 (Domain: ${currentHost}): 【${label}】 -> ${value}`);
        },
        () => {}
      );
    } catch {
      // 忽略上下文关闭
    }
  };

  document.addEventListener('change', handleChange, true);

  return () => {
    document.removeEventListener('change', handleChange, true);
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
  };
}
