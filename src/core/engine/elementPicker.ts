import { getAllDocumentsAcrossIframes } from '../../utils/dom';

export interface PickedElementInfo {
  selector: string;
  tagName: string;
  label: string;
  /** 直接携带元素，避免跨文档（同源 iframe）时只靠顶层 document 查询失败。 */
  element?: HTMLElement;
  suggestedResumeKey?: string;
  previewValue?: string;
}

const OVERLAY_ID = 'openjobfill-picker-overlay';
const BANNER_ID = 'openjobfill-picker-banner';

/**
 * 推导最具唯一性且健壮的 CSS 选择器
 */
export function generateOptimalSelector(el: HTMLElement): string {
  const ownerDocument = el.ownerDocument || document;

  // 1. 如果有唯一的 ID
  if (el.id && ownerDocument.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    return `#${CSS.escape(el.id)}`;
  }

  // 2. 如果有唯一的 name 属性
  const name = el.getAttribute('name');
  if (name) {
    const sel = `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
    if (ownerDocument.querySelectorAll(sel).length === 1) {
      return sel;
    }
  }

  // 3. 如果有唯一的 placeholder 属性
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.length < 25) {
    const sel = `${el.tagName.toLowerCase()}[placeholder="${CSS.escape(placeholder)}"]`;
    if (ownerDocument.querySelectorAll(sel).length === 1) {
      return sel;
    }
  }

  // 4. 如果有唯一的 data 属性
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-') && attr.value) {
      const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (ownerDocument.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }
  }

  // 5. 向上结合父级语义类名
  const parent = el.closest('.form-item, .el-form-item, .ant-form-item, .semi-form-field, tr, [class*="form-group"]');
  if (parent) {
    const parentClass = Array.from(parent.classList).find(c => !c.includes('active') && !c.includes('focus') && !c.includes('openjobfill'));
    if (parentClass) {
      const tag = el.tagName.toLowerCase();
      const sel = `.${CSS.escape(parentClass)} ${tag}`;
      if (ownerDocument.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }
  }

  // 6. 路径回退
  const path: string[] = [];
  let curr: HTMLElement | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    let selector = curr.tagName.toLowerCase();
    if (curr.className && typeof curr.className === 'string') {
      const firstClass = curr.className.split(/\s+/).filter(c => c && !c.startsWith('openjobfill') && !c.includes(':'))[0];
      if (firstClass) {
        selector += `.${CSS.escape(firstClass)}`;
      }
    }
    path.unshift(selector);
    const combined = path.join(' > ');
    if (ownerDocument.querySelectorAll(combined).length === 1) {
      return combined;
    }
    curr = curr.parentElement;
  }

  return path.join(' > ');
}

/**
 * 智能推导最可能匹配的简历字段 Key
 */
function guessResumeKeyFromLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('姓名') || l.includes('名字') || l.includes('name')) return 'basics.name';
  if (l.includes('手机') || l.includes('电话') || l.includes('phone') || l.includes('mobile')) return 'basics.phone';
  if (l.includes('邮箱') || l.includes('email') || l.includes('mail')) return 'basics.email';
  if (l.includes('身份证') || l.includes('证件号') || l.includes('idcard')) return 'basics.idCardNumber';
  if (l.includes('性别') || l.includes('gender')) return 'basics.gender';
  if (l.includes('学校') || l.includes('毕业院校') || l.includes('school')) return 'educations.0.schoolName';
  if (l.includes('专业') || l.includes('major')) return 'educations.0.major';
  if (l.includes('学历') || l.includes('学位') || l.includes('degree')) return 'educations.0.degree';
  if (l.includes('gpa') || l.includes('成绩') || l.includes('绩点')) return 'educations.0.gpa';
  if (l.includes('公司') || l.includes('单位') || l.includes('company')) return 'experiences.0.company';
  if (l.includes('职位') || l.includes('岗位') || l.includes('title')) return 'experiences.0.title';
  if (l.includes('项目名称') || l.includes('project')) return 'projects.0.projectName';
  if (l.includes('自我评价') || l.includes('个人优势') || l.includes('evaluation')) return 'basics.selfEvaluation';
  if (l.includes('籍贯') || l.includes('native')) return 'basics.nativePlace.city';
  if (l.includes('现居') || l.includes('城市') || l.includes('city')) return 'basics.currentLocation.city';
  return 'basics.name';
}

/**
 * 启动可视化吸管选择器
 */
export function startElementPicking(
  onPicked: (info: PickedElementInfo) => void,
  onCancel?: () => void
): () => void {
  const topDocument = typeof document !== 'undefined' ? document : null;
  if (!topDocument?.body) {
    onCancel?.();
    return () => undefined;
  }

  // 1. 创建吸管提示条
  const banner = topDocument.createElement('div');
  banner.id = BANNER_ID;
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: #0f172a;
    color: #f8fafc;
    padding: 10px 20px;
    border-radius: 9999px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    font-size: 13px;
    font-weight: bold;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 2px solid #3b82f6;
    animation: openjobfill-slide-down 0.25s ease-out;
  `;
  banner.innerHTML = `
    <span>🔍 元素吸管已激活：请在网页上点击要绑定的输入框</span>
    <kbd style="background:#334155; padding:2px 8px; border-radius:4px; font-size:11px;">按 ESC 退出</kbd>
  `;
  topDocument.body.appendChild(banner);

  // 2. 每个同源文档各自放一个遮罩。事件不会从 iframe 冒泡到顶层，
  // 所以选择器也必须在每层文档安装监听，才能点选 iframe 内控件。
  const overlays = new Map<Document, HTMLElement>();
  const overlayStyle = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    border: 2px dashed #2563eb;
    background: rgba(37, 99, 235, 0.12);
    border-radius: 6px;
    transition: all 0.08s ease-out;
    display: none;
  `;
  for (const doc of getAllDocumentsAcrossIframes(topDocument)) {
    if (!doc.body) continue;
    const overlay = doc.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = overlayStyle;
    doc.body.appendChild(overlay);
    overlays.set(doc, overlay);
  }

  let currentTarget: HTMLElement | null = null;

  const isPickerUi = (target: HTMLElement, doc: Document): boolean => {
    return (
      !!target.closest(`#${BANNER_ID}, #${OVERLAY_ID}, #openjobfill-extension-host`) ||
      (target.ownerDocument === topDocument && !!topDocument.getElementById(BANNER_ID)?.contains(target)) ||
      (target.ownerDocument === doc && target.id === BANNER_ID)
    );
  };

  const handleMouseMove = (doc: Document) => (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const overlay = overlays.get(doc);
    if (!target || !overlay || isPickerUi(target, doc)) {
      if (overlay) overlay.style.display = 'none';
      return;
    }

    currentTarget = target;
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  const handleClick = (doc: Document) => (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || isPickerUi(target, doc)) return;

    e.preventDefault();
    e.stopPropagation();

    currentTarget = target;

    const selector = generateOptimalSelector(currentTarget);
    const label = currentTarget.getAttribute('placeholder') || 
                  currentTarget.getAttribute('name') || 
                  currentTarget.closest('.form-item, tr, div')?.querySelector('label')?.textContent?.trim() || 
                  currentTarget.tagName.toLowerCase();

    const suggestedKey = guessResumeKeyFromLabel(label);
    const previewValue = (currentTarget as HTMLInputElement).value || currentTarget.textContent?.slice(0, 30) || '';

    cleanup();

    onPicked({
      selector,
      tagName: currentTarget.tagName.toLowerCase(),
      label: label.replace(/[:：*]/g, '').trim(),
      element: currentTarget,
      suggestedResumeKey: suggestedKey,
      previewValue
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      onCancel?.();
    }
  };

  const listeners: Array<{
    doc: Document;
    mouseMove: (e: MouseEvent) => void;
    click: (e: MouseEvent) => void;
  }> = [];

  for (const doc of overlays.keys()) {
    const mouseMove = handleMouseMove(doc);
    const click = handleClick(doc);
    doc.addEventListener('mousemove', mouseMove, true);
    doc.addEventListener('click', click, true);
    doc.addEventListener('keydown', handleKeyDown, true);
    listeners.push({ doc, mouseMove, click });
  }

  const cleanup = () => {
    for (const listener of listeners) {
      listener.doc.removeEventListener('mousemove', listener.mouseMove, true);
      listener.doc.removeEventListener('click', listener.click, true);
      listener.doc.removeEventListener('keydown', handleKeyDown, true);
    }
    banner.remove();
    for (const overlay of overlays.values()) overlay.remove();
  };

  return cleanup;
}
