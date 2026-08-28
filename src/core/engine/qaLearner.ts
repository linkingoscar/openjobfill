import { resumeStorage } from '../storage/resumeStorage';
import type { StandardResume } from '../../types/resume';
import { isRecruitmentPage } from '../whitelist';

const BANNER_ID = 'openjobfill-qa-learner-banner';

function getFieldLabel(input: HTMLElement): string {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    if (input.placeholder && input.placeholder.length < 20) {
      return input.placeholder.replace(/^(请输入|请选择)/, '').replace(/[:：*]/g, '').trim();
    }
  }

  // 1. 查找关联的 label 标签
  if (input.id) {
    const labelEl = document.querySelector(`label[for="${input.id}"]`);
    if (labelEl && labelEl.textContent) {
      return labelEl.textContent.replace(/[:：*]/g, '').trim();
    }
  }

  // 2. 向上查找最近的表单项容器
  const parentContainer = input.closest('.form-item, .el-form-item, .ant-form-item, .semi-form-field, tr, .field-wrapper, .item');
  if (parentContainer) {
    const label = parentContainer.querySelector('label, .label, .title, .ant-form-item-label, th');
    if (label && label.textContent) {
      const text = label.textContent.replace(/[:：*]/g, '').trim();
      if (text.length < 25) return text;
    }
  }

  // 3. 查找前一个兄弟文本
  const prev = input.previousElementSibling;
  if (prev && prev.textContent && prev.textContent.length < 20) {
    return prev.textContent.replace(/[:：*]/g, '').trim();
  }

  return input.getAttribute('name') || input.getAttribute('aria-label') || '自定义问答';
}

/**
 * 弹出学习记忆悬浮通知浮条
 */
function showLearnerBanner(
  keyword: string, 
  answer: string, 
  onSave: () => void,
  onDismiss: () => void
) {
  // 移除旧 Banner
  const old = document.getElementById(BANNER_ID);
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 24px;
    z-index: 2147483647;
    background: #1e293b;
    color: #fff;
    padding: 10px 14px;
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 420px;
    animation: openjobfill-slide-in 0.3s ease-out;
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;

  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
      <span style="font-size:16px;">💡</span>
      <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        <span style="color:#94a3b8;">检测到新填写：</span>
        <strong style="color:#60a5fa;">【${keyword}】</strong>
        <span style="color:#e2e8f0;">= "${answer.slice(0, 15)}${answer.length > 15 ? '...' : ''}"</span>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
      <button id="openjobfill-btn-remember" style="background:#2563eb; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; transition:background 0.2s;">
        一键记住
      </button>
      <button id="openjobfill-btn-ignore" style="background:transparent; color:#94a3b8; border:none; padding:4px 6px; font-size:12px; cursor:pointer;">
        ✕
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  const rememberBtn = banner.querySelector('#openjobfill-btn-remember');
  const ignoreBtn = banner.querySelector('#openjobfill-btn-ignore');

  let autoDismissTimer: any = setTimeout(() => {
    banner.remove();
    onDismiss();
  }, 10000);

  rememberBtn?.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    banner.remove();
    onSave();
  });

  ignoreBtn?.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    banner.remove();
    onDismiss();
  });
}

/**
 * 启动全局智能问答主动学习监听器 (仅在招聘相关页面且扩展上下文有效时运行)
 */
export function initSmartQALearner() {
  const learnedKeysThisSession = new Set<string>();

  document.addEventListener('change', async (e: Event) => {
    // 扩展上下文失效或非招聘网页时立即退出，杜绝误伤与上下文报错
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    if (!isRecruitmentPage(window.location.href)) return;

    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    // 忽略密码框、隐藏输入框、文件上传
    if (target instanceof HTMLInputElement && ['password', 'hidden', 'file', 'checkbox', 'radio'].includes(target.type)) {
      return;
    }

    const value = target.value.trim();
    if (!value || value.length < 2) return;

    // 提取字段 Label 问答关键词
    const label = getFieldLabel(target);
    if (!label || label.length < 2 || label.length > 30) return;

    // 如果本会话已经提示过该问答，避免重复打扰
    if (learnedKeysThisSession.has(label)) return;

    try {
      const resume = await resumeStorage.getActiveResume();
      if (!resume) return;

      // 检查是否已经在已有问答库中
      const existingQA = resume.qaBank?.find(qa => qa.keyword === label || label.includes(qa.keyword));
      if (existingQA) return;

      // 检查是否属于基础核心字段（如姓名、电话等），避免将基本信息误存为通用问答
      const basicsKeys = ['姓名', '手机', '电话', '邮箱', '身份证', '性别', '学校', '专业'];
      if (basicsKeys.some(k => label.includes(k))) return;

      learnedKeysThisSession.add(label);

      showLearnerBanner(
        label,
        value,
        async () => {
          if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
          if (!resume.qaBank) resume.qaBank = [];
          resume.qaBank.push({
            id: `qa-${Date.now()}`,
            keyword: label,
            answer: value
          });
          await resumeStorage.saveResume(resume);
          console.log(`[OpenJobFill] 智能学习已存入问答库: 【${label}】 -> ${value}`);
        },
        () => {}
      );
    } catch {
      // 忽略任何上下文关闭异常
    }
  }, true);
}
