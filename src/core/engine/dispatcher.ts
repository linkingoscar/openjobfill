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
 * 模拟对复选框 (Checkbox) 的勾选
 */
export function setNativeCheckboxChecked(checkboxEl: HTMLInputElement, checked: boolean): boolean {
  if (!checkboxEl) return false;

  if (checkboxEl.checked !== checked) {
    checkboxEl.focus();
    checkboxEl.click();
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
