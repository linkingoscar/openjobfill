import { findAssociatedLabelText, isElementVisible, isInputElement, isTextAreaElement } from '../../utils/dom';
import { inspectFieldSafety } from '../pipeline/fieldSafety';

/** Remember page focus across interactions with the extension's Shadow DOM. */
export function createPageFocusTracker(doc: Document = document) {
  let recent: HTMLInputElement | HTMLTextAreaElement | null = null;
  const isExtension = (element: Element): boolean => {
    let current: Element | null = element;
    while (current) {
      if (current.id === 'openjobfill-extension-host') return true;
      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  };
  const eligible = (element: unknown): element is HTMLInputElement | HTMLTextAreaElement => {
    if (!(element instanceof Element) || isExtension(element)) return false;
    if (!isInputElement(element) && !isTextAreaElement(element)) return false;
    if (!element.isConnected || element.disabled || element.readOnly || element.matches(':disabled')) return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || !isElementVisible(ancestor)) return false;
    }
    if (isInputElement(element) && !['text', 'email', 'tel', 'url', 'number', 'date', 'month', 'search'].includes(element.type)) return false;
    return !inspectFieldSafety(element, findAssociatedLabelText(element) || '', element.closest('.el-form-item, .ant-form-item, .form-item, .form-group, fieldset, tr')?.textContent || '').blocked;
  };
  const onFocus = (event: FocusEvent) => {
    const target = event.composedPath()[0];
    if (target instanceof Element && isExtension(target)) return;
    // Focusing another page control cancels the previous destination.
    recent = eligible(target) ? target : null;
  };
  return {
    start() { doc.addEventListener('focusin', onFocus, true); if (eligible(doc.activeElement)) recent = doc.activeElement; },
    stop() { doc.removeEventListener('focusin', onFocus, true); recent = null; },
    getTarget() {
      if (eligible(doc.activeElement)) return doc.activeElement;
      if (!eligible(recent)) recent = null;
      return recent;
    },
  };
}
