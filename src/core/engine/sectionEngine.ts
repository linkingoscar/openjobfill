import type { StandardResume } from '../../types/resume';
import type { PlatformEnhancer } from '../../types/pipeline';
import { autoExpandHeuristicSections, ensureSectionRows } from './repeater';
import { getAllDocumentsAcrossIframes, isElementVisible } from '../../utils/dom';
import { prepareEditableSections } from './expansionHelper';
import { throwIfAborted } from '../pipeline/runContext';
import type { RepeatableSectionKey, RepeatableWorkflowConfig, RepeatableWorkflowMode } from '../../types/siteProfile';
import { repeatableSectionWorkflowRunner } from './sectionWorkflow';
import { findRepeatableSections, REPEATABLE_SECTIONS } from './repeatableSections';

export interface SectionCapacityDiagnostic {
  groupKey: RepeatableSectionKey;
  desiredCount: number;
  initialCount: number;
  finalCount: number;
  createdCount: number;
  status: 'satisfied' | 'planned' | 'expanded' | 'failed' | 'unavailable';
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
    return this.lastDiagnostics.map(item => ({ ...item }));
  }

  /** Preview is read-only; normal fill confirmation also authorizes adding the listed records. */
  planSectionPreparation(resume: StandardResume, enhancer?: PlatformEnhancer | null): SectionPreparationPlan {
    this.lastDiagnostics = [];
    const actions: SectionPreparationAction[] = [];
    for (const key of Object.keys(REPEATABLE_SECTIONS) as RepeatableSectionKey[]) {
      const group = REPEATABLE_SECTIONS[key];
      const desiredCount = resume[group.resumeKey]?.length || 0;
      if (!desiredCount) continue;
      const existingCount = this.countExistingSectionCards(group.keywords, enhancer, key);
      const workflow = enhancer?.workflowConfigs?.find(candidate => candidate.sectionKey === key);
      const needsWorkflow = !!workflow && !!repeatableSectionWorkflowRunner.findSectionRoot(workflow);
      const available = existingCount !== null || needsWorkflow;
      const initialCount = existingCount || 0;
      const needsExpansion = available && !workflow && desiredCount > initialCount;
      if (needsWorkflow || needsExpansion) {
        actions.push({
          groupKey: key, desiredCount, initialCount, mode: workflow?.mode || 'parallel', workflow,
          summary: workflow
            ? `${group.label}：逐条填写、保存并新增，共 ${desiredCount} 条`
            : `${group.label}：简历 ${desiredCount} 条，页面已有 ${initialCount} 条，将添加 ${desiredCount - initialCount} 条并逐条填写`,
        });
      }
      this.lastDiagnostics.push({
        groupKey: key, desiredCount, initialCount, finalCount: initialCount, createdCount: 0,
        status: !available ? 'unavailable' : needsWorkflow || needsExpansion ? 'planned' : 'satisfied',
      });
    }
    return { actions, requiresConfirmation: actions.length > 0 };
  }

  async executeParallelPreparation(plan: SectionPreparationPlan, enhancer?: PlatformEnhancer | null, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);
    let changed = false;
    if (plan.actions.length && await prepareEditableSections(signal) > 0) changed = true;
    for (const action of plan.actions.filter(candidate => candidate.mode === 'parallel')) {
      const keywords = REPEATABLE_SECTIONS[action.groupKey].keywords;
      const before = this.countExistingSectionCards(keywords, enhancer, action.groupKey) || 0;
      if (before < action.desiredCount) {
        const config = enhancer?.repeaterConfigs?.[action.groupKey];
        const configuredRoots = config?.sectionRoot ? getAllDocumentsAcrossIframes().flatMap(doc =>
          Array.from(doc.querySelectorAll<HTMLElement>(config.sectionRoot!)).filter(isElementVisible),
        ) : [];
        if (configuredRoots.length && config?.sectionRoot && config.itemSelector && config.addButton) {
          await ensureSectionRows({ containerSelector: config.sectionRoot, itemSelector: config.itemSelector, addButtonSelector: config.addButton, itemFields: {} }, action.desiredCount, signal);
        } else {
          await autoExpandHeuristicSections(keywords, action.desiredCount, signal);
        }
      }
      const finalCount = this.countExistingSectionCards(keywords, enhancer, action.groupKey) || 0;
      changed ||= finalCount > before;
      const diagnostic: SectionCapacityDiagnostic = {
        groupKey: action.groupKey, desiredCount: action.desiredCount, initialCount: action.initialCount,
        finalCount, createdCount: Math.max(0, finalCount - action.initialCount),
        status: finalCount >= action.desiredCount ? 'expanded' : 'failed',
        ...(finalCount < action.desiredCount ? { failureCode: 'CAPACITY_NOT_REACHED' as const } : {}),
      };
      const index = this.lastDiagnostics.findIndex(item => item.groupKey === action.groupKey);
      if (index === -1) this.lastDiagnostics.push(diagnostic);
      else this.lastDiagnostics[index] = diagnostic;
    }
    return changed;
  }

  async ensureSectionCapacity(resume: StandardResume, enhancer?: PlatformEnhancer | null, signal?: AbortSignal): Promise<boolean> {
    return this.executeParallelPreparation(this.planSectionPreparation(resume, enhancer), enhancer, signal);
  }

  /** null means no unambiguous matching section; zero means a visible empty section. */
  private countExistingSectionCards(keywords: readonly string[], enhancer?: PlatformEnhancer | null, sectionKey?: RepeatableSectionKey): number | null {
    const config = sectionKey ? enhancer?.repeaterConfigs?.[sectionKey] : undefined;
    if (config?.sectionRoot && config.itemSelector) {
      const roots = getAllDocumentsAcrossIframes().flatMap(doc =>
        Array.from(doc.querySelectorAll<HTMLElement>(config.sectionRoot!)).filter(isElementVisible),
      );
      if (roots.length === 1) return Array.from(roots[0].querySelectorAll<HTMLElement>(config.itemSelector)).filter(isElementVisible).length;
      if (roots.length > 1) return null;
    }
    const sections = findRepeatableSections(keywords);
    return sections.length === 1 ? sections[0].cards.length : null;
  }
}

export const sectionEngine = new SectionEngine();
