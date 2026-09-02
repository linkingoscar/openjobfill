import type { RepeatableWorkflowConfig } from '../../types/siteProfile';
import { simulateClick } from './dispatcher';
import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';
import { throwIfAborted } from '../pipeline/runContext';

export type SectionWorkflowState =
  | 'FIND_SECTION'
  | 'ENTER_EDIT'
  | 'FILL_RECORD'
  | 'SAVE_RECORD'
  | 'ADD_RECORD'
  | 'WAIT_FOR_EDITOR'
  | 'COMPLETE'
  | 'BLOCKED';

export interface SectionWorkflowStep {
  state: SectionWorkflowState;
  recordIndex: number;
  success: boolean;
  message?: string;
}

export interface SectionWorkflowResult {
  success: boolean;
  completedRecords: number;
  steps: SectionWorkflowStep[];
  failureReason?: string;
}

export interface SectionRecordFillResult {
  canAdvance: boolean;
}

const CONTROL_SELECTOR = 'button, a, [role="button"]';
const EDITABLE_SELECTOR = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';
const DANGEROUS_ACTION = /提交|投递|下一步|继续|submit|apply|next|continue/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/^[+＋]\s*/, '').toLowerCase();
}

function queryFirstVisible(root: ParentNode, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const candidate = Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isElementVisible);
      if (candidate) return candidate;
    } catch {
      // Invalid bundled selectors are rejected by compatibility validation; ignore defensively at runtime.
    }
  }
  return null;
}

function queryVisible(root: ParentNode, selectors: string[]): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of selectors) {
    try {
      for (const candidate of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
        if (isElementVisible(candidate)) candidates.add(candidate);
      }
    } catch {
      // Continue to the next bundled selector.
    }
  }
  return [...candidates];
}

function getVisibleCards(root: HTMLElement, config: RepeatableWorkflowConfig): HTMLElement[] {
  for (const selector of config.itemSelectors) {
    try {
      const cards = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isElementVisible);
      if (cards.length) return cards;
    } catch {
      // Continue to the next bundled selector.
    }
  }
  return [];
}

function findExactAction(root: ParentNode, labels: string[], selectors: string[] = []): HTMLElement | null {
  const allowed = new Set(labels.map(normalizeText));
  const preferred = selectors.length ? queryVisible(root, selectors) : [];
  const fallback = Array.from(root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR));
  return [...new Set([...preferred, ...fallback])].find((candidate) => {
    if (!isElementVisible(candidate)) return false;
    const text = normalizeText(candidate.textContent || candidate.getAttribute('aria-label') || '');
    if (!allowed.has(text) || DANGEROUS_ACTION.test(text)) return false;
    const button = candidate instanceof HTMLButtonElement ? candidate : candidate.closest('button');
    if (button?.type === 'submit') return false;
    const control = candidate.matches(CONTROL_SELECTOR) ? candidate : candidate.closest<HTMLElement>(CONTROL_SELECTOR);
    return candidate.getAttribute('aria-disabled') !== 'true'
      && !candidate.hasAttribute('disabled')
      && control?.getAttribute('aria-disabled') !== 'true'
      && !control?.hasAttribute('disabled');
  }) || null;
}

function sectionTitleMatches(root: HTMLElement, config: RepeatableWorkflowConfig): boolean {
  if (!config.titleLabels?.length) return true;
  if (root.getAttribute('data-section') === config.sectionKey) return true;
  const allowed = config.titleLabels.map(normalizeText);
  const titleCandidates = config.titleSelectors?.length
    ? queryVisible(root, config.titleSelectors)
    : [root];
  return titleCandidates.some((candidate) => {
    const text = normalizeText(candidate.textContent || candidate.getAttribute('aria-label') || '');
    return allowed.some((label) => text === label || text.includes(label));
  });
}

function editorSignature(root: HTMLElement): string {
  return Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR))
    .filter(isElementVisible)
    .map((element) => [
      element.tagName,
      element.id,
      element.getAttribute('name'),
      element.getAttribute('placeholder'),
      element.getAttribute('data-automation-id'),
    ].filter(Boolean).join(':'))
    .join('|');
}

async function waitFor(
  predicate: () => boolean,
  signal?: AbortSignal,
  timeoutMs = 1800,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    throwIfAborted(signal);
    if (predicate()) return true;
    await sleep(80, signal);
  }
  return predicate();
}

export class RepeatableSectionWorkflowRunner {
  findSectionRoot(config: RepeatableWorkflowConfig): HTMLElement | null {
    for (const doc of getAllDocumentsAcrossIframes()) {
      for (const root of queryVisible(doc, config.rootSelectors)) {
        if (sectionTitleMatches(root, config)) return root;
      }
    }
    return null;
  }

  getEditableScope(root: HTMLElement, config: RepeatableWorkflowConfig): HTMLElement {
    const cards = getVisibleCards(root, config);
    const editable = [...cards].reverse().find((card) => !!queryFirstVisible(card, [EDITABLE_SELECTOR]));
    return editable || cards[cards.length - 1] || root;
  }

  private async enterEdit(root: HTMLElement, config: RepeatableWorkflowConfig, signal?: AbortSignal): Promise<boolean> {
    if (queryFirstVisible(root, [EDITABLE_SELECTOR])) return true;
    const cards = getVisibleCards(root, config);
    const scope = cards[cards.length - 1] || root;
    const edit = findExactAction(
      scope,
      config.editButtonLabels || ['编辑', '修改', 'Edit'],
      config.editButtonSelectors,
    );
    if (!edit) return false;
    simulateClick(edit);
    return waitFor(() => !!queryFirstVisible(root, [EDITABLE_SELECTOR]), signal);
  }

  private async save(root: HTMLElement, config: RepeatableWorkflowConfig, signal?: AbortSignal): Promise<boolean> {
    const scope = this.getEditableScope(root, config);
    const before = editorSignature(scope);
    const save = findExactAction(
      scope,
      config.saveButtonLabels || ['保存', '确定', '完成', 'Save'],
      config.saveButtonSelectors,
    ) || findExactAction(
      root,
      config.saveButtonLabels || ['保存', '确定', '完成', 'Save'],
      config.saveButtonSelectors,
    );
    if (!save) return false;
    simulateClick(save);
    return waitFor(() => {
      const after = editorSignature(scope);
      return after !== before || !queryFirstVisible(scope, [EDITABLE_SELECTOR]) || save.getAttribute('aria-disabled') === 'true';
    }, signal);
  }

  private async add(root: HTMLElement, config: RepeatableWorkflowConfig, signal?: AbortSignal): Promise<boolean> {
    const previousCount = getVisibleCards(root, config).length;
    const previousSignature = editorSignature(root);
    const add = findExactAction(
      root,
      config.addButtonLabels || ['新增', '添加', '新增经历', '添加经历', 'Add'],
      config.addButtonSelectors,
    );
    if (!add) return false;
    simulateClick(add);
    return waitFor(() => {
      const currentCount = getVisibleCards(root, config).length;
      const signature = editorSignature(root);
      return currentCount > previousCount || (!!signature && signature !== previousSignature);
    }, signal);
  }

  async run(
    config: RepeatableWorkflowConfig,
    recordCount: number,
    fillRecord: (recordIndex: number, editableScope: HTMLElement) => Promise<SectionRecordFillResult>,
    signal?: AbortSignal,
  ): Promise<SectionWorkflowResult> {
    const steps: SectionWorkflowStep[] = [];
    const blocked = (recordIndex: number, failureReason: string): SectionWorkflowResult => {
      steps.push({ state: 'BLOCKED', recordIndex, success: false, message: failureReason });
      return { success: false, completedRecords, steps, failureReason };
    };
    const maxRecords = Math.min(recordCount, config.maxRecords || 10, 20);
    let completedRecords = 0;
    const root = this.findSectionRoot(config);
    steps.push({ state: 'FIND_SECTION', recordIndex: 0, success: !!root });
    if (!root) return blocked(0, '未找到重复区块');

    for (let index = 0; index < maxRecords; index++) {
      throwIfAborted(signal);
      const editing = await this.enterEdit(root, config, signal);
      steps.push({ state: 'ENTER_EDIT', recordIndex: index, success: editing });
      if (!editing) {
        return blocked(index, `第 ${index + 1} 条记录无法进入编辑状态`);
      }

      const result = await fillRecord(index, this.getEditableScope(root, config));
      steps.push({ state: 'FILL_RECORD', recordIndex: index, success: result.canAdvance });
      if (!result.canAdvance) {
        return blocked(index, `第 ${index + 1} 条记录仍有必填项未完成`);
      }
      completedRecords++;

      const shouldSave = index < maxRecords - 1 || config.saveAfterLast === true;
      if (shouldSave) {
        const saved = await this.save(root, config, signal);
        steps.push({ state: 'SAVE_RECORD', recordIndex: index, success: saved });
        if (!saved) {
          return blocked(index, `第 ${index + 1} 条记录无法确认保存状态`);
        }
      }

      if (index < maxRecords - 1) {
        const added = await this.add(root, config, signal);
        steps.push({ state: 'ADD_RECORD', recordIndex: index + 1, success: added });
        if (!added) {
          return blocked(index + 1, `保存后未能新增第 ${index + 2} 条记录`);
        }
        steps.push({ state: 'WAIT_FOR_EDITOR', recordIndex: index + 1, success: true });
      }
    }

    steps.push({ state: 'COMPLETE', recordIndex: Math.max(0, maxRecords - 1), success: true });
    return { success: true, completedRecords, steps };
  }
}

export const repeatableSectionWorkflowRunner = new RepeatableSectionWorkflowRunner();
