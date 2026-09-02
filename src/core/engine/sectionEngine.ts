import type { StandardResume } from '../../types/resume';
import type { PlatformEnhancer } from '../../types/pipeline';
import { autoExpandHeuristicSections, ensureSectionRows } from './repeater';
import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';
import { prepareEditableSections } from './expansionHelper';
import { throwIfAborted } from '../pipeline/runContext';

export interface SectionCapacityDiagnostic {
  groupKey: 'education' | 'experience' | 'project' | 'family';
  desiredCount: number;
  initialCount: number;
  finalCount: number;
  createdCount: number;
  status: 'satisfied' | 'expanded' | 'failed';
  failureCode?: 'CAPACITY_NOT_REACHED';
}

export class SectionEngine {
  private lastDiagnostics: SectionCapacityDiagnostic[] = [];

  getLastDiagnostics(): SectionCapacityDiagnostic[] {
    return this.lastDiagnostics.map((item) => ({ ...item }));
  }

  /**
   * 自动探测页面现有卡片行数，并按需差量点击 "+添加经历" 按钮 (Required - Existing)
   */
  async ensureSectionCapacity(resume: StandardResume, enhancer?: PlatformEnhancer | null, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);
    this.lastDiagnostics = [];
    let anyExpanded = false;
    if (await prepareEditableSections(signal) > 0) anyExpanded = true;

    const groups: Array<{
      key: SectionCapacityDiagnostic['groupKey'];
      keywords: string[];
      desiredCount: number;
    }> = [
      { key: 'education', keywords: ['教育', '学历', 'education'], desiredCount: resume.educations?.length || 0 },
      { key: 'experience', keywords: ['工作', '实习', 'experience', 'employment'], desiredCount: resume.experiences?.length || 0 },
      { key: 'project', keywords: ['项目', 'project'], desiredCount: resume.projects?.length || 0 },
      { key: 'family', keywords: ['家庭', 'family'], desiredCount: resume.familyMembers?.length || 0 },
    ];

    for (const group of groups) {
      if (group.desiredCount === 0) continue;
      const initialCount = this.countExistingSectionCards(group.keywords, enhancer, group.key);
      let expanded = false;
      if (group.desiredCount > 1 && group.desiredCount > initialCount) {
        expanded = await this.expandSection(
          group.key,
          group.keywords,
          group.desiredCount,
          group.desiredCount - initialCount,
          enhancer,
          signal,
        );
        if (expanded) anyExpanded = true;
      }
      const finalCount = expanded
        ? this.countExistingSectionCards(group.keywords, enhancer, group.key)
        : initialCount;
      const reached = finalCount >= group.desiredCount;
      this.lastDiagnostics.push({
        groupKey: group.key,
        desiredCount: group.desiredCount,
        initialCount,
        finalCount,
        createdCount: Math.max(0, finalCount - initialCount),
        status: reached ? (finalCount > initialCount ? 'expanded' : 'satisfied') : 'failed',
        failureCode: reached ? undefined : 'CAPACITY_NOT_REACHED',
      });
    }

    if (anyExpanded) {
      // 额外等待 150ms 确保 Vue/React/Angular 虚拟 DOM 挂载完成
      await sleep(150, signal);
    }

    return anyExpanded;
  }

  private async expandSection(
    sectionKey: 'education' | 'experience' | 'project' | 'family',
    keywords: string[],
    requiredCount: number,
    delta: number,
    enhancer?: PlatformEnhancer | null,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const config = enhancer?.repeaterConfigs?.[sectionKey];
    if (config?.sectionRoot && config.itemSelector && config.addButton) {
      const rows = await ensureSectionRows({
        containerSelector: config.sectionRoot,
        itemSelector: config.itemSelector,
        addButtonSelector: config.addButton,
        itemFields: {},
      }, requiredCount, signal);
      if (rows.length >= requiredCount) return true;
      if (rows.length > 0) delta = Math.max(0, requiredCount - rows.length);
    }

    if (delta <= 0) return true;
    return autoExpandHeuristicSections(keywords, delta + 1, signal);
  }

  /**
   * 统计页面当前已渲染的指定模块卡片数量
   * 策略：优先读取 Enhancer 声明式 Repeater 规则；Fallback 采用 Section Root / 兄弟节点截断定位
   */
  private countExistingSectionCards(
    keywords: string[],
    enhancer?: PlatformEnhancer | null,
    sectionKey?: 'education' | 'experience' | 'project' | 'family'
  ): number {
    const documents = getAllDocumentsAcrossIframes();

    // 0. 优先尝试 PlatformEnhancer 专属卡片计数配置
    if (enhancer && enhancer.repeaterConfigs && sectionKey && enhancer.repeaterConfigs[sectionKey]) {
      const config = enhancer.repeaterConfigs[sectionKey]!;
      if (config.sectionRoot) {
        for (const doc of documents) {
          const root = doc.querySelector<HTMLElement>(config.sectionRoot);
          if (root && isElementVisible(root)) {
            if (config.itemSelector) {
              const items = Array.from(root.querySelectorAll<HTMLElement>(config.itemSelector)).filter(isElementVisible);
              if (items.length > 0) {
                return items.length;
              }
            }
          }
        }
      }
    }

    // 1. 定位模块标题节点
    const titleCandidates = documents.flatMap((doc) =>
      Array.from(
        doc.querySelectorAll<HTMLElement>(
          'h1, h2, h3, h4, h5, h6, .section-title, .title, legend, [class*="title"], [class*="header"], .ant-form-item-label'
        )
      ).filter((el) => {
        if (!isElementVisible(el)) return false;
        const text = (el.textContent || '').trim().toLowerCase();
        return keywords.some((k) => text.includes(k.toLowerCase()));
      })
    );

    if (titleCandidates.length === 0) {
      return 1;
    }

    const titleEl = titleCandidates[0];

    // 2. 定位具体的局部 Section 容器 (严禁向上退到全局 <form> 或 <body>)
    let sectionRoot =
      titleEl.closest<HTMLElement>(
        'section, fieldset, .form-section, [class*="section"], [class*="block"], .el-card, .ant-card, .semi-card'
      );

    const cardSelectors = [
      '.card, .form-card, .section-card, .list-item, .dynamic-row, .repeater-item, [class*="card"], [class*="item-wrapper"], [class*="item_wrapper"]',
      '.el-card, .ant-card, .semi-card, [class*="repeater"]',
    ];

    if (sectionRoot) {
      // 在局部 Section Root 内部查找卡片
      const childCards = Array.from(sectionRoot.querySelectorAll<HTMLElement>(cardSelectors.join(','))).filter(
        (c) => {
          if (!isElementVisible(c)) return false;
          return !!c.querySelector('input, textarea, select, [contenteditable="true"]');
        }
      );

      if (childCards.length > 0) {
        const leafCards = childCards.filter(
          (card) => !childCards.some((other) => other !== card && card.contains(other))
        );
        return Math.max(1, leafCards.length);
      }
    } else {
      // 3. 兄弟节点截断策略：如果没有明确的 section 容器，只收集从当前标题到下一个大标题之间的兄弟卡片
      let curr = titleEl.nextElementSibling as HTMLElement | null;
      let siblingCards: HTMLElement[] = [];

      while (curr) {
        // 如果遇到下一个模块标题，立即截断停止
        if (curr.matches('h1, h2, h3, h4, h5, h6, legend, .section-title, [class*="title"], [class*="header"]')) {
          break;
        }

        if (isElementVisible(curr)) {
          if (curr.matches(cardSelectors.join(',')) && curr.querySelector('input, textarea, select')) {
            siblingCards.push(curr);
          } else {
            const nested = Array.from(curr.querySelectorAll<HTMLElement>(cardSelectors.join(','))).filter(
              (c) => isElementVisible(c) && !!c.querySelector('input, textarea, select')
            );
            siblingCards.push(...nested);
          }
        }

        curr = curr.nextElementSibling as HTMLElement | null;
      }

      if (siblingCards.length > 0) {
        const leafCards = siblingCards.filter(
          (card) => !siblingCards.some((other) => other !== card && card.contains(other))
        );
        return Math.max(1, leafCards.length);
      }
    }

    return 1;
  }
}

export const sectionEngine = new SectionEngine();
