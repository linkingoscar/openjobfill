import { getElementWindow, isInputElement, isTextAreaElement, isSelectElement } from '../../utils/dom';

/**
 * 记录被扩展自动填表所触碰过的元素 (短时生命周期 + 跨 frame DOM attribute 标记，防止自动填表自身派发的事件触发自学，同时不影响用户后续手动纠错)
 */
export const lastAutofilledMap = new WeakMap<Element, number>();

export function markElementAsAutofilled(el: Element): void {
  if (el && typeof el === 'object') {
    lastAutofilledMap.set(el, Date.now());
    try {
      el.setAttribute?.('data-openjobfill-autofill', '1');
      setTimeout(() => {
        try {
          el.removeAttribute?.('data-openjobfill-autofill');
        } catch {}
      }, 1000);
    } catch {}
  }
}

export function isAutofillTouched(el: Element): boolean {
  if (!el || typeof el !== 'object') return false;
  if (el.hasAttribute?.('data-openjobfill-autofill')) return true;
  const lastTime = lastAutofilledMap.get(el);
  if (lastTime && Date.now() - lastTime < 1000) return true;
  return false;
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
  if (el.matches(':disabled, [aria-disabled="true"]')) return false;
  el.focus();
  const allowed = el.dispatchEvent(new InputEventClass('beforeinput', {
    bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: stringValue,
  }));
  if (!allowed) { el.blur(); return false; }


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
  if (radioEl.disabled || radioEl.getAttribute('aria-disabled') === 'true') return false;
  if (radioEl.checked === checked) return true;
  // Let the browser perform activation so controlled click handlers and cancellation work.
  // An individual radio cannot be unchecked by a user click.
  if (!checked) return false;
  radioEl.focus();
  radioEl.click();
  radioEl.blur();
  return radioEl.checked === checked;
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
    ? Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)).filter(radio => radio.form === (isInputElement(el) ? el.form : el.closest('form')))
    : Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  for (const radio of groupRadios) {
    if (radio.disabled || radio.getAttribute('aria-disabled') === 'true') continue;
    const radioVal = (radio.value || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
    const radioLabel = (radio.parentElement?.textContent || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');

    if (
      radioVal === stringVal ||
      radioLabel === stringVal
    ) {
      return setNativeRadioChecked(radio, true);
    }
  }

  const customContainer = el.closest('[role="radiogroup"], .radio-group, .el-radio-group, .ant-radio-group, .semi-radio-group, .form-item, .form-group') || el.parentElement || doc;
  const customRadios = Array.from(customContainer.querySelectorAll<HTMLElement>('[role="radio"], [aria-pressed]'));
  if ((el.matches('[role="radio"], [aria-pressed]')) && !customRadios.includes(el)) customRadios.push(el);
  for (const radio of customRadios) {
    if (radio.getAttribute('aria-disabled') === 'true') continue;
    const radioVal = (radio.getAttribute('data-value') || radio.getAttribute('value') || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
    const radioLabel = (radio.textContent || radio.getAttribute('aria-label') || '').toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
    if (radioVal === stringVal || radioLabel === stringVal) {
      simulateClick(radio);
      return true;
    }
  }

  // 严格匹配失败：严禁盲点传入的 radio，直接返回 false 转入 RemainingTask
  return false;
}

export function setCustomCheckboxChecked(checkboxEl: HTMLElement, checkedOrVal: boolean | string | number): boolean {
  const targetChecked = parseBoolean(checkedOrVal);
  if (targetChecked === null) return false;
  const currentChecked = checkboxEl.getAttribute('aria-checked') === 'true' || checkboxEl.getAttribute('aria-pressed') === 'true';
  if (currentChecked !== targetChecked) simulateClick(checkboxEl);
  return true;
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
  if (checkboxEl.disabled || checkboxEl.getAttribute('aria-disabled') === 'true') return false;
  if (checkboxEl.checked !== targetChecked) {
    checkboxEl.focus();
    checkboxEl.click();
    checkboxEl.blur();
  }
  return checkboxEl.checked === targetChecked;
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
