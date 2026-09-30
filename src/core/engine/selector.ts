import { sleep, isElementVisible, getElementWindow, getAllOpenRoots, findAssociatedLabelText, isInputElement, isSelectElement } from '../../utils/dom';
import { setNativeValue, simulateClick } from './dispatcher';
import { getSafeEntityVariants } from '../matcher/aliasDictionary';
import { throwIfAborted } from '../pipeline/runContext';

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
  '.mtd-select-item',
  '.mtd-dropdown-item',
  '.layui-form-select dl dd',
  '.ivu-select-item',
  '.ivu-cascader-menu-item',
  '.moka-select-item',
  '.moka-option',
  '.mokahr-dropdown-option',
  '.phoenix-select-option',
  '.sc-select-option',
  '.atsx-select-option',
  '.aui-select-option',
  '.ud-select-option',
  '.sd-dropdown-item',
  '.tp-select-option',
  '.cascader-modal li',
  '.my-cascader-modal li',
  '.e_layer li',
  '.layer_content li',
  '.pop-panel td',
  '.dialog-box li',
  '.select2-result-selectable',
  '.select2-result-selectable .select2-result-label',
];

function confirmKnownLegacyPopup(selected: HTMLElement): void {
  const popup = selected.closest<HTMLElement>(
    '.e_layer, .layer_content, .pop-panel, .dialog-box, .layui-layer, .cascader-modal, .my-cascader-modal'
  );
  if (!popup) return;
  const button = Array.from(popup.querySelectorAll<HTMLElement>('button, [role="button"], .btn, a'))
    .find((candidate) => /^(确定|确认|完成|应用)$/.test((candidate.textContent || '').trim()));
  if (button && isElementVisible(button)) simulateClick(button);
}

const CASCADER_ITEM_SELECTORS = [
  '.el-cascader-node', '.ant-cascader-menu-item', '.semi-cascader-item',
  '.ivu-cascader-menu-item', '.mtd-cascader-menu-item', '.mokahr-region-option',
  '.phoenix-cascader-item', '.sc-cascader-item', '.hc-super-selector-item', '.tp-cascader-item',
  '.layui-form-select dl dd', '.cascader-modal li', '.my-cascader-modal li', '.e_layer li',
  '.layer_content li', '[class*="cascader-node"]', '[class*="cascader-item"]',
  '[role="menuitem"]', 'li[role="treeitem"]',
];
const CASCADER_COLUMNS = '.ant-cascader-menu, .el-cascader-menu, .ivu-cascader-menu, .semi-cascader-menu, [role="menu"], [role="tree"]';
const normalizeOptionText = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

function isSelectableOption(el: HTMLElement): boolean {
  if (!isElementVisible(el)) return false;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true'
      || node.classList.contains('is-disabled') || node.classList.contains('disabled')
      || node.classList.contains('select2-disabled') || node.classList.contains('select2-result-unselectable')
      || Array.from(node.classList).some(name => /(?:^|-)option-disabled$|(?:^|-)menu-item-disabled$/.test(name))) return false;
  }
  return true;
}

function collectOptions(roots: ParentNode[], selectors: string[]): HTMLElement[] {
  return Array.from(new Set(roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(selectors.join(','))))))
    .filter(isSelectableOption);
}

interface PopupScope {
  trigger: HTMLElement;
  previouslyVisible: Set<HTMLElement>;
  selectors: string[];
  roots: ParentNode[];
  rootsRefreshedAt: number;
}

function preparePopupScope(trigger: HTMLElement, selectors: string[]): PopupScope {
  const roots = getAllOpenRoots(trigger.ownerDocument);
  return { trigger, selectors, roots, rootsRefreshedAt: Date.now(), previouslyVisible: new Set(collectOptions(roots, selectors)) };
}

/** Re-read IDREFs on every poll: many portals acquire their association after opening. */
function scopedPopupRoots(scope: PopupScope): { roots: ParentNode[]; associated: boolean } {
  const { trigger } = scope;
  if (Date.now() - scope.rootsRefreshedAt >= 250) {
    scope.roots = getAllOpenRoots(trigger.ownerDocument);
    scope.rootsRefreshedAt = Date.now();
  }
  const allRoots = scope.roots;
  const controls = [trigger, ...Array.from(trigger.querySelectorAll<HTMLElement>('input, [role="combobox"]'))];
  const ids = Array.from(new Set(controls.flatMap(control => [control.getAttribute('aria-controls'), control.getAttribute('aria-owns')])
    .filter((value): value is string => !!value).flatMap(value => value.trim().split(/\s+/))));
  if (ids.length) {
    const roots = ids.flatMap(id => allRoots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(`[id="${CSS.escape(id)}"]`))))
      .filter(isElementVisible);
    // An explicit owner is authoritative; never fall back to another open dropdown.
    return { roots: Array.from(new Set(roots)), associated: true };
  }
  if (trigger.closest('.select2-container')) {
    return {
      roots: allRoots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>('#select2-drop.select2-drop-active'))).filter(isElementVisible),
      associated: true,
    };
  }
  return { roots: allRoots, associated: false };
}

function scopedOptions(scope: PopupScope): { items: HTMLElement[]; roots: ParentNode[] } {
  const { roots, associated } = scopedPopupRoots(scope);
  let items = collectOptions(roots, scope.selectors);
  if (!associated && (scope.trigger.hasAttribute('aria-haspopup') || scope.trigger.querySelector('[aria-haspopup]'))) {
    // Existing unrelated portals are not evidence of this ARIA control opening.
    // New/previously hidden options and descendants still support unlabelled portals.
    items = items.filter(item => scope.trigger.contains(item) || !scope.previouslyVisible.has(item));
  }
  return { items, roots };
}

import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { locationResolver } from '../resolvers/locationResolver';

/**
 * 单次执行下拉框搜索与匹配尝试
 */
async function trySelectCustomOptionOnce(
  triggerEl: HTMLElement,
  targetText: string,
  fuzzy = true,
  signal?: AbortSignal,
): Promise<boolean> {
  throwIfAborted(signal);
  const targetLower = targetText.normalize('NFKC').toLowerCase().trim();
  const entityField = /学校|院校|公司|企业|专业|school|university|college|company|employer|major/i.test([findAssociatedLabelText(triggerEl), triggerEl.getAttribute('name'), triggerEl.id].join(' '));
  const locationField = /地区|城市|省份|籍贯|生源地|居住地|location|city|province/i.test([findAssociatedLabelText(triggerEl), triggerEl.getAttribute('name'), triggerEl.id].join(' '));

  // 1. 如果是原生 select 标签
  if (isSelectElement(triggerEl)) {
    if (triggerEl.disabled || triggerEl.closest('fieldset[disabled]')) return false;
    const options = Array.from(triggerEl.options).filter(option => !option.disabled && !option.closest('optgroup[disabled]') && !option.hidden);
    const optTexts = options.map((o) => o.text.trim());

    // 尝试 OptionResolver / LocationResolver
    let bestCanonicalText: string | null = null;
    const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
    for (const d of entityField ? [] : domains) {
      const resolved = optionResolver.resolveOptionValue(optTexts, d, targetText, true);
      if (resolved) {
        bestCanonicalText = resolved;
        break;
      }
    }
    if (!bestCanonicalText && locationField && !entityField) {
      bestCanonicalText = locationResolver.matchLocationOption(optTexts, targetText);
    }

    const matched = options.find((opt) => {
      const t = opt.text.normalize('NFKC').trim().toLowerCase();
      if (bestCanonicalText && opt.text.trim() === bestCanonicalText) return true;
      return !!t && t === targetLower;
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
    return trySelectCustomOptionOnce(internalSelect, targetText, fuzzy, signal);
  }

  // 3. 如果包含内部输入框（可搜索下拉框），尝试输入搜索文本以加速定位
  const scope = preparePopupScope(triggerEl, OPTION_SELECTORS);
  const select2Root = triggerEl.closest<HTMLElement>('.select2-container');
  let inputChild = isInputElement(triggerEl) ? triggerEl : triggerEl.querySelector<HTMLInputElement>('input:not([type="hidden"])');
  if (select2Root) {
    simulateClick(select2Root.querySelector<HTMLElement>('.select2-choice') || select2Root);
    const deadline = Date.now() + 1200;
    inputChild = null;
    while (Date.now() < deadline && !inputChild) {
      throwIfAborted(signal);
      inputChild = scopedPopupRoots(scope).roots
        .flatMap(root => Array.from(root.querySelectorAll<HTMLInputElement>('.select2-search input.select2-input')))
        .find(isElementVisible) || null;
      if (!inputChild) await sleep(50, signal);
    }
  }
  const originalQuery = inputChild?.value || '';
  const restoreUncommittedQuery = () => {
    if (inputChild && !inputChild.readOnly && inputChild.value === targetText && !signal?.aborted) {
      setNativeValue(inputChild, originalQuery);
    }
  };
  if (inputChild && isInputElement(inputChild) && !inputChild.readOnly) {
    simulateClick(inputChild);
    setNativeValue(inputChild, targetText);
    const win = getElementWindow(inputChild) as any;
    const KeyboardEventClass = win.KeyboardEvent || KeyboardEvent;
    inputChild.dispatchEvent(new KeyboardEventClass('keydown', { key: 'ArrowDown', bubbles: true }));
    inputChild.dispatchEvent(new KeyboardEventClass('keyup', { key: 'ArrowDown', bubbles: true }));
  } else if (!select2Root) {
    simulateClick(triggerEl);
  }

  const findBestMatch = (items: HTMLElement[]): HTMLElement | null => {
    const candidateTexts = items.map((item) => (item.textContent || '').trim()).filter(Boolean);
    let canonicalMatchedText: string | null = null;
    const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
    for (const domain of entityField ? [] : domains) {
      canonicalMatchedText = optionResolver.resolveOptionValue(candidateTexts, domain, targetText, true);
      if (canonicalMatchedText) break;
    }
    if (!canonicalMatchedText && locationField && !entityField) canonicalMatchedText = locationResolver.matchLocationOption(candidateTexts, targetText);

    if (canonicalMatchedText) {
      const canonical = items.find((item) => (item.textContent || '').trim() === canonicalMatchedText);
      if (canonical) return canonical;
    }
    return items.find((item) => (item.textContent || '').normalize('NFKC').trim().toLowerCase() === targetLower) || null;
  };

  let bestMatch: HTMLElement | null = null;
  const deadline = Date.now() + 1200;
  let scrollAttempts = 0;
  let lastScrollAt = 0;
  while (Date.now() < deadline && !bestMatch) {
    throwIfAborted(signal);
    const { items } = scopedOptions(scope);
    bestMatch = findBestMatch(items);
    if (bestMatch) break;
    // A stale or loading candidate does not finish an async search. Keep polling
    // for a match while advancing a genuinely scrollable virtual list.
    const scrollContainer = items[0]?.closest<HTMLElement>(
      '[role="listbox"], .rc-virtual-list-holder, .el-select-dropdown__wrap, .semi-portal-inner, .mtd-dropdown-menu, .ivu-select-dropdown-list, [class*="virtual-list"], [class*="menu-list"]'
    );
    if (scrollContainer && scrollAttempts < 10 && Date.now() - lastScrollAt >= 100) {
      const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const nextTop = Math.min(maxTop, scrollContainer.scrollTop + Math.max(120, scrollContainer.clientHeight * 0.8));
      if (nextTop > scrollContainer.scrollTop) {
        scrollContainer.scrollTop = nextTop;
        const ScrollEvent = (getElementWindow(scrollContainer) as any).Event || Event;
        scrollContainer.dispatchEvent(new ScrollEvent('scroll', { bubbles: true }));
        lastScrollAt = Date.now();
        scrollAttempts++;
      }
    }
    await sleep(50, signal);
  }

  // 7. 如果找到匹配项，模拟点击
  if (bestMatch) {
    // Multi-select options toggle on click. Replaying an already selected value
    // must not remove it, including when the matching text is a child element.
    const selected = bestMatch.closest('[aria-selected="true"], [aria-checked="true"]');
    if (selected) return true;
    simulateClick(bestMatch);
    await sleep(120, signal);
    confirmKnownLegacyPopup(bestMatch);
    return true;
  }

  restoreUncommittedQuery();
  return false;
}

/**
 * 模拟非原生下拉选择组件 (集成全国高校与专业同义词/简称自动回退)
 */
async function selectNativeMultiple(trigger: HTMLElement, values: string[], signal?: AbortSignal): Promise<boolean> {
  throwIfAborted(signal);
  const select = isSelectElement(trigger) ? trigger : trigger.querySelector('select');
  // Custom multi-select APIs differ. Reject unsupported arrays before opening or
  // typing so a failed operation cannot leave a partially changed selection.
  if (!select?.multiple || select.disabled || select.closest('fieldset[disabled]') || !values.length
    || values.some(value => typeof value !== 'string' || !value.trim())) return false;
  const options = Array.from(select.options).filter(option => !option.disabled && !option.hidden && !option.closest('optgroup[disabled]'));
  const matches = values.map(value => options.find(option => normalizeOptionText(option.text) === normalizeOptionText(value)));
  if (matches.some(option => !option) || new Set(matches).size !== values.length) return false;
  const selected = new Set(matches);
  // Preflight the full requested set before mutating any option.
  Array.from(select.options).forEach(option => { option.selected = selected.has(option); });
  const EventClass = (getElementWindow(select) as any).Event || Event;
  select.dispatchEvent(new EventClass('input', { bubbles: true }));
  select.dispatchEvent(new EventClass('change', { bubbles: true }));
  return values.length === Array.from(select.selectedOptions).length
    && Array.from(select.selectedOptions).every(option => selected.has(option));
}

export async function selectCustomOption(
  triggerEl: HTMLElement,
  targetText: string | string[],
  fuzzy = true,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!triggerEl || !targetText) return false;
  throwIfAborted(signal);
  if (Array.isArray(targetText)) return selectNativeMultiple(triggerEl, targetText, signal);

  // 第一轮：直接使用原文本尝试匹配
  const firstTry = await trySelectCustomOptionOnce(triggerEl, targetText, fuzzy, signal);
  if (firstTry) return true;

  // 第二轮：如果是高校名称或专业名称，尝试同义词/正式全称变体
  const identity = [findAssociatedLabelText(triggerEl), triggerEl.getAttribute('name'), triggerEl.id, triggerEl.getAttribute('placeholder')].join(' ');
  const uniVariants = /学校|院校|school|university|college/i.test(identity) ? getSafeEntityVariants(targetText, 'school') : [targetText];
  for (const variant of uniVariants) {
    if (variant === targetText) continue;
    const variantSuccess = await trySelectCustomOptionOnce(triggerEl, variant, fuzzy, signal);
    if (variantSuccess) {
      console.log(`[OpenJobFill] 高校同义词命中: ${targetText} -> ${variant}`);
      return true;
    }
  }

  const majorVariants = /专业|major/i.test(identity) ? getSafeEntityVariants(targetText, 'major') : [targetText];
  for (const variant of majorVariants) {
    if (variant === targetText) continue;
    const variantSuccess = await trySelectCustomOptionOnce(triggerEl, variant, fuzzy, signal);
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
  pathData: string[] | string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!triggerEl) return false;
  throwIfAborted(signal);
  const pathTexts = Array.isArray(pathData) 
    ? pathData 
    : pathData.split(/[-/、>]/).map(s => s.trim()).filter(Boolean);

  if (pathTexts.length === 0) return false;

  const scope = preparePopupScope(triggerEl, CASCADER_ITEM_SELECTORS);
  simulateClick(triggerEl);
  const clicked = new Set<HTMLElement>();
  let previousColumnItems = new Set<HTMLElement>();
  for (let depth = 0; depth < pathTexts.length; depth++) {
    const stepTarget = normalizeOptionText(pathTexts[depth]);
    if (!stepTarget) return false;
    const deadline = Date.now() + 1500;
    let matched: HTMLElement | null = null;
    while (Date.now() < deadline && !matched) {
      throwIfAborted(signal);
      const { items, roots } = scopedOptions(scope);
      const columns = Array.from(new Set(roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(CASCADER_COLUMNS)))))
        .filter(column => isElementVisible(column) && items.some(item => column.contains(item)));
      let candidates = items.filter(item => !clicked.has(item));
      if (columns.length) {
        const column = columns[depth];
        candidates = column ? candidates.filter(item => column.contains(item))
          : candidates.filter(item => !previousColumnItems.has(item));
      }
      candidates = candidates.filter(item => !!normalizeOptionText(item.textContent || ''));
      matched = candidates.find(item => normalizeOptionText(item.textContent || '') === stepTarget) || null;
      if (!matched) {
        // Safe administrative suffix aliases only, never arbitrary substring
        // matching that confuses distinct schools, majors, or empty placeholders.
        const admin = (value: string) => value.length >= 3 ? value.replace(/[省市区县]$/, '') : value;
        const aliases = candidates.filter(item => {
          const text = normalizeOptionText(item.textContent || '');
          return /[省市区县]$/.test(text) || /[省市区县]$/.test(stepTarget)
            ? admin(text) === admin(stepTarget) : false;
        });
        if (aliases.length === 1) matched = aliases[0];
      }
      if (matched) {
        const activeColumn = columns.find(column => column.contains(matched!));
        previousColumnItems = new Set(activeColumn ? items.filter(item => activeColumn.contains(item)) : []);
        break;
      }
      await sleep(50, signal);
    }
    if (!matched) return false;
    clicked.add(matched);
    simulateClick(matched);
    await sleep(100, signal);
  }

  await sleep(150, signal);
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
