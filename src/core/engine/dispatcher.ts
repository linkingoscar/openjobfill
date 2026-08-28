/**
 * 事件穿透与原生 Setter 劫持核心
 * 彻底解决 React, Vue, Angular, Svelte 等受控表单组件 input.value 赋值后状态不更新的问题
 */

export function setNativeValue(
  el: HTMLElement,
  value: string | number
): boolean {
  if (!el) return false;

  const stringValue = String(value);

  // 1. 针对富文本编辑器 (contenteditable) 的特殊处理
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = document.execCommand('insertText', false, stringValue);
    if (!inserted) {
      el.innerText = stringValue;
    }

    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, data: stringValue }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }

  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return false;
  }

  // 2. 触发 focus 事件
  el.focus();

  // 3. 针对 React 16/17/18 的 _valueTracker 内部跟踪重置 (解决 React onChange 吞事件问题)
  const tracker = (el as any)._valueTracker;
  if (tracker) {
    tracker.setValue('');
  }

  // 4. 获取 HTMLInputElement 或 HTMLTextAreaElement 原型链上的原生 setter
  const prototype = el instanceof HTMLTextAreaElement 
    ? window.HTMLTextAreaElement.prototype 
    : window.HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const nativeSetter = descriptor ? descriptor.set : null;

  if (nativeSetter) {
    nativeSetter.call(el, stringValue);
  } else {
    el.value = stringValue;
  }

  // 5. 连续派发完整的事件链 (beforeinput -> input -> change -> blur)
  try {
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: stringValue,
    }));
  } catch (e) {}

  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: stringValue,
  });
  el.dispatchEvent(inputEvent);

  const changeEvent = new Event('change', {
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(changeEvent);

  // 6. 触发 blur 事件完成受控校验
  el.blur();

  return true;
}

/**
 * 模拟对单选框 (Radio) 的点击选择
 */
export function setNativeRadioChecked(radioEl: HTMLInputElement, checked = true): boolean {
  if (!radioEl) return false;

  radioEl.focus();

  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
  if (descriptor && descriptor.set) {
    descriptor.set.call(radioEl, checked);
  } else {
    radioEl.checked = checked;
  }

  radioEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  radioEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  radioEl.click();
  radioEl.blur();

  return true;
}

/**
 * 在同组单选框 (Radio Group) 中，根据 targetValue 定位目标选项并选中
 */
export function setRadioGroupValue(el: HTMLElement, targetValue: string): boolean {
  if (!el || !targetValue) return false;

  const stringVal = String(targetValue).toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
  const name = el.getAttribute('name');
  const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || document;
  
  const groupRadios = name
    ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`))
    : Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  for (const radio of groupRadios) {
    const radioVal = (radio.value || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
    const radioLabel = (radio.parentElement?.textContent || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');

    if (
      radioVal === stringVal ||
      radioLabel === stringVal ||
      (stringVal.length >= 1 && (radioVal.includes(stringVal) || radioLabel.includes(stringVal)))
    ) {
      return setNativeRadioChecked(radio, true);
    }
  }

  // 严格匹配失败：严禁盲点传入的 radio，直接返回 false 转入 RemainingTask
  return false;
}

/**
 * 严格三态布尔值解析 (Explicit Yes -> true, Explicit No -> false, Ambiguous/Unknown -> null)
 */
export function parseBoolean(checkedOrVal: any): boolean | null {
  if (typeof checkedOrVal === 'boolean') return checkedOrVal;
  if (checkedOrVal === undefined || checkedOrVal === null) return null;
  const s = String(checkedOrVal).trim().toLowerCase();
  if (['是', 'yes', 'y', 'true', '1', 'checked', '同意', '接受', '正确'].includes(s)) {
    return true;
  }
  if (['否', 'no', 'n', 'false', '0', '不同意', '拒绝', '错误', '无'].includes(s)) {
    return false;
  }
  return null; // 模糊词（如“不确定”、“视情况而定”）返回 null
}

/**
 * 模拟对复选框 (Checkbox) 的勾选 (严格三态布尔值解析)
 */
export function setNativeCheckboxChecked(checkboxEl: HTMLInputElement, checkedOrVal: boolean | string | number): boolean {
  if (!checkboxEl) return false;

  const targetChecked = parseBoolean(checkedOrVal);
  if (targetChecked === null) {
    console.warn(`[OpenJobFill] Checkbox value "${checkedOrVal}" is ambiguous, refusing to guess.`);
    return false; // 拒绝盲猜，触发验证失败转入待办
  }

  if (checkboxEl.checked !== targetChecked) {
    checkboxEl.focus();
    checkboxEl.click();
    checkboxEl.checked = targetChecked;
    checkboxEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    checkboxEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    checkboxEl.blur();
  }

  return true;
}

/**
 * 模拟鼠标点击
 */
export function simulateClick(el: HTMLElement): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
  const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

  el.dispatchEvent(mousedown);
  el.dispatchEvent(mouseup);
  el.dispatchEvent(click);
}
