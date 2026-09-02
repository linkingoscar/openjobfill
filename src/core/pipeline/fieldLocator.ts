import type { FieldLocatorEvidence, FieldSectionInfo } from '../../types/pipeline';
import { createElementFingerprint } from './runContext';
import { findAssociatedLabelText, generateOptimalSelector, isInputElement } from '../../utils/dom';

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS;
  if (css?.escape) return css.escape(value);
  return value.replace(/([\\"'#.:,[\]()>+~*^$|= ])/g, '\\$1');
}

function directElementIndex(el: HTMLElement): number {
  let index = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === el.tagName) index++;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function buildXPath(el: HTMLElement): string {
  const segments: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 12) {
    segments.unshift(`${current.tagName.toLowerCase()}[${directElementIndex(current)}]`);
    current = current.parentElement;
    depth++;
    if (current?.tagName.toLowerCase() === 'body') {
      segments.unshift('body[1]');
      break;
    }
  }
  return segments.length ? `/${segments.join('/')}` : '';
}

function pagePath(el: HTMLElement): { host: string; path: string } {
  try {
    const location = el.ownerDocument?.defaultView?.location;
    if (!location) return { host: '', path: '' };
    return { host: location.hostname, path: location.pathname };
  } catch {
    return { host: '', path: '' };
  }
}

function uniqueSelectorCandidates(el: HTMLElement): string[] {
  const candidates: string[] = [];
  const add = (selector: string) => {
    if (selector && !candidates.includes(selector)) candidates.push(selector);
  };
  const automationId = el.getAttribute('data-automation-id');
  const testId = el.getAttribute('data-testid');
  const name = el.getAttribute('name');
  if (el.id) add(`#${cssEscape(el.id)}`);
  if (automationId) add(`[data-automation-id="${cssEscape(automationId)}"]`);
  if (testId) add(`[data-testid="${cssEscape(testId)}"]`);
  if (name) add(`[name="${cssEscape(name)}"]`);
  add(generateOptimalSelector(el));
  return candidates.slice(0, 6);
}

/** Build stable, value-free locator evidence for a scanned field. */
export function buildFieldLocator(
  el: HTMLElement,
  section: FieldSectionInfo | undefined,
  label: string,
): FieldLocatorEvidence {
  const path = pagePath(el);
  const sectionTitle = section?.rawTitle || section?.type || '';
  const fingerprint = createElementFingerprint(el, sectionTitle, section?.index || 0);
  const input = isInputElement(el) ? el : null;
  const automationId = el.getAttribute('data-automation-id') || undefined;
  const testId = el.getAttribute('data-testid') || undefined;
  return {
    fingerprint,
    host: path.host,
    path: path.path,
    sectionType: section?.type,
    sectionIndex: section?.index ?? 0,
    sectionTitle: section?.rawTitle,
    label: (label || findAssociatedLabelText(el)).slice(0, 180),
    tagName: el.tagName.toLowerCase(),
    inputType: input?.type || undefined,
    name: el.getAttribute('name') || undefined,
    id: el.id || undefined,
    automationId,
    testId,
    role: el.getAttribute('role') || undefined,
    selectors: uniqueSelectorCandidates(el),
    xpath: buildXPath(el),
  };
}

function querySelectorSafely(root: Document | HTMLElement, selector: string): HTMLElement | null {
  if (!selector || selector.startsWith('/')) return null;
  try {
    return root.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function matchesLocatorShape(element: HTMLElement, evidence: FieldLocatorEvidence): boolean {
  if (evidence.tagName && element.tagName.toLowerCase() !== evidence.tagName.toLowerCase()) return false;
  if (evidence.inputType && isInputElement(element) && element.type !== evidence.inputType) return false;
  if (evidence.name && element.getAttribute('name') !== evidence.name) return false;
  if (evidence.id && element.id !== evidence.id) return false;
  if (evidence.automationId && element.getAttribute('data-automation-id') !== evidence.automationId) return false;
  if (evidence.testId && element.getAttribute('data-testid') !== evidence.testId) return false;
  return true;
}

/**
 * 按定位证据重新找到控件。先使用稳定属性，再尝试 XPath/生成选择器，
 * 最后用标签、name/id 等结构形状过滤候选，供 SPA 重渲染和离线回放复用。
 */
export function locateFieldByEvidence(
  root: Document | HTMLElement,
  evidence: FieldLocatorEvidence,
): HTMLElement | null {
  const selectors = [
    evidence.id ? `#${cssEscape(evidence.id)}` : '',
    evidence.automationId ? `[data-automation-id="${cssEscape(evidence.automationId)}"]` : '',
    evidence.testId ? `[data-testid="${cssEscape(evidence.testId)}"]` : '',
    evidence.name ? `[name="${cssEscape(evidence.name)}"]` : '',
    ...(evidence.selectors || []),
  ];
  for (const selector of selectors) {
    const candidate = querySelectorSafely(root, selector);
    if (candidate && matchesLocatorShape(candidate, evidence)) return candidate;
  }

  if (evidence.xpath) {
    try {
      const ownerDocument = root instanceof Document ? root : root.ownerDocument;
      const result = ownerDocument?.evaluate(evidence.xpath, root instanceof Document ? root : root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (result instanceof HTMLElement && matchesLocatorShape(result, evidence)) return result;
    } catch {
      // A stale XPath is expected after a framework rerender; continue with a shape scan.
    }
  }

  const candidates = Array.from(root.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable="true"], [role="combobox"]'));
  return candidates.find((candidate) => matchesLocatorShape(candidate, evidence)) || null;
}
