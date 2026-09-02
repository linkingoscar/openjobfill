import { computed, ref, type Ref } from 'vue';
import { cancelRemoteFrames } from '@/core/frames/frameCoordinator';
import type { FillResult } from '@/types/adapter';
import { AnalyzedPlanStaleError, formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { isFillRunAbortedError } from '@/core/pipeline/runContext';
import type { FillPlan } from '@/types/pipeline';

export type DrawerTab = 'logs' | 'review' | 'clipboard' | 'jdMatch';

/** 填表规划的预览、确认和取消边界，避免与悬浮球定位/历史状态耦合。 */
export function useFillPreview(
  isFilling: Ref<boolean>,
  fillResult: Ref<FillResult | null>,
  operationError: Ref<string>,
  drawerTab: Ref<DrawerTab>,
  persistFillHistory: (result: FillResult) => Promise<void>,
  persistOperationError: (phase: 'analysis' | 'execution', error: unknown) => Promise<void>,
  handleManualFill: () => Promise<void>,
) {
  const previewPlan = ref<AnalyzedPlan | null>(null);
  const lastPlan = ref<AnalyzedPlan | null>(null);
  const previewBasePlan = ref<AnalyzedPlan | null>(null);

  const planItemKey = (item: FillPlan['items'][number]) =>
    `${item.field.fingerprint || item.field.id}|${item.field.label}|${item.field.section?.type || ''}:${item.field.section?.index || 0}`;

  const mergePlans = (base: AnalyzedPlan, incremental: AnalyzedPlan): AnalyzedPlan => {
    const items = [...base.plan.items, ...incremental.plan.items].filter((item, index, all) =>
      all.findIndex((candidate) => planItemKey(candidate) === planItemKey(item)) === index,
    );
    const plan: FillPlan = {
      items,
      totalFieldsCount: items.length,
      highConfidenceCount: items.filter((item) => item.action === 'FILL').length,
      needsUserCount: items.filter((item) => item.action === 'NEEDS_USER').length,
      skipCount: items.filter((item) => item.action === 'SKIP').length,
    };
    return {
      ...incremental,
      plan,
      remoteFrames: base.remoteFrames || incremental.remoteFrames,
    };
  };

  const setPreviewPlan = (plan: AnalyzedPlan, basePlan: AnalyzedPlan | null = null) => {
    previewPlan.value = plan;
    previewBasePlan.value = basePlan;
  };

  const getRemotePreviewItems = (action: 'FILL' | 'NEEDS_USER') =>
    (previewPlan.value?.remoteFrames || []).flatMap((frame) =>
      frame.items
        .filter((item) => item.action === action)
        .map((item) => ({
          ...item,
          id: `frame-${frame.frameId}-${item.id}`,
          field: { label: `${item.label}（子页面）` },
        })),
    );

  const previewFillItems = computed(() => [
    ...(previewPlan.value?.plan.items.filter((item) => item.action === 'FILL') ?? []),
    ...getRemotePreviewItems('FILL'),
  ]);
  const previewNeedsUserItems = computed(() => [
    ...(previewPlan.value?.plan.items.filter((item) => item.action === 'NEEDS_USER') ?? []),
    ...getRemotePreviewItems('NEEDS_USER'),
  ]);
  const previewWorkflowItems = computed(() => previewPlan.value?.sectionPreparation?.actions || []);

  const confirmFill = async () => {
    if (!previewPlan.value
      || (previewFillItems.value.length === 0 && previewWorkflowItems.value.length === 0)
      || isFilling.value) return;
    isFilling.value = true;
    operationError.value = '';
    try {
      const result = await formFillerEngine.executePlan(previewPlan.value!);
      const executedPlan = { ...previewPlan.value, plan: result.plan || previewPlan.value.plan };
      lastPlan.value = previewBasePlan.value
        ? mergePlans(previewBasePlan.value, executedPlan)
        : executedPlan;
      fillResult.value = result;
      await persistFillHistory(result);
      previewPlan.value = null;
      previewBasePlan.value = null;
      drawerTab.value = 'logs';
    } catch (error) {
      console.error('[OpenJobFill] Execute fill error:', error);
      if (isFillRunAbortedError(error)) {
        previewPlan.value = null;
        previewBasePlan.value = null;
        fillResult.value = null;
        operationError.value = '';
        drawerTab.value = 'logs';
        return;
      }
      if (error instanceof AnalyzedPlanStaleError) {
        // 子 frame 的临时计划也一并释放，避免旧 analysisId 在 frame 中残留。
        await cancelPreview();
      }
      operationError.value = error instanceof Error ? error.message : '填写执行失败，请重新识别后再试';
      await persistOperationError('execution', operationError.value);
    } finally {
      isFilling.value = false;
    }
  };

  const cancelPreview = async () => {
    if (previewPlan.value?.runId) {
      formFillerEngine.cancelRun(previewPlan.value.runId, '预览已取消');
    }
    if (previewPlan.value?.remoteFrames?.length) {
      await cancelRemoteFrames(previewPlan.value.remoteFrames);
    }
    previewPlan.value = null;
    previewBasePlan.value = null;
  };

  const handlePreviewManualFill = async () => {
    await cancelPreview();
    await handleManualFill();
  };

  return {
    previewPlan,
    setPreviewPlan,
    lastPlan,
    previewFillItems,
    previewNeedsUserItems,
    previewWorkflowItems,
    confirmFill,
    cancelPreview,
    handlePreviewManualFill,
  };
}
