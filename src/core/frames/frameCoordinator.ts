import type { FillResult, FillLogItem } from '../../types/adapter';
import type { RemoteFramePlan, RemoteFillPlanItem, RemainingTaskItem } from '../../types/pipeline';
import type { AnalyzedPlan } from '../engine/filler';
import { FillRunAbortedError } from '../pipeline/runContext';

interface RemoteExecutionResult {
  frameId: number;
  url: string;
  success: boolean;
  filledCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  logs: FillLogItem[];
  remainingTasks: Array<Omit<RemainingTaskItem, 'element'>>;
}

export interface FrameNavigationDetails {
  frameId: number;
  parentFrameId: number;
  url: string;
}

function getFrameOrigin(url: string): string | null {
  if (!url || url === 'about:blank' || url === 'about:srcdoc') return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * 只选择“跨源边界”的根 frame。边界内部的同源后代由各自 PageAnalyzer
 * 递归扫描，避免同一个字段被父、子 content script 重复规划。
 */
export function selectCrossOriginFrameRoots(frames: FrameNavigationDetails[]): Array<{ frameId: number; url: string }> {
  const byId = new Map(frames.map((frame) => [frame.frameId, frame]));
  return frames
    .filter((frame) => frame.frameId !== 0)
    .filter((frame) => {
      const parent = byId.get(frame.parentFrameId);
      if (!parent) return true;
      const frameOrigin = getFrameOrigin(frame.url);
      const parentOrigin = getFrameOrigin(parent.url);
      // about:blank/srcdoc 继承父源，由父文档的递归扫描覆盖。
      if (!frameOrigin || !parentOrigin) return false;
      return frameOrigin !== parentOrigin;
    })
    .map((frame) => ({ frameId: frame.frameId, url: frame.url }));
}

function canCoordinateFrames(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.runtime?.sendMessage;
}

export function serializeAnalyzedPlan(
  analyzed: AnalyzedPlan,
  analysisId: string,
  frameId = -1,
  url = location.href
): RemoteFramePlan {
  const items: RemoteFillPlanItem[] = analyzed.plan.items.map((item) => ({
    id: item.id,
    label: item.field.label || item.field.placeholder || item.field.name || '未命名输入框',
    type: item.field.type,
    required: item.field.required,
    action: item.action,
    targetValue: item.targetValue,
    confidence: item.confidence,
    reason: item.reason,
    semanticKey: item.semanticKey,
    source: item.source,
    fingerprint: item.field.fingerprint,
    locator: item.field.locator,
  }));

  return {
    frameId,
    analysisId,
    runId: analyzed.runId,
    pageFingerprint: analyzed.pageFingerprint,
    resumeId: analyzed.resumeId,
    resumeUpdatedAt: analyzed.resumeUpdatedAt,
    pageUrl: analyzed.pageUrl || url,
    url,
    adapterName: analyzed.adapterName,
    items,
    highConfidenceCount: analyzed.plan.highConfidenceCount,
    needsUserCount: analyzed.plan.needsUserCount,
    skipCount: analyzed.plan.skipCount,
  };
}

export function serializeExecutionResult(result: FillResult, url = location.href): Omit<RemoteExecutionResult, 'frameId'> {
  return {
    url,
    success: result.success,
    filledCount: result.filledCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
    durationMs: result.durationMs,
    logs: result.logs,
    remainingTasks: (result.remainingTasks || []).map((task) => ({
      id: task.id,
      label: task.label,
      type: task.type,
      required: task.required,
      reason: task.reason,
      frameUrl: url,
      fingerprint: task.fingerprint,
      locator: task.locator,
    })),
  };
}

export async function analyzeRemoteFrames(
  resumeId: string,
  options: { runId?: string; signal?: AbortSignal } = {},
): Promise<RemoteFramePlan[]> {
  if (!canCoordinateFrames() || window !== window.top) return [];

  try {
    const request = chrome.runtime.sendMessage({
      type: 'ANALYZE_CROSS_ORIGIN_FRAMES',
      payload: { resumeId, runId: options.runId },
    });
    const response = await raceWithSignal(request, options.signal);
    if (!response?.success || !Array.isArray(response.plans)) {
      console.warn('[OpenJobFill Frames] Cross-origin frame analysis failed:', response?.error || 'invalid response');
      return [];
    }
    return response.plans;
  } catch (err) {
    if (options.signal?.aborted) throw err;
    console.warn('[OpenJobFill Frames] Cross-origin frame analysis unavailable:', err);
    return [];
  }
}

export async function executeRemoteFrames(
  plans: RemoteFramePlan[],
  options: { runId?: string; signal?: AbortSignal } = {},
): Promise<RemoteExecutionResult[]> {
  if (!canCoordinateFrames() || plans.length === 0 || window !== window.top) return [];

  const abortHandler = () => {
    void cancelRemoteFrames(plans);
  };
  options.signal?.addEventListener('abort', abortHandler, { once: true });
  try {
    const request = chrome.runtime.sendMessage({
      type: 'EXECUTE_CROSS_ORIGIN_FRAMES',
      payload: {
        targets: plans.map((plan) => ({ frameId: plan.frameId, analysisId: plan.analysisId })),
      },
    });
    const response = await raceWithSignal(request, options.signal);
    const results: RemoteExecutionResult[] = response?.success && Array.isArray(response.results)
      ? response.results
      : [];
    const completedFrameIds = new Set(results.map((result) => result.frameId));

    for (const plan of plans) {
      if (completedFrameIds.has(plan.frameId)) continue;
      const unresolved = plan.items.filter((item) => item.action !== 'SKIP');
      results.push({
        frameId: plan.frameId,
        url: plan.url,
        success: false,
        filledCount: 0,
        skippedCount: plan.skipCount,
        failedCount: unresolved.length,
        durationMs: 0,
        logs: [{
          field: '',
          label: '跨域子页面',
          value: '',
          status: 'failed',
          message: '子页面已刷新、跳转或无法响应，请重新识别后再试',
        }],
        remainingTasks: unresolved.map((item) => ({
          id: `frame-${plan.frameId}-${item.id}`,
          label: item.label,
          type: item.type,
          required: item.required,
          reason: '子页面计划已失效，请在当前步骤重新识别',
          frameUrl: plan.url,
        })),
      });
    }

    return results;
  } catch (err) {
    if (options.signal?.aborted) throw err;
    console.warn('[OpenJobFill Frames] Cross-origin frame execution unavailable:', err);
    return [];
  } finally {
    options.signal?.removeEventListener('abort', abortHandler);
  }
}

export async function cancelRemoteFrames(plans: RemoteFramePlan[]): Promise<void> {
  if (!canCoordinateFrames() || plans.length === 0 || window !== window.top) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'CANCEL_CROSS_ORIGIN_FRAMES',
      payload: {
        targets: plans.map((plan) => ({ frameId: plan.frameId, analysisId: plan.analysisId })),
      },
    });
  } catch {
    // 取消只负责释放子 frame 的临时计划；frame 已卸载时无需提示用户。
  }
}

async function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new FillRunAbortedError('填写已取消');
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new FillRunAbortedError('填写已取消'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
