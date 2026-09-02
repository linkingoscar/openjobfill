import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';
import { simulateClick } from './dispatcher';
import { throwIfAborted } from '../pipeline/runContext';

const COLLAPSED_SELECTOR = [
  '.ant-collapse-header[aria-expanded="false"]',
  '.el-collapse-item__header:not(.is-active)',
  '.panel-heading.collapsed',
  '[data-toggle="collapse"].collapsed',
  '.accordion-button.collapsed',
  '[role="button"][aria-expanded="false"]',
].join(',');

const EDIT_CONTAINER_SELECTOR = [
  '.education-card',
  '.experience-card',
  '.project-card',
  '.family-card',
  '.ant-card',
  '.el-card',
  '[class*="experience"]',
  '[class*="education"]',
].join(',');

/**
 * 在规划前展开折叠区与只读经历卡片。
 * 只点击“展开/编辑/修改”类控件，不点击保存、提交或新增，保持预览阶段无持久化副作用。
 */
export async function prepareEditableSections(signal?: AbortSignal): Promise<number> {
  let changed = 0;
  const clicked = new Set<HTMLElement>();

  for (const doc of getAllDocumentsAcrossIframes()) {
    throwIfAborted(signal);
    const collapsed = Array.from(doc.querySelectorAll<HTMLElement>(COLLAPSED_SELECTOR));
    for (const control of collapsed) {
      if (!isElementVisible(control) || clicked.has(control)) continue;
      throwIfAborted(signal);
      simulateClick(control);
      clicked.add(control);
      changed++;
    }

    const containers = Array.from(doc.querySelectorAll<HTMLElement>(EDIT_CONTAINER_SELECTOR));
    for (const container of containers) {
      if (container.querySelector('input:not([type="hidden"]), textarea, select, [contenteditable="true"]')) continue;
      const control = Array.from(container.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
        .find((candidate) => /^(编辑|修改|edit)$/i.test((candidate.textContent || '').trim()));
      if (!control || !isElementVisible(control) || clicked.has(control)) continue;
      throwIfAborted(signal);
      simulateClick(control);
      clicked.add(control);
      changed++;
    }
  }

  if (changed > 0) await sleep(180, signal);
  return changed;
}
