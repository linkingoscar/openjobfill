import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, type EffectScope } from 'vue';
import { useFillSession } from '@/components/composables/useFillSession';
import { formFillerEngine } from '@/core/engine/filler';
import { analyzeRemoteFrames, cancelRemoteFrames } from '@/core/frames/frameCoordinator';
import type { AnalyzedPlan } from '@/core/engine/filler';
import type { StandardResume } from '@/types/resume';
import type { FillResult } from '@/types/adapter';

vi.mock('@/core/engine/filler', () => ({
  AnalyzedPlanStaleError: class extends Error {},
  formFillerEngine: { analyze: vi.fn(), analyzeIncremental: vi.fn(), executePlan: vi.fn(), cancelRun: vi.fn(), cancelActiveRun: vi.fn() },
}));
vi.mock('@/core/frames/frameCoordinator', () => ({ analyzeRemoteFrames: vi.fn(), cancelRemoteFrames: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const resume = { id: 'resume' } as StandardResume;
function plan(id = 'run'): AnalyzedPlan {
  return {
    runId: id, pageUrl: window.location.href, adapterName: 'native',
    plan: { items: [{ id, action: 'FILL', field: { id, label: '姓名' }, targetValue: '张三' }], totalFieldsCount: 1, highConfidenceCount: 1, needsUserCount: 0, skipCount: 0 },
  } as AnalyzedPlan;
}

describe('fill session ownership', () => {
  let scope: EffectScope;
  const options = { loadResume: vi.fn(), present: vi.fn(), persistResult: vi.fn(), persistError: vi.fn() };
  const create = () => scope.run(() => useFillSession(options))!;
  beforeEach(() => {
    vi.resetAllMocks();
    scope = effectScope();
    options.loadResume.mockResolvedValue(resume);
    vi.mocked(formFillerEngine.analyze).mockResolvedValue(plan());
    vi.mocked(analyzeRemoteFrames).mockResolvedValue([]);
  });
  afterEach(() => scope.stop());

  it('only executes a confirmed preview, then owns the result and incremental preview', async () => {
    const session = create();
    await session.analyze();
    expect(formFillerEngine.executePlan).not.toHaveBeenCalled();
    expect(session.previewFillItems.value).toHaveLength(1);
    const filled = { filledCount: 1, logs: [] } as unknown as FillResult;
    vi.mocked(formFillerEngine.executePlan).mockResolvedValue(filled);
    await session.confirmFill();
    expect(session.fillResult.value).toBe(filled);
    expect(session.previewPlan.value).toBeNull();
    expect(options.persistResult).toHaveBeenCalledWith(filled);
    vi.mocked(formFillerEngine.analyzeIncremental).mockResolvedValue(plan('incremental'));
    session.notifyStepChange(window.location.href, [document.createElement('div')]);
    await session.analyzeChangedPage();
    expect(formFillerEngine.analyzeIncremental).toHaveBeenCalled();
    expect(session.fillResult.value).toBeNull();
    expect(session.previewPlan.value?.runId).toBe('incremental');
  });

  it('cancels before resume loading finishes without starting an engine run', async () => {
    const loading = deferred<StandardResume>();
    options.loadResume.mockReturnValue(loading.promise);
    const session = create();
    const pending = session.analyze();
    await vi.waitFor(() => expect(options.loadResume).toHaveBeenCalled());
    await session.cancel();
    loading.resolve(resume);
    await pending;
    expect(formFillerEngine.analyze).not.toHaveBeenCalled();
    expect(session.previewPlan.value).toBeNull();
    expect(session.isFilling.value).toBe(false);
  });

  it('does not let a late cross-frame response replace a newer preview', async () => {
    const frames = deferred<Awaited<ReturnType<typeof analyzeRemoteFrames>>>();
    vi.mocked(analyzeRemoteFrames).mockReturnValueOnce(frames.promise);
    const session = create();
    const old = session.analyze();
    await vi.waitFor(() => expect(analyzeRemoteFrames).toHaveBeenCalledOnce());
    await session.cancel();
    vi.mocked(formFillerEngine.analyze).mockResolvedValueOnce(plan('new'));
    await session.analyze();
    const remote = [{ frameId: 2, analysisId: 'old' }] as Awaited<ReturnType<typeof analyzeRemoteFrames>>;
    frames.resolve(remote);
    await old;
    expect(cancelRemoteFrames).toHaveBeenCalledWith(remote);
    expect(session.previewPlan.value?.runId).toBe('new');
    expect(options.present).toHaveBeenCalledTimes(1);
  });

  it('releases local and remote plans on a resume switch and prevents old execution', async () => {
    const remote = [{ frameId: 2, analysisId: 'preview', items: [] }] as unknown as Awaited<ReturnType<typeof analyzeRemoteFrames>>;
    vi.mocked(analyzeRemoteFrames).mockResolvedValue(remote);
    const session = create();
    await session.analyze();
    await session.invalidateResume();
    await session.confirmFill();
    expect(formFillerEngine.cancelRun).toHaveBeenCalledWith('run', '当前简历已变化');
    expect(cancelRemoteFrames).toHaveBeenCalledWith(remote);
    expect(formFillerEngine.executePlan).not.toHaveBeenCalled();
  });

  it('unmounting cancels execution and ignores its late result', async () => {
    const execution = deferred<FillResult>();
    vi.mocked(formFillerEngine.executePlan).mockReturnValue(execution.promise);
    const session = create();
    await session.analyze();
    const pending = session.confirmFill();
    scope.stop();
    execution.resolve({ filledCount: 1 } as FillResult);
    await pending;
    expect(formFillerEngine.cancelActiveRun).toHaveBeenCalled();
    expect(options.persistResult).not.toHaveBeenCalled();
    expect(session.fillResult.value).toBeNull();
  });

  it('leaves the session usable after analysis fails', async () => {
    vi.mocked(formFillerEngine.analyze).mockRejectedValueOnce(new Error('页面不可用'));
    const session = create();
    await expect(session.analyze()).rejects.toThrow('页面不可用');
    expect(session.isFilling.value).toBe(false);
    expect(session.operationError.value).toBe('页面不可用');
    await session.analyze();
    expect(session.operationError.value).toBe('');
    expect(session.previewPlan.value).not.toBeNull();
  });
});
