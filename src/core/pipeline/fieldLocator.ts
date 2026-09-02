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
  add(buildXPath(el));
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

