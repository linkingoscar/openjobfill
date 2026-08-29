import { sleep, isElementVisible, getElementWindow, isInputElement, isSelectElement } from '../../utils/dom';
import { setNativeValue, simulateClick } from './dispatcher';
import { getFormalUniversityVariants, getFormalMajorVariants } from '../matcher/aliasDictionary';

const OPTION_SELECTORS = [
  '.el-select-dropdown__item', // Element UI / Element Plus
  '.ant-select-item-option-content', // Ant Design
  '.ant-select-item-option',
  '.semi-select-option', // Semi Design (飞书)
  '[class*="option-item"]',
  '[class*="select-option"]',
  '[class*="dropdown-item"]',
  '[class*="select__menu-notice"]',
  '[class*="select__option"]',
  '[role="option"]',
  'li[role="option"]',
  '.moka-select-option',
  '.beisen-select-option',
  '.dayee-option',
  '.tencent-select-option',
];

/**
 * 动态等待下拉菜单或选项在 DOM 中渲染并可见 (支持 aria-controls / aria-owns 作用域精准隔离)
 */
async function waitForDropdownCandidates(triggerEl?: HTMLElement, timeoutMs = 800): Promise<HTMLElement[]> {
  const startTime = Date.now();
  const ownerDocument = triggerEl?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!ownerDocument) return [];

  // 1. 尝试从 triggerEl 或内部 input 提取关联的 popup ID
  const popupId =
    triggerEl?.getAttribute('aria-controls') ||
    triggerEl?.getAttribute('aria-owns') ||
    triggerEl?.querySelector('input')?.getAttribute('aria-controls') ||
    triggerEl?.querySelector('input')?.getAttribute('aria-owns') ||
    null;

  while (Date.now() - startTime < timeoutMs) {
    const candidates: HTMLElement[] = [];

    // 优先在关联的 popup 作用域内查找
    let searchRoot: ParentNode = ownerDocument;
    if (popupId) {
      const popupEl = ownerDocument.getElementById(popupId) || ownerDocument.querySelector(`[id="${CSS.escape(popupId)}"]`);
      if (!popupEl || !isElementVisible(popupEl as HTMLElement)) {
        await sleep(50);
        continue; // 声明了 popupId 时必须只等待自身 Popup 挂载，严禁中途退回 document 全局误拿其他下拉
      }
      searchRoot = popupEl;
    }

    for (const selector of OPTION_SELECTORS) {
      const found = Array.from(searchRoot.querySelectorAll<HTMLElement>(selector));
      for (const el of found) {
        if (isElementVisible(el)) {
          candidates.push(el);
        }
      }
    }

    if (candidates.length > 0) {
      return candidates;
    }

    await sleep(50);
  }

  return [];
}

import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { locationResolver } from '../resolvers/locationResolver';

/**
 * 单次执行下拉框搜索与匹配尝试
 */
async function trySelectCustomOptionOnce(
  triggerEl: HTMLElement,
  targetText: string,
  fuzzy = true
): Promise<boolean> {
  const targetLower = targetText.toLowerCase().trim();

  // 1. 如果是原生 select 标签
  if (isSelectElement(triggerEl)) {
    const options = Array.from(triggerEl.options);
    const optTexts = options.map((o) => o.text.trim());

    // 尝试 OptionResolver / LocationResolver
    let bestCanonicalText: string | null = null;
    const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
    for (const d of domains) {
      const resolved = optionResolver.resolveOptionValue(optTexts, d, targetText);
      if (resolved) {
        bestCanonicalText = resolved;
        break;
      }
    }
    if (!bestCanonicalText) {
      bestCanonicalText = locationResolver.matchLocationOption(optTexts, targetText);
    }

    const matched = options.find((opt) => {
      const t = opt.text.trim().toLowerCase();
      if (bestCanonicalText && opt.text.trim() === bestCanonicalText) return true;
      return fuzzy ? (t.includes(targetLower) || targetLower.includes(t)) : (t === targetLower);
    });
    if (matched) {
      triggerEl.value = matched.value;
      const win = getElementWindow(triggerEl) as any;
      const EventClass = win.Event || Event;
      triggerEl.dispatchEvent(new EventClass('input', { bubbles: true }));
      triggerEl.dispatchEvent(new EventClass('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  // 2. 检查是否有内部原生 select
  const internalSelect = triggerEl.querySelector('select');
  if (internalSelect) {
    return trySelectCustomOptionOnce(internalSelect, targetText, fuzzy);
  }

  // 3. 如果包含内部输入框（可搜索下拉框），尝试输入搜索文本以加速定位
  const inputChild = triggerEl.querySelector<HTMLInputElement>('input');
  if (inputChild && isInputElement(inputChild) && !inputChild.readOnly) {
    simulateClick(inputChild);
    setNativeValue(inputChild, targetText);
    const win = getElementWindow(inputChild) as any;
    const KeyboardEventClass = win.KeyboardEvent || KeyboardEvent;
    inputChild.dispatchEvent(new KeyboardEventClass('keydown', { key: 'ArrowDown', bubbles: true }));
    inputChild.dispatchEvent(new KeyboardEventClass('keyup', { key: 'ArrowDown', bubbles: true }));
  } else {
    simulateClick(triggerEl);
  }

  // 4. 动态等待 Portal 选项列表渲染挂载到 DOM (优先在 trigger 关联作用域查找)
  const candidateElements = await waitForDropdownCandidates(triggerEl, 700);
  if (candidateElements.length === 0) {
    return false;
  }

  const candidateTexts = candidateElements.map((el) => (el.textContent || '').trim()).filter(Boolean);

  // 5. 动态调用 OptionResolver / LocationResolver 解析最优 Option 文本
  let canonicalMatchedText: string | null = null;
  const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
  for (const d of domains) {
    const resolved = optionResolver.resolveOptionValue(candidateTexts, d, targetText);
    if (resolved) {
      canonicalMatchedText = resolved;
      break;
    }
  }
  if (!canonicalMatchedText) {
    canonicalMatchedText = locationResolver.matchLocationOption(candidateTexts, targetText);
  }

  // 6. 遍历可见选项，比对文本内容 (Canonical 优先 -> 精准匹配 -> 模糊匹配)
  let bestMatch: HTMLElement | null = null;

  if (canonicalMatchedText) {
    for (const item of candidateElements) {
      if ((item.textContent || '').trim() === canonicalMatchedText) {
        bestMatch = item;
        break;
      }
    }
  }

  if (!bestMatch) {
    for (const item of candidateElements) {
      const itemText = (item.textContent || '').trim().toLowerCase();
      if (!itemText) continue;

      if (itemText === targetLower) {
        bestMatch = item;
        break;
      }
    }
  }

  if (!bestMatch && fuzzy) {
    for (const item of candidateElements) {
      const itemText = (item.textContent || '').trim().toLowerCase();
      if (!itemText) continue;

      if (itemText.includes(targetLower) || targetLower.includes(itemText)) {
        bestMatch = item;
        break;
      }
    }
  }

  // 7. 如果找到匹配项，模拟点击
  if (bestMatch) {
    simulateClick(bestMatch);
    await sleep(120);
    return true;
  }

  return false;
}

/**
 * 模拟非原生下拉选择组件 (集成全国高校与专业同义词/简称自动回退)
 */
export async function selectCustomOption(
  triggerEl: HTMLElement,
  targetText: string,
  fuzzy = true
): Promise<boolean> {
  if (!triggerEl || !targetText) return false;

  // 第一轮：直接使用原文本尝试匹配
  const firstTry = await trySelectCustomOptionOnce(triggerEl, targetText, fuzzy);
  if (firstTry) return true;

  // 第二轮：如果是高校名称或专业名称，尝试同义词/正式全称变体
  const uniVariants = getFormalUniversityVariants(targetText);
  for (const variant of uniVariants) {
    if (variant === targetText) continue;
    const variantSuccess = await trySelectCustomOptionOnce(triggerEl, variant, fuzzy);
    if (variantSuccess) {
      console.log(`[OpenJobFill] 高校同义词命中: ${targetText} -> ${variant}`);
      return true;
    }
  }

  const majorVariants = getFormalMajorVariants(targetText);
  for (const variant of majorVariants) {
    if (variant === targetText) continue;
    const variantSuccess = await trySelectCustomOptionOnce(triggerEl, variant, fuzzy);
    if (variantSuccess) {
      console.log(`[OpenJobFill] 专业同义词命中: ${targetText} -> ${variant}`);
      return true;
    }
  }

  // 收起下拉框
  simulateClick(triggerEl);
  return false;
}

/**
 * 模拟多级级联选择器 (Cascader，如 省-市-区, 学历-专业大类-专业)
 * 支持传入数组或以“-”、“/”拼接的字符串
 */
export async function selectCascaderOptions(
  triggerEl: HTMLElement,
  pathData: string[] | string
): Promise<boolean> {
  if (!triggerEl) return false;
  const pathTexts = Array.isArray(pathData) 
    ? pathData 
    : pathData.split(/[-/、>]/).map(s => s.trim()).filter(Boolean);

  if (pathTexts.length === 0) return false;

  // 1. 点击展开级联菜单
  simulateClick(triggerEl);
  await sleep(250);

  const cascaderItemSelectors = [
    '.el-cascader-node', // Element Plus
    '.ant-cascader-menu-item', // Ant Design
    '.semi-cascader-item',
    '[class*="cascader-node"]',
    '[class*="cascader-item"]',
    '[role="menuitem"]',
    'li[role="treeitem"]',
  ];

  for (let i = 0; i < pathTexts.length; i++) {
    const stepTarget = pathTexts[i].trim().toLowerCase();
    await sleep(200);

    const candidates: HTMLElement[] = [];
    const ownerDocument = triggerEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!ownerDocument) return false;
    for (const selector of cascaderItemSelectors) {
      const found = Array.from(ownerDocument.querySelectorAll<HTMLElement>(selector));
      for (const el of found) {
        if (isElementVisible(el)) {
          candidates.push(el);
        }
      }
    }

    const matched = candidates.find((item) => {
      const text = (item.textContent || '').trim().toLowerCase();
      return text === stepTarget || text.includes(stepTarget) || stepTarget.includes(text);
    });

    if (matched) {
      simulateClick(matched);
      await sleep(150);
    } else {
      console.warn(`[OpenJobFill] Cascader step ${i + 1} (${pathTexts[i]}) not matched.`);
      return false;
    }
  }

  await sleep(150);
  return true;
}

/**
 * 根据选项文案选择 Radio 组中的某一项
 */
export function selectRadioByLabel(container: HTMLElement, targetText: string): boolean {
  if (!container || !targetText) return false;

  const target = targetText.trim().toLowerCase();
  const labels = Array.from(container.querySelectorAll('label, .el-radio, .ant-radio-wrapper, .semi-radio, [class*="radio"]'));
  
  for (const label of labels) {
    const text = (label.textContent || '').trim().toLowerCase();
    if (text.includes(target) || target.includes(text)) {
      const input = label.querySelector<HTMLInputElement>('input[type="radio"]');
      if (input) {
        input.click();
      } else {
        simulateClick(label as HTMLElement);
      }
      return true;
    }
  }

  return false;
}
