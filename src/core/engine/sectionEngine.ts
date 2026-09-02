import type { StandardResume } from '../../types/resume';
import type { PlatformEnhancer } from '../../types/pipeline';
import { autoExpandHeuristicSections, ensureSectionRows } from './repeater';
import { getAllDocumentsAcrossIframes, isElementVisible, sleep } from '../../utils/dom';
import { prepareEditableSections } from './expansionHelper';
import { throwIfAborted } from '../pipeline/runContext';
import type { RepeatableSectionKey, RepeatableWorkflowConfig, RepeatableWorkflowMode } from '../../types/siteProfile';
import { repeatableSectionWorkflowRunner } from './sectionWorkflow';

const GROUP_KEYWORDS: Record<RepeatableSectionKey, string[]> = {
  education: ['教育', '学历', 'education'],
  experience: ['工作', '实习', 'experience', 'employment'],
  project: ['项目', 'project'],
  family: ['家庭', 'family'],
};

export interface SectionCapacityDiagnostic {
  groupKey: RepeatableSectionKey;
  desiredCount: number;
  initialCount: number;
  finalCount: number;
  createdCount: number;
  status: 'satisfied' | 'planned' | 'expanded' | 'failed';
  failureCode?: 'CAPACITY_NOT_REACHED';
}

export interface SectionPreparationAction {
  groupKey: RepeatableSectionKey;
  desiredCount: number;
  initialCount: number;
  mode: RepeatableWorkflowMode;
  workflow?: RepeatableWorkflowConfig;
  summary: string;
}

export interface SectionPreparationPlan {
  actions: SectionPreparationAction[];
  requiresConfirmation: boolean;
}

export class SectionEngine {
  private lastDiagnostics: SectionCapacityDiagnostic[] = [];

  getLastDiagnostics(): SectionCapacityDiagnostic[] {
    return this.lastDiagnostics.map((item) => ({ ...item }));
  }

  private getDesiredGroups(resume: StandardResume): Array<{
    key: RepeatableSectionKey;
    keywords: string[];
    desiredCount: number;
  }> {
    return [
      { key: 'education', keywords: GROUP_KEYWORDS.education, desiredCount: resume.educations?.length || 0 },
      { key: 'experience', keywords: GROUP_KEYWORDS.experience, desiredCount: resume.experiences?.length || 0 },
      { key: 'project', keywords: GROUP_KEYWORDS.project, desiredCount: resume.projects?.length || 0 },
      { key: 'family', keywords: GROUP_KEYWORDS.family, desiredCount: resume.familyMembers?.length || 0 },
    ];
  }

  private hasWorkflowRoot(workflow: RepeatableWorkflowConfig): boolean {
    return !!repeatableSectionWorkflowRunner.findSectionRoot(workflow);
  }

  /** Build a read-only preparation plan. This method never clicks or writes the page. */
  planSectionPreparation(resume: StandardResume, enhancer?: PlatformEnhancer | null): SectionPreparationPlan {
    this.lastDiagnostics = [];
    const actions: SectionPreparationAction[] = [];
    for (const group of this.getDesiredGroups(resume)) {
      if (group.desiredCount === 0) continue;
      const initialCount = this.countExistingSectionCards(group.keywords, enhancer, group.key);
      const workflow = enhancer?.workflowConfigs?.find((candidate) => candidate.sectionKey === group.key);
      const mode = workflow?.mode || 'parallel';
      const needsWorkflow = !!workflow && group.desiredCount > 0 && this.hasWorkflowRoot(workflow);
      const needsExpansion = !workflow && group.desiredCount > initialCount;
      if (needsWorkflow || needsExpansion) {
        actions.push({
          groupKey: group.key,
          desiredCount: group.desiredCount,
          initialCount,
          mode,
          workflow,
          summary: workflow
            ? `${group.key} 将按“填写 → 保存 → 新增”流程处理 ${group.desiredCount} 条记录`
            : `${group.key} 将从 ${initialCount} 条扩展到 ${group.desiredCount} 条`,
        });
      }
      this.lastDiagnostics.push({
        groupKey: group.key,
        desiredCount: group.desiredCount,
        initialCount,
        finalCount: initialCount,
        createdCount: 0,
        status: needsWorkflow || needsExpansion ? 'planned' : 'satisfied',
      });
    }
    return { actions, requiresConfirmation: actions.length > 0 };
  }

  /** Execute only parallel/static preparation after the user has confirmed the preview. */
  async executeParallelPreparation(
    plan: SectionPreparationPlan,
    enhancer?: PlatformEnhancer | null,
    signal?: AbortSignal,
  ): Promise<boolean> {
    throwIfAborted(signal);
    let anyExpanded = false;
    if (plan.actions.length > 0 && await prepareEditableSections(signal) > 0) anyExpanded = true;

    for (const action of plan.actions.filter((candidate) => candidate.mode === 'parallel')) {
      const keywords = GROUP_KEYWORDS[action.groupKey];
      const delta = Math.max(0, action.desiredCount - action.initialCount);
      const expanded = delta > 0 && await this.expandSection(
        action.groupKey,
        keywords,
        action.desiredCount,
        delta,
        enhancer,
        signal,
      );
      if (expanded) anyExpanded = true;
      const finalCount = this.countExistingSectionCards(keywords, enhancer, action.groupKey);
      const diagnostic = this.lastDiagnostics.find((item) => item.groupKey === action.groupKey);
      if (diagnostic) {
        diagnostic.finalCount = finalCount;
        diagnostic.createdCount = Math.max(0, finalCount - diagnostic.initialCount);
        diagnostic.status = finalCount >= action.desiredCount ? 'expanded' : 'failed';
        diagnostic.failureCode = finalCount >= action.desiredCount ? undefined : 'CAPACITY_NOT_REACHED';
      }
    }
    if (anyExpanded) await sleep(150, signal);
    return anyExpanded;
  }

  /**
   * 自动探测页面现有卡片行数，并按需差量点击 "+添加经历" 按钮 (Required - Existing)
   */
  async ensureSectionCapacity(resume: StandardResume, enhancer?: PlatformEnhancer | null, signal?: AbortSignal): Promise<boolean> {
    const plan = this.planSectionPreparation(resume, enhancer);
    return this.executeParallelPreparation(plan, enhancer, signal);
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
