/**
 * DOM 辅助操作工具库 (增强 Iframe 穿透与跨 Window 环境兼容)
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全获取 DOM 元素所属的 Window 上下文 (兼容主 Window 与同源 iframe)
 */
export function getElementWindow(el: Element | null | undefined): Window {
  return (el?.ownerDocument?.defaultView) || (typeof window !== 'undefined' ? window : ({} as Window));
}

/**
 * 跨 Window 实例安全的 HTMLInputElement 检查 (杜绝 iframe input instanceof 失败)
 */
export function isInputElement(el: unknown): el is HTMLInputElement {
  if (!el || typeof el !== 'object') return false;
  const win = getElementWindow(el as Element) as any;
  return (typeof win.HTMLInputElement !== 'undefined' && el instanceof win.HTMLInputElement) || (el as Element).tagName === 'INPUT';
}

/**
 * 跨 Window 实例安全的 HTMLTextAreaElement 检查
 */
export function isTextAreaElement(el: unknown): el is HTMLTextAreaElement {
  if (!el || typeof el !== 'object') return false;
  const win = getElementWindow(el as Element) as any;
  return (typeof win.HTMLTextAreaElement !== 'undefined' && el instanceof win.HTMLTextAreaElement) || (el as Element).tagName === 'TEXTAREA';
}

/**
 * 跨 Window 实例安全的 HTMLSelectElement 检查
 */
export function isSelectElement(el: unknown): el is HTMLSelectElement {
  if (!el || typeof el !== 'object') return false;
  const win = getElementWindow(el as Element) as any;
  return (typeof win.HTMLSelectElement !== 'undefined' && el instanceof win.HTMLSelectElement) || (el as Element).tagName === 'SELECT';
}

const FORM_CONTROL_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea, [contenteditable="true"], [role="combobox"], .el-select, .ant-select, .semi-select';
const FIELD_CONTAINER_SELECTOR =
  '.el-form-item, .ant-form-item, .form-item, .form-group, [class*="form-item"], [class*="FormItem"], [class*="item-wrapper"], tr';

function hasRequiredMarker(text: string | null | undefined): boolean {
  return !!text && (text.includes('*') || text.includes('必填'));
}

function findNearbyFieldLabel(el: HTMLElement, container: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    const previous = current.previousElementSibling as HTMLElement | null;
    if (previous) {
      if (previous.matches('label, .el-form-item__label, .ant-form-item-label, .form-label, [class*="label"], [class*="title"]')) {
        return previous;
      }
      const nested = previous.querySelector<HTMLElement>(
        'label, .el-form-item__label, .ant-form-item-label, .form-label, [class*="label"], [class*="title"]'
      );
      if (nested) return nested;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * 判断字段是否真的带有必填标记。
 *
 * 表单行里经常并排放两个控件；直接读取整个 `.form-item` 的 textContent
 * 会把“手机号 *”错误地套到旁边的邮箱。优先使用 required/aria-required 或
 * 明确关联的 label，只有单控件、单选/复选组、日期区间等复合控件才继承行级星号。
 */
export function isFieldRequired(el: HTMLElement, labelText = ''): boolean {
  if (!el) return false;
  if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') return true;

  const doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return hasRequiredMarker(labelText);

  const explicitLabel = el.id
    ? doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    : null;
  const ancestorLabel = el.closest('label');
  if (hasRequiredMarker(explicitLabel?.textContent) || hasRequiredMarker(ancestorLabel?.textContent)) {
    return true;
  }

  const container = el.closest(FIELD_CONTAINER_SELECTOR) as HTMLElement | null;
  if (!container) return hasRequiredMarker(labelText);

  // 无 for/id 的常见写法是“label + input”并排。先看当前控件最近的前置
  // 标签，避免把同一行另一个字段的星号继承过来。
  const nearbyLabel = findNearbyFieldLabel(el, container);
  if (nearbyLabel) return hasRequiredMarker(nearbyLabel.textContent);

  const containerMarked =
    container.classList.contains('is-required') ||
    !!container.querySelector('.ant-form-item-required, [class*="required"], [class*="Required"]');
  const labels = Array.from(container.querySelectorAll<HTMLElement>(
    'label, .el-form-item__label, .ant-form-item-label, .form-label, [class*="label"], [class*="title"]'
  ));
  const hasRowMarker = containerMarked || labels.some((label) => hasRequiredMarker(label.textContent));
  if (!hasRowMarker) return false;

  const controls = Array.from(container.querySelectorAll<HTMLElement>(FORM_CONTROL_SELECTOR));
  if (controls.length <= 1) return true;

  // 同 name 的 radio/checkbox 是一个逻辑字段，即使 DOM 上有多个 input 也
  // 应共享所在表单行的必填标记。
  if (isInputElement(el) && (el.type === 'radio' || el.type === 'checkbox')) {
    const sameGroup = controls.filter((control) =>
      isInputElement(control) &&
      control.type === el.type &&
      (!!el.name ? control.name === el.name : true)
    );
    if (sameGroup.length === controls.length || sameGroup.length > 1) return true;
  }

  // 日期范围通常由两个同类控件组成，行级星号对两端都有效。
  const isDateLike = (control: HTMLElement) =>
    isInputElement(control) && (control.type === 'date' || control.type === 'month');
  if (controls.every((control) => isDateLike(control) || isSelectElement(control))) return true;

  // 没有明确关联关系的并排文本控件不要继承兄弟字段的星号。
  return false;
}

/**
 * 检查元素是否在视口可见且未隐藏 (通过元素自身 Window 计算样式)
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  const win = getElementWindow(el);
  const style = win.getComputedStyle ? win.getComputedStyle(el) : (typeof window !== 'undefined' ? window.getComputedStyle(el) : null);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    // 兼容 JSDOM / Headless 测试环境
    return true;
  }
  return rect.width > 0 && rect.height > 0;
}

/**
 * 等待特定选择器的元素出现
 */
export function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: Document | HTMLElement = document,
  timeout = 3000
): Promise<T | null> {
  return new Promise((resolve) => {
    const el = root.querySelector<T>(selector);
    if (el && isElementVisible(el)) {
      return resolve(el);
    }

    const observer = new MutationObserver(() => {
      const found = root.querySelector<T>(selector);
      if (found && isElementVisible(found)) {
        observer.disconnect();
        resolve(found);
      }
    });

    // `instanceof Document` 在同源 iframe 中会跨 realm 失效；nodeType 对所有
    // 文档窗口一致，避免把 Document 本身误当成普通元素处理。
    const observationRoot = root.nodeType === 9 ? (root as Document).body || root : root;
    observer.observe(observationRoot, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(root.querySelector<T>(selector) || null);
    }, timeout);
  });
}

/**
 * 获取主页面及所有可访问的同源 iframe 文档（递归、去重）。
 * 需要给徽标、必填扫描等“按文档操作”的功能复用，避免每处各写一层 iframe。
 */
export function getAllDocumentsAcrossIframes(rootDocument?: Document): Document[] {
  const root = rootDocument || (typeof document !== 'undefined' ? document : null);
  if (!root) return [];

  const documents: Document[] = [];
  const visited = new Set<Document>();
  const queue: Document[] = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    documents.push(current);

    try {
      const frames = Array.from(current.querySelectorAll<HTMLIFrameElement>('iframe, frame'));
      for (const frame of frames) {
        try {
          const child = frame.contentDocument || frame.contentWindow?.document;
          if (child && !visited.has(child)) queue.push(child);
        } catch {
          // 跨域 frame 无法读取，跳过即可。
        }
      }
    } catch {
      // 页面切换期间 DOM 可能暂不可查询。
    }
  }

  return documents;
}

/**
 * 收集给定根节点及其内部所有可访问的 open ShadowRoot。
 * closed shadow root 受浏览器封装边界限制，内容脚本无法通用穿透。
 */
export function getAllOpenRoots(root: Document | ShadowRoot | HTMLElement): ParentNode[] {
  const roots: ParentNode[] = [root];
  const visited = new Set<ShadowRoot>();
  const queue: ParentNode[] = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    let elements: Element[] = [];
    try {
      elements = Array.from(current.querySelectorAll('*'));
    } catch {}

    for (const element of elements) {
      const shadow = element.shadowRoot;
      if (shadow && !visited.has(shadow)) {
        visited.add(shadow);
        roots.push(shadow);
        queue.push(shadow);
      }
    }
  }

  return roots;
}

/**
 * 获取主页面以及同源 Iframe 内的所有候选表单元素 (针对国企/大易/北森等 iframe 嵌套场景)
 */
export function getAllFormElementsAcrossIframes(
  selector = 'input, textarea, select, .el-select, .ant-select, .semi-select, [role="combobox"]'
): HTMLElement[] {
  const elements: HTMLElement[] = [];

  if (typeof document === 'undefined') return elements;

  // 以文档为单位遍历，而不是只查一层 iframe。真实 ATS 页面经常是
  // 「门户 iframe → 表单 iframe」，同源的第二层也应进入自动填充候选集。
  const documentsToScan = getAllDocumentsAcrossIframes(document);

  for (const targetDoc of documentsToScan) {
    try {
      elements.push(...Array.from(targetDoc.querySelectorAll<HTMLElement>(selector)));
    } catch {
      // 单个文档查询失败不应阻断其他 frame。
    }
  }

  return elements.filter(isElementVisible);
}

/**
 * 获取元素自身的直接文本内容 (忽略子元素)
 */
export function getDirectTextContent(el: HTMLElement): string {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    }
  }
  return text.trim();
}

/**
 * 查找距离当前输入元素最近的 Label 描述文本
 */
export function findAssociatedLabelText(inputEl: HTMLElement): string {
  const doc = inputEl.ownerDocument || document;

  // 1. 如果有明确的 id，查找 label[for="id"]
  if (inputEl.id) {
    const label = doc.querySelector(`label[for="${CSS.escape(inputEl.id)}"]`);
    if (label && label.textContent) {
      return label.textContent.trim();
    }
  }

  // 2. 查找祖先 label
  const parentLabel = inputEl.closest('label');
  if (parentLabel && parentLabel.textContent) {
    return parentLabel.textContent.trim();
  }

  // 3. 查找常见表单行容器
  const formItem = inputEl.closest(
    '.el-form-item, .ant-form-item, .form-item, .form-group, .field, [class*="form-item"], [class*="FormItem"], [class*="item-wrapper"], tr'
  );
  if (formItem) {
    const label = formItem.querySelector(
      'label, .el-form-item__label, .ant-form-item-label, .form-label, [class*="label"], [class*="title"], td:first-child'
    );
    if (label && label.textContent) {
      return label.textContent.trim();
    }
  }

  // 4. 查找前一个兄弟节点或其内部文本
  let prev = inputEl.previousElementSibling as HTMLElement | null;
  while (prev) {
    const text = prev.textContent?.trim();
    if (text && text.length <= 40) {
      return text;
    }
    prev = prev.previousElementSibling as HTMLElement | null;
  }

  // 5. 查找 placeholder, aria-label, name, title
  const placeholder = inputEl.getAttribute('placeholder');
  if (placeholder) return placeholder.trim();

  const ariaLabel = inputEl.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const name = inputEl.getAttribute('name');
  if (name) return name.trim();

  const title = inputEl.getAttribute('title');
  if (title) return title.trim();

  return '';
}

/**
 * 智能生成精准稳定的 DOM 选择器 (优先 id -> automation-id -> name -> 语义 class 组合)
 */
export function generateOptimalSelector(el: HTMLElement): string {
  if (!el) return '';
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const automationId = el.getAttribute('data-automation-id') || el.getAttribute('data-testid');
  if (automationId) {
    return `[data-automation-id="${CSS.escape(automationId)}"]`;
  }
  const name = el.getAttribute('name');
  if (name) {
    return `[name="${CSS.escape(name)}"]`;
  }
  const classes = Array.from(el.classList || [])
    .filter((c) => typeof c === 'string' && !c.includes('focus') && !c.includes('hover') && !c.includes('active') && !c.includes('valid'))
    .map((c) => `.${CSS.escape(c)}`)
    .join('');
  if (classes) {
    return `${el.tagName.toLowerCase()}${classes}`;
  }
  return el.tagName.toLowerCase();
}
