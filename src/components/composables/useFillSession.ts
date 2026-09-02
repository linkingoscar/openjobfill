import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { AnalyzedPlanStaleError, formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { analyzeRemoteFrames, cancelRemoteFrames } from '@/core/frames/frameCoordinator';
import { isFillRunAbortedError } from '@/core/pipeline/runContext';
import { mergeAnalyzedPlans } from '@/core/pipeline/mergeAnalyzedPlans';
import { recordPersonalLearningFeedback } from '@/core/storage/personalLearningFeedback';
import { runPreSubmitConsistencyChecks } from '@/core/ai/preSubmitConsistency';
import type { StandardResume } from '@/types/resume';
import type { FillResult } from '@/types/adapter';

interface FillSessionOptions {
  loadResume: () => Promise<StandardResume>;
  present: (adapterName?: string) => void;
  persistResult: (result: FillResult) => Promise<void>;
  persistError: (phase: 'analysis' | 'execution', error: unknown) => Promise<void>;
}

/** Owns the entire analysis → preview → execution lifecycle. UI receives read-only views. */
export function useFillSession(options: FillSessionOptions) {
  const phase = ref<'idle' | 'analyzing' | 'executing'>('idle');
  const preview = shallowRef<AnalyzedPlan | null>(null);
  const basePlan = shallowRef<AnalyzedPlan | null>(null);
  const lastPlan = shallowRef<AnalyzedPlan | null>(null);
  const result = shallowRef<FillResult | null>(null);
  const error = ref('');
  const notification = ref({ show: false, text: '' });
  let changedRoots: HTMLElement[] = [];
  let revision = 0;
  let disposed = false;
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;
  const isCurrent = (ticket: number) => !disposed && ticket === revision;

  const remoteItems = (action: 'FILL' | 'NEEDS_USER' | 'SKIP') =>
    (preview.value?.remoteFrames || []).flatMap((frame) => frame.items
      .filter((item) => item.action === action)
      .map((item) => ({ ...item, id: `frame-${frame.frameId}-${item.id}`, field: { label: `${item.label}（子页面）` } })));

  const previewFillItems = computed(() => [
    ...(preview.value?.plan.items.filter((item) => item.action === 'FILL') || []),
    ...remoteItems('FILL'),
  ]);

  const previewNeedsUserItems = computed(() => [
    ...(preview.value?.plan.items.filter((item) =>
      item.action === 'NEEDS_USER' || item.decision === 'OPTIONAL_UNMATCHED' || item.decision === 'BLOCKED') || []),
    ...remoteItems('NEEDS_USER'),
    ...remoteItems('SKIP').filter((item) => item.decision === 'OPTIONAL_UNMATCHED' || item.decision === 'BLOCKED'),
  ]);

  const previewWorkflowItems = computed(() => preview.value?.sectionPreparation?.actions || []);

  async function release(plan: AnalyzedPlan | null, reason: string) {
    if (plan?.runId) formFillerEngine.cancelRun(plan.runId, reason);
    if (plan?.remoteFrames?.length) await cancelRemoteFrames(plan.remoteFrames);
  }

  async function cancel(reason = '预览已取消') {
    revision++;
    const previous = preview.value;
    if (phase.value !== 'idle') formFillerEngine.cancelActiveRun(reason);
    preview.value = null;
    basePlan.value = null;
    phase.value = 'idle';
    error.value = '';
    await release(previous, reason);
  }

  async function analyze(incremental = false) {
    if (disposed || phase.value !== 'idle') return { fillCount: 0, needsUserCount: 0 };
    const previous = incremental ? lastPlan.value : null;
    if (incremental && !previous) return { fillCount: 0, needsUserCount: 0 };
    const ticket = ++revision;
    phase.value = 'analyzing';
    result.value = null;
    error.value = '';
    notification.value = { ...notification.value, show: false };
    const oldPreview = preview.value;
    preview.value = null;
    basePlan.value = null;
    let analyzed: AnalyzedPlan | null = null;
    try {
      await release(oldPreview, '重新规划');
      if (!isCurrent(ticket)) return { fillCount: 0, needsUserCount: 0 };
      const resume = await options.loadResume();
      if (!isCurrent(ticket)) return { fillCount: 0, needsUserCount: 0 };
      analyzed = previous
        ? await formFillerEngine.analyzeIncremental(resume, previous, { changedRoots: changedRoots.map((node) => node.parentElement || node) })
        : await formFillerEngine.analyze(resume);
      if (!isCurrent(ticket)) {
        await release(analyzed, '过期分析结果');
        return { fillCount: 0, needsUserCount: 0 };
      }
      if (!previous) analyzed.remoteFrames = await analyzeRemoteFrames(resume.id, { runId: analyzed.runId });
      if (!isCurrent(ticket)) {
        await release(analyzed, '过期子页面分析结果');
        return { fillCount: 0, needsUserCount: 0 };
      }
      preview.value = analyzed;
      basePlan.value = previous;
      const frameCount = analyzed.remoteFrames?.length || 0;
      options.present(frameCount ? `${analyzed.adapterName} + ${frameCount} 个跨域子页面` : analyzed.adapterName);
      return { fillCount: previewFillItems.value.length, needsUserCount: previewNeedsUserItems.value.length };
    } catch (cause) {
      await release(analyzed, '分析失败');
      if (!isCurrent(ticket) || isFillRunAbortedError(cause)) return { fillCount: 0, needsUserCount: 0 };
      error.value = cause instanceof Error ? cause.message : '页面识别失败，请重新规划后再试';
      await options.persistError('analysis', error.value);
      if (isCurrent(ticket)) options.present();
      if (!incremental) throw cause;
      return { fillCount: 0, needsUserCount: 0 };
    } finally {
      if (isCurrent(ticket)) phase.value = 'idle';
    }
  }

  async function addConsistencyIssues(filled: FillResult): Promise<void> {
    if (!filled.plan) return;
    const resume = await options.loadResume();
    const variant = resume as StandardResume & { variantContext?: { company?: string; role?: string } };
    filled.consistencyIssues = runPreSubmitConsistencyChecks({
      resume,
      currentCompany: variant.variantContext?.company,
      currentRole: variant.variantContext?.role,
      pageFields: filled.plan.items
        .filter((item) => item.action === 'FILL')
        .map((item) => ({
          semanticKey: item.semanticKey,
          label: item.field.label,
          value: item.actualValue ?? item.targetValue,
          verificationStatus: item.verificationStatus || 'UNREADABLE',
        })),
    });
  }

  async function confirmFill() {
    if (disposed || phase.value !== 'idle' || !preview.value || (!previewFillItems.value.length && !previewWorkflowItems.value.length)) return;
    const ticket = ++revision;
    const plan = preview.value;
    const previous = basePlan.value;
    phase.value = 'executing';
    error.value = '';
    try {
      const filled = await formFillerEngine.executePlan(plan);
      if (!isCurrent(ticket)) return;
      try {
        await addConsistencyIssues(filled);
      } catch (consistencyError) {
        console.warn('[OpenJobFill] Consistency check was not completed:', consistencyError);
      }
      const executed = { ...plan, plan: filled.plan || plan.plan };
      lastPlan.value = previous ? mergeAnalyzedPlans(previous, executed) : executed;
      result.value = filled;
      preview.value = null;
      basePlan.value = null;
      await options.persistResult(filled);
      try {
        await recordPersonalLearningFeedback(plan.pageUrl || window.location.href, filled);
      } catch (feedbackError) {
        console.warn('[OpenJobFill] Personal learning feedback was not persisted:', feedbackError);
      }
      if (isCurrent(ticket)) options.present();
    } catch (cause) {
      if (!isCurrent(ticket)) return;
      if (isFillRunAbortedError(cause) || cause instanceof AnalyzedPlanStaleError) {
        preview.value = null;
        basePlan.value = null;
        await release(plan, '执行计划已失效');
      }
      if (!isCurrent(ticket) || isFillRunAbortedError(cause)) return;
      error.value = cause instanceof Error ? cause.message : '填写执行失败，请重新识别后再试';
      await options.persistError('execution', error.value);
    } finally {
      if (isCurrent(ticket)) phase.value = 'idle';
    }
  }

  function notifyStepChange(url: string, nodes: HTMLElement[] = []) {
    void cancel('页面步骤已变化');
    changedRoots = nodes;
    const incremental = !!lastPlan.value && url === lastPlan.value.pageUrl && nodes.length > 0;
    notification.value = { show: true, text: incremental ? '检测到新增字段，点击仅填写新增内容' : '点击即可重新规划并填充当前页' };
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => { notification.value = { ...notification.value, show: false }; }, 8000);
  }

  onScopeDispose(() => {
    disposed = true;
    clearTimeout(notificationTimer);
    void cancel('填写界面已卸载');
  });

  return {
    isFilling: computed(() => phase.value !== 'idle'),
    previewPlan: computed(() => preview.value),
    fillResult: computed(() => result.value),
    operationError: computed(() => error.value),
    stepNotification: computed(() => notification.value),
    previewFillItems, previewNeedsUserItems, previewWorkflowItems,
    analyze: () => analyze(), confirmFill, cancel, notifyStepChange,
    analyzeChangedPage: () => analyze(!!lastPlan.value && window.location.href === lastPlan.value.pageUrl && changedRoots.length > 0),
    invalidateResume: async () => {
      lastPlan.value = null;
      changedRoots = [];
      result.value = null;
      notification.value = { show: false, text: '' };
      await cancel('当前简历已变化');
    },
  };
}
