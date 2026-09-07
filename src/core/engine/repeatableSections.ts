import type { RepeatableSectionKey } from '../../types/siteProfile';
import { getAllDocumentsAcrossIframes, getPageText, isElementVisible } from '../../utils/dom';

export const REPEATABLE_SECTIONS = {
  education: { label: '教育经历', keywords: ['教育', '学历', 'education'], resumeKey: 'educations' },
  experience: { label: '实习／工作经历', keywords: ['工作经历', '实习', '工作经验', 'experience', 'employment'], resumeKey: 'experiences' },
  project: { label: '项目经历', keywords: ['项目', 'project'], resumeKey: 'projects' },
  family: { label: '家庭成员', keywords: ['家庭', 'family'], resumeKey: 'familyMembers' },
  award: { label: '获奖经历', keywords: ['获奖', '荣誉', '奖励', 'awards', 'honors'], resumeKey: 'awards' },
} as const satisfies Record<RepeatableSectionKey, { label: string; keywords: readonly string[]; resumeKey: string }>;

const CONTROLS = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"], [role="combobox"]';
const TITLES = 'h1, h2, h3, h4, h5, h6, legend, [class*="title"], [class*="Title"], [class*="header"], [class*="Header"]';
const ACTIONS = 'button, a, [role="button"], span, div';
const CARDS = '.card, .form-card, .list-item, .dynamic-row, .repeater-item, [class*="-card"], [class*="-item-wrapper"], [data-record], [data-record-index]';

function visible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || !isElementVisible(current)) return false;
  }
  return true;
}

function titleMatches(element: HTMLElement, keywords: readonly string[]): boolean {
  const text = getPageText(element).toLowerCase();
  return visible(element) && !element.querySelector(CONTROLS) && text.length <= 60
    && !/[*＊]|必填/.test(text) && keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

export function isSafeAddControl(element: HTMLElement): boolean {
  const text = (element.getAttribute('aria-label') || getPageText(element)).trim();
  if (!visible(element) || element.querySelector(CONTROLS) || text.length > 40) return false;
  if (!/^(?:[+＋]\s*)?(?:添加|新增|增加|add|create)(?:\s|一条|一段|教育|学历|工作|实习|项目|经历|家庭|成员|获奖|荣誉|记录|education|experience|project|award|family|$)/i.test(text)
    && !/^[+＋]$/.test(text)) return false;
  if (/提交|投递|下一步|删除|支付|submit|apply|next|delete|pay/i.test(text)) return false;
  const control = element.closest<HTMLElement>('button, a, [role="button"]') || element;
  if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return false;
  if (control.tagName === 'BUTTON' && (control as HTMLButtonElement).type === 'submit' && (control as HTMLButtonElement).form) return false;
  if (control.tagName === 'A') {
    const href = control.getAttribute('href');
    if (href && href !== '#' && !/^javascript:\s*void\(0\);?$/.test(href)) return false;
  }
  return true;
}

export function findSectionAddControl(root: HTMLElement): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(ACTIONS)).filter(isSafeAddControl);
  // Prefer the actual button/link; don't click both it and its nested icon/text.
  return candidates.find(candidate => candidate.matches('button, a, [role="button"]'))
    || candidates.find(candidate => !candidates.some(other => candidate !== other && candidate.contains(other))) || null;
}

export function getSectionCards(root: HTMLElement): HTMLElement[] {
  const hasControls = (element: HTMLElement) => !!element.querySelector(CONTROLS) && visible(element);
  const explicit = Array.from(root.querySelectorAll<HTMLElement>(CARDS)).filter(hasControls);
  const topCards = explicit.filter(card => !explicit.some(other => card !== other && other.contains(card)));
  if (topCards.length) return topCards;

  // CSS-module cards may have no stable name. Each “删除本条” anchors one
  // record, and its nearest ancestor containing form controls is that record.
  const removers = Array.from(root.querySelectorAll<HTMLElement>(ACTIONS)).filter(element =>
    visible(element) && /^(删除本条|删除该条|删除此条|移除本条|删除|remove|delete)$/i.test(getPageText(element)),
  );
  const cards = new Set<HTMLElement>();
  for (const remover of removers.filter(element => !removers.some(other => element !== other && element.contains(other)))) {
    let card = remover.parentElement;
    while (card && card !== root && !hasControls(card)) card = card.parentElement;
    if (card && card !== root) cards.add(card);
  }
  if (cards.size) return [...cards].filter(card => ![...cards].some(other => other !== card && other.contains(card)));

  // Repeated wrappers with identical field layouts are records, not arbitrary
  // sibling form rows. Require at least two controls to avoid year/month pairs.
  for (const container of [root, ...Array.from(root.querySelectorAll<HTMLElement>('div, ul, ol'))]) {
    const children = Array.from(container.children).filter((child): child is HTMLElement => hasControls(child as HTMLElement));
    if (children.length < 2) continue;
    const signature = (child: HTMLElement) => Array.from(child.querySelectorAll<HTMLElement>(CONTROLS))
      .map(control => [control.tagName, control.getAttribute('type'), control.getAttribute('placeholder'), control.getAttribute('aria-label')].join(':')).join('|');
    if (children.every(child => child.querySelectorAll(CONTROLS).length >= 2)
      && children.every(child => signature(child) === signature(children[0]))) return children;
  }
  if (!hasControls(root)) return [];
  // A single unnamed card may be wrapped several times. Keep a scope that
  // contains all its fields so the scanner and the capacity counter agree.
  let single = root;
  while (true) {
    const children = Array.from(single.children).filter(child => hasControls(child as HTMLElement)) as HTMLElement[];
    if (children.length !== 1) break;
    single = children[0];
  }
  return [single];
}

export interface RepeatableSection {
  root: HTMLElement;
  cards: HTMLElement[];
}

/** Discover a local section; never borrow another section's add button. */
export function findRepeatableSections(keywords: readonly string[], documents = getAllDocumentsAcrossIframes()): RepeatableSection[] {
  const roots = new Set<HTMLElement>();
  for (const doc of documents) {
    const titles = Array.from(doc.querySelectorAll<HTMLElement>(TITLES)).filter(element => titleMatches(element, keywords));
    for (const title of titles.filter(element => !titles.some(other => element !== other && element.contains(other)))) {
      let candidate = title.parentElement;
      let fallback: HTMLElement | null = null;
      while (candidate && !candidate.matches('body, html')) {
        // A form that is itself one section is valid; a form containing any
        // other heading is not a section boundary for a bare add button.
        if (candidate.matches('form, [role="form"]') && Array.from(candidate.querySelectorAll<HTMLElement>(TITLES))
          .some(element => getPageText(element) && !titleMatches(element, keywords))) break;
        const otherTitle = Array.from(candidate.querySelectorAll<HTMLElement>(TITLES)).some(element =>
          !title.contains(element) && !element.contains(title)
          && (Object.values(REPEATABLE_SECTIONS).some(group => titleMatches(element, group.keywords))
            || element.matches('h1, h2, h3, h4, h5, h6, legend')
            || /^(基本信息|个人信息|语言能力|证书|技能|学生工作|校园经历|附件)/.test(getPageText(element)))
          && !titleMatches(element, keywords),
        );
        if (otherTitle) break;
        if (candidate.querySelector(CONTROLS)) {
          fallback ||= candidate;
          if (findSectionAddControl(candidate)) { fallback = candidate; break; }
        } else if (candidate.matches('section, fieldset, [data-section], [class*="section"], [class*="block"]') && findSectionAddControl(candidate)) {
          fallback = candidate;
          break;
        }
        candidate = candidate.parentElement;
      }
      if (fallback) roots.add(fallback);
    }
  }
  return [...roots].filter(root => ![...roots].some(other => other !== root && other.contains(root)))
    .map(root => ({ root, cards: getSectionCards(root) }));
}
