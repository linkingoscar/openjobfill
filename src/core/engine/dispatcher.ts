import { getElementWindow, isInputElement, isTextAreaElement, isSelectElement } from '../../utils/dom';

/**
 * 记录被扩展自动填表所触碰过的元素集合 (防止自动派发 change/input 事件被 SmartLearner 误学回去)
 */
export const autofillTouchedElements = new WeakSet<Element>();

export function markElementAsAutofilled(el: Element): void {
  if (el && typeof el === 'object') {
    autofillTouchedElements.add(el);
  }
}

export function isAutofillTouched(el: Element): boolean {
  return autofillTouchedElements.has(el);
}

export function setNativeValue(
  el: HTMLElement,
  value: string | number
): boolean {
  if (!el) return false;

  markElementAsAutofilled(el);
  const win = getElementWindow(el) as any;
  const EventClass = win.Event || (typeof Event !== 'undefined' ? Event : function(t: string) { return { type: t }; } as any);
  const InputEventClass = win.InputEvent || (typeof InputEvent !== 'undefined' ? InputEvent : EventClass);

  const stringValue = String(value);

  // 1. 针对富文本编辑器 (contenteditable) 的特殊处理
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    el.focus();
    const selection = win.getSelection?.() || window.getSelection();
    const doc = el.ownerDocument || document;
    const range = doc.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = doc.execCommand?.('insertText', false, stringValue);
    if (!inserted) {
      el.innerText = stringValue;
    }

    el.dispatchEvent(new InputEventClass('input', { bubbles: true, cancelable: true, composed: true, data: stringValue }));
    el.dispatchEvent(new EventClass('change', { bubbles: true }));
    el.blur();
    return true;
  }

  if (!isInputElement(el) && !isTextAreaElement(el)) {
    return false;
  }

  // 2. 触发 focus 事件
  el.focus();

  // 3. 针对 React 16/17/18 的 _valueTracker 内部跟踪重置
  const tracker = (el as any)._valueTracker;
  if (tracker) {
    tracker.setValue('');
  }

  // 4. 从元素自身所在的 Window 原型链获取原生 setter (支持 same-origin iframe)
  const prototype = isTextAreaElement(el)
    ? win.HTMLTextAreaElement?.prototype
    : win.HTMLInputElement?.prototype;

  const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
  const nativeSetter = descriptor ? descriptor.set : null;

  if (nativeSetter) {
    nativeSetter.call(el, stringValue);
  } else {
    (el as HTMLInputElement | HTMLTextAreaElement).value = stringValue;
  }

  // 5. 连续派发完整的事件链 (beforeinput -> input -> change -> blur)
  try {
    el.dispatchEvent(new InputEventClass('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: stringValue,
    }));
  } catch (e) {}

  const inputEvent = new InputEventClass('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: stringValue,
  });
  el.dispatchEvent(inputEvent);

  const changeEvent = new EventClass('change', {
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

  markElementAsAutofilled(radioEl);
  const win = getElementWindow(radioEl) as any;
  const EventClass = win.Event || (typeof Event !== 'undefined' ? Event : function(t: string) { return { type: t }; } as any);

  radioEl.focus();

  const prototype = win.HTMLInputElement?.prototype || (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement.prototype : null);
  const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'checked') : null;
  if (descriptor && descriptor.set) {
    descriptor.set.call(radioEl, checked);
  } else {
    radioEl.checked = checked;
  }

  radioEl.dispatchEvent(new EventClass('input', { bubbles: true, cancelable: true }));
  radioEl.dispatchEvent(new EventClass('change', { bubbles: true, cancelable: true }));
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
  const doc = el.ownerDocument || document;
  const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || doc;
  
  const groupRadios = name
    ? Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`))
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

  markElementAsAutofilled(checkboxEl);
  const win = getElementWindow(checkboxEl) as any;
  const EventClass = win.Event || (typeof Event !== 'undefined' ? Event : function(t: string) { return { type: t }; } as any);

  if (checkboxEl.checked !== targetChecked) {
    checkboxEl.focus();
    checkboxEl.click();
    checkboxEl.checked = targetChecked;
    checkboxEl.dispatchEvent(new EventClass('input', { bubbles: true, cancelable: true }));
    checkboxEl.dispatchEvent(new EventClass('change', { bubbles: true, cancelable: true }));
    checkboxEl.blur();
  }

  return true;
}

/**
 * 模拟鼠标点击
 */
export function simulateClick(el: HTMLElement): void {
  markElementAsAutofilled(el);
  const win = getElementWindow(el) as any;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  const MouseEventClass = win.MouseEvent || (typeof MouseEvent !== 'undefined' ? MouseEvent : function(t: string) { return { type: t }; } as any);
  const mousedown = new MouseEventClass('mousedown', { bubbles: true, cancelable: true, view: win });
  const mouseup = new MouseEventClass('mouseup', { bubbles: true, cancelable: true, view: win });
  const click = new MouseEventClass('click', { bubbles: true, cancelable: true, view: win });

  el.dispatchEvent(mousedown);
  el.dispatchEvent(mouseup);
  el.dispatchEvent(click);
}
