import { sleep, getAllDocumentsAcrossIframes, isElementVisible } from '../../utils/dom';
import { simulateClick } from './dispatcher';
import type { SectionRepeaterRule } from '../../types/adapter';
import { throwIfAborted } from '../pipeline/runContext';
import { findRepeatableSections, findSectionAddControl, isSafeAddControl } from './repeatableSections';

async function waitForAddedCard(count: () => number, previousCount: number, signal?: AbortSignal): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1800) {
    throwIfAborted(signal);
    if (count() > previousCount) return true;
    await sleep(80, signal);
  }
  return count() > previousCount;
}

/** Add exactly the missing records, rebinding after every SPA render. */
export async function ensureSectionRows(rule: SectionRepeaterRule, requiredCount: number, signal?: AbortSignal): Promise<HTMLElement[]> {
  if (!Number.isInteger(requiredCount) || requiredCount <= 0) return [];
  const read = () => {
    const containers = getAllDocumentsAcrossIframes()
      .flatMap(doc => Array.from(doc.querySelectorAll<HTMLElement>(rule.containerSelector)))
      .filter(isElementVisible);
    const container = containers.length === 1 ? containers[0] : null;
    return { container, items: container ? Array.from(container.querySelectorAll<HTMLElement>(rule.itemSelector)).filter(isElementVisible) : [] };
  };
  let current = read();
  while (current.container && current.items.length < requiredCount) {
    throwIfAborted(signal);
    const add = current.container.querySelector<HTMLElement>(rule.addButtonSelector);
    if (!add || !isSafeAddControl(add)) break;
    const previousCount = current.items.length;
    simulateClick(add);
    // A click is not proof of a new record. Do not click again after no progress.
    if (!await waitForAddedCard(() => read().items.length, previousCount, signal)) break;
    current = read();
  }
  return read().items;
}

/** Match bare “+ 添加” by its section heading, then verify each new card. */
export async function autoExpandHeuristicSections(sectionTitleKeywords: readonly string[], requiredCount: number, signal?: AbortSignal): Promise<boolean> {
  if (!Number.isInteger(requiredCount) || requiredCount <= 0) return false;
  const read = () => {
    const sections = findRepeatableSections(sectionTitleKeywords);
    return sections.length === 1 ? sections[0] : null;
  };
  let current = read();
  const initialCount = current?.cards.length || 0;
  while (current && current.cards.length < requiredCount) {
    throwIfAborted(signal);
    const add = findSectionAddControl(current.root);
    if (!add) break;
    const previousCount = current.cards.length;
    simulateClick(add);
    if (!await waitForAddedCard(() => read()?.cards.length || 0, previousCount, signal)) break;
    current = read();
  }
  return (read()?.cards.length || 0) > initialCount;
}
