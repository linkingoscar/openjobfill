import { computed, ref, type Ref } from 'vue';
import { cancelRemoteFrames } from '@/core/frames/frameCoordinator';
import type { FillResult } from '@/types/adapter';
import { AnalyzedPlanStaleError, formFillerEngine, type AnalyzedPlan } from '@/core/engine/filler';
import { isFillRunAbortedError } from '@/core/pipeline/runContext';

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

  const confirmFill = async () => {
    if (!previewPlan.value || previewFillItems.value.length === 0 || isFilling.value) return;
    isFilling.value = true;
    operationError.value = '';
    try {
      const result = await formFillerEngine.executePlan(previewPlan.value!);
      lastPlan.value = previewPlan.value;
      fillResult.value = result;
      await persistFillHistory(result);
      previewPlan.value = null;
      drawerTab.value = 'logs';
    } catch (error) {
      console.error('[OpenJobFill] Execute fill error:', error);
      if (isFillRunAbortedError(error)) {
        previewPlan.value = null;
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
  };

  const handlePreviewManualFill = async () => {
    await cancelPreview();
    await handleManualFill();
  };

  return {
    previewPlan,
    lastPlan,
    previewFillItems,
    previewNeedsUserItems,
    confirmFill,
    cancelPreview,
    handlePreviewManualFill,
  };
}
