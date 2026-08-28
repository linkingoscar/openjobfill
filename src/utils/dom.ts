/**
 * DOM 辅助操作工具库 (增强 Iframe 穿透与层级遍历)
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 检查元素是否在视口可见且未隐藏
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
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

    observer.observe(root instanceof Document ? root.body : root, {
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
 * 获取主页面以及同源 Iframe 内的所有候选表单元素 (针对国企/大易/北森等 iframe 嵌套场景)
 */
export function getAllFormElementsAcrossIframes(
  selector = 'input, textarea, select, .el-select, .ant-select, .semi-select, [role="combobox"]'
): HTMLElement[] {
  const elements: HTMLElement[] = [];

  // 1. 主页面
  try {
    const mainEls = Array.from(document.querySelectorAll<HTMLElement>(selector));
    elements.push(...mainEls);
  } catch (e) {}

  // 2. 遍历页面内的 iframe (若同源可访问)
  const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const iframeEls = Array.from(iframeDoc.querySelectorAll<HTMLElement>(selector));
        elements.push(...iframeEls);
      }
    } catch (err) {
      // 跨域 iframe 安全限制忽略
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
