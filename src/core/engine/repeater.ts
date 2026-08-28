import { sleep, isElementVisible } from '../../utils/dom';
import { simulateClick } from './dispatcher';
import type { SectionRepeaterRule } from '../../types/adapter';

/**
 * 动态列表自动增行与索引分发器 (基于显式规则)
 * 当用户的经历条目（如 2 段教育经历）多于页面初始行数时，自动点击 "+ 添加经历" 按钮
 */
export async function ensureSectionRows(
  rule: SectionRepeaterRule,
  requiredCount: number
): Promise<HTMLElement[]> {
  if (requiredCount <= 0) return [];

  const container = document.querySelector<HTMLElement>(rule.containerSelector);
  if (!container) return [];

  let currentItems = Array.from(container.querySelectorAll<HTMLElement>(rule.itemSelector)).filter(
    isElementVisible
  );

  // 如果现有行数少于所需条目数，循环点击添加按钮
  let attempts = 0;
  while (currentItems.length < requiredCount && attempts < 5) {
    const addBtn = container.querySelector<HTMLElement>(rule.addButtonSelector) ||
      document.querySelector<HTMLElement>(rule.addButtonSelector);

    if (addBtn && isElementVisible(addBtn)) {
      simulateClick(addBtn);
      await sleep(400); // 等待 DOM 新行渲染
    } else {
      break;
    }

    currentItems = Array.from(container.querySelectorAll<HTMLElement>(rule.itemSelector)).filter(
      isElementVisible
    );
    attempts++;
  }

  return currentItems;
}

/**
 * 通用启发式经历增行器 (基于语义按钮查找)
 * 扫描页面中包含指定关键词（如“添加教育”、“新增工作”、“添加经历”、“Add Education”）的按钮并按需点击
 */
export async function autoExpandHeuristicSections(
  sectionTitleKeywords: string[],
  requiredCount: number
): Promise<boolean> {
  if (requiredCount <= 1) return false;

  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, a, .btn, [role="button"], span, div'));
  const matchAddButtons = buttons.filter(btn => {
    if (!isElementVisible(btn)) return false;
    const text = (btn.textContent || '').trim().toLowerCase();
    if (text.length > 30) return false;
    const hasAdd = /添加|新增|增加|\+|add|create/i.test(text);
    const hasSection = sectionTitleKeywords.some(k => text.includes(k.toLowerCase()));
    return hasAdd && (hasSection || sectionTitleKeywords.length === 0);
  });

  if (matchAddButtons.length > 0) {
    const targetBtn = matchAddButtons[0];
    let clickedCount = 0;
    // 点击并等待每行渲染
    for (let i = 1; i < requiredCount && i <= 6; i++) {
      simulateClick(targetBtn);
      await sleep(300);
      clickedCount++;
    }
    // 等待 SPA 响应式框架 (Vue / React) 批量虚拟 DOM 更新
    await sleep(200);
    return clickedCount > 0;
  }

  return false;
}

