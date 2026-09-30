export type MainWorldPayload = {
  action: 'TYPE' | 'SELECT_TEXT' | 'SELECT_PATH';
  selectors: string[];
  value: string | string[];
};

/** Fixed, self-contained MAIN-world driver. Never accepts source code or arbitrary event names. */
export async function runMainWorldControlAction(payload: MainWorldPayload): Promise<{ success: boolean; reason?: string }> {
  const findTarget = (): HTMLElement | null => {
    for (const selector of payload.selectors) {
      try {
        const candidate = document.querySelector<HTMLElement>(selector);
        if (candidate) return candidate;
      } catch {}
    }
    return null;
  };
  const visible = (element: HTMLElement): boolean => {
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (ancestor.hidden || ancestor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    if (element.matches(':disabled, [aria-disabled="true"], .disabled, [class*="-disabled"]')) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0'
      && rect.width > 0
      && rect.height > 0;
  };
  const normalize = (value: string): string => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const dispatchClick = (element: HTMLElement): void => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
  };
  const setText = (element: HTMLElement, value: string): boolean => {
    const writable = element.matches('input, textarea, [contenteditable="true"]')
      ? element
      : element.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, [contenteditable="true"]');
    if (!writable) return false;
    if (writable instanceof HTMLInputElement && ['password', 'file', 'hidden'].includes(writable.type)) return false;
    if (writable.matches(':disabled, [aria-disabled="true"], [readonly]')) return false;
    writable.focus();
    if (!writable.dispatchEvent(new InputEvent('beforeinput', {bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: value}))) { writable.blur(); return false; }
    if (writable instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) return false;
      setter.call(writable, value);
      const tracker = (writable as HTMLInputElement & { _valueTracker?: { setValue(value: string): void } })._valueTracker;
      tracker?.setValue('');
    } else if (writable instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) return false;
      setter.call(writable, value);
    } else {
      writable.textContent = value;
    }
    try {
      writable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    } catch {
      writable.dispatchEvent(new Event('input', { bubbles: true }));
    }
    writable.dispatchEvent(new Event('change', { bubbles: true }));
    writable.blur();
    return true;
  };
  const target = findTarget();
  if (!target) return { success: false, reason: 'target_not_found' };
  const optionSelector = [
    '[role="option"]', '[role="menuitem"]', '[role="treeitem"]',
    '.ant-select-item-option', '.ant-cascader-menu-item', '.el-select-dropdown__item', '.el-cascader-node',
    '.semi-select-option', '.mtd-select-item', '.ivu-select-item', '.ivu-cascader-menu-item',
    '.layui-form-select dd', '.moka-select-item', '.moka-option', '.phoenix-select-option',
    '.sc-select-option', '.pop-panel td', '.dialog-box li', '[class*="option-item"]', '[class*="cascader-item"]',
  ].join(',');
  const associatedRoots = (): HTMLElement[] => {
    const owners = [target, ...Array.from(target.querySelectorAll<HTMLElement>('[aria-controls], [aria-owns]'))];
    const ids = owners.flatMap(owner => [owner.getAttribute('aria-controls'), owner.getAttribute('aria-owns')]).filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
    return ids.map(id => document.getElementById(id)).filter((root): root is HTMLElement => !!root);
  };
  const hasAssociation = () => target.matches('[aria-controls], [aria-owns]') || !!target.querySelector('[aria-controls], [aria-owns]');
  const existingOptions = new Set(Array.from(document.querySelectorAll<HTMLElement>(optionSelector)).filter(visible));
  const clickedOptions = new Set<HTMLElement>();
  const waitForOption = async (wanted: string): Promise<HTMLElement | null> => {
    const expected = normalize(wanted);
    for (let attempt = 0; attempt < 24; attempt++) {
      const roots = associatedRoots();
      const candidates = (roots.length ? roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(optionSelector)))
        : hasAssociation() ? [] : Array.from(document.querySelectorAll<HTMLElement>(optionSelector)).filter(option => !existingOptions.has(option) || target.contains(option)))
        .filter(option => visible(option) && !clickedOptions.has(option));
      const exact = candidates.find((candidate) => normalize(candidate.textContent || '') === expected);
      if (expected && exact) return exact;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  };

  if (payload.action === 'TYPE') {
    if (Array.isArray(payload.value)) return { success: false, reason: 'invalid_value' };
    return { success: setText(target, payload.value) };
  }

  const values = Array.isArray(payload.value) ? payload.value : [payload.value];
  if (values.length === 0) return { success: false, reason: 'invalid_value' };
  const searchInput = target.matches('input:not([readonly])')
    ? target
    : target.querySelector<HTMLElement>('input:not([readonly])');
  dispatchClick(searchInput || target);
  if (payload.action === 'SELECT_TEXT' && searchInput) setText(searchInput, values[0]);

  for (const value of values) {
    const option = await waitForOption(value);
    if (!option) return { success: false, reason: 'option_not_found' };
    if (option.getAttribute('aria-selected') !== 'true') dispatchClick(option);
    clickedOptions.add(option);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return { success: true };
}

