import type { StandardResume } from '../../types/resume';
import type { FillResult } from '../../types/adapter';
import type { PipelineExecutionResult, FillPlan, RemoteFramePlan } from '../../types/pipeline';
import { pageAnalyzer } from '../pipeline/pageAnalyzer';
import { planGenerator } from '../pipeline/planGenerator';
import { pipelineExecutor } from '../pipeline/executor';
import { sectionEngine } from './sectionEngine';
import { getEnhancerForUrl } from '../adapters/enhancers';
import { ruleStorage } from '../storage/ruleStorage';
import { resumeStorage } from '../storage/resumeStorage';
import { scanMissingRequiredFields, scanAttachmentDropzones } from './badgeDecorator';
import { applyAIFallbackToPlan } from '../ai/aiFallback';
import { executeRemoteFrames } from '../frames/frameCoordinator';
import { compactFieldSnapshot, compactPlanSnapshot, SnapshotRecorder } from '../pipeline/snapshotRecorder';
import { createPageFingerprint, FillRunContext, throwIfAborted } from '../pipeline/runContext';

/** analyze 阶段的产物：一份尚未执行的填表规划，可预览、可确认后再执行 */
export interface AnalyzedPlan {
  plan: FillPlan;
  adapterName: string;
  /** 用于防止简历编辑或切换后继续执行旧预览。 */
  resumeId: string;
  resumeUpdatedAt: number;
  /** 用于防止 SPA 步骤切换或页面替换后继续执行旧预览。 */
  pageUrl: string;
  /** 运行级取消与页面结构一致性标识。 */
  runId: string;
  pageFingerprint: string;
  remoteFrames?: RemoteFramePlan[];
}

/** 预览期间页面或简历发生变化时，阻止写入旧计划。 */
export class AnalyzedPlanStaleError extends Error {
  constructor(reason = '当前页面或简历已发生变化，预览已失效，请重新识别后再试') {
    super(reason);
    this.name = 'AnalyzedPlanStaleError';
  }
}

function isExtensionStorageAvailable(): boolean {
  return typeof chrome !== 'undefined'
    && !!chrome.runtime?.id
    && !!chrome.storage?.local;
}

function isAttachedElement(element: HTMLElement): boolean {
  if (typeof element.isConnected === 'boolean') return element.isConnected;
  return !!element.ownerDocument?.contains(element);
}

/**
 * 在任何 DOM 写入前验证分析快照仍然适用。
 *
 * 页面地址和节点连接性在所有运行环境都校验；简历更新时间只在真实扩展
 * 上下文读取持久化数据，避免单元测试或独立调用方被强制绑定到 Chrome API。
 */
async function assertAnalyzedPlanIsCurrent(analyzed: AnalyzedPlan): Promise<void> {
  if (analyzed.pageUrl && typeof window !== 'undefined' && window.location.href !== analyzed.pageUrl) {
    throw new AnalyzedPlanStaleError('当前页面步骤已变化，预览已失效，请重新识别后再试');
  }

  const detachedField = analyzed.plan.items.find(
    (item) => item.action !== 'SKIP' && !isAttachedElement(item.field.element),
  );
  if (detachedField) {
    throw new AnalyzedPlanStaleError('当前表单已刷新，预览已失效，请重新识别后再试');
  }

  if (analyzed.pageFingerprint && typeof document !== 'undefined'
    && createPageFingerprint(document) !== analyzed.pageFingerprint) {
    throw new AnalyzedPlanStaleError('当前表单结构已变化，预览已失效，请重新识别后再试');
  }

  if (!isExtensionStorageAvailable() || !analyzed.resumeId) return;

  let currentResume: StandardResume | undefined;
  try {
    currentResume = (await resumeStorage.getAllResumes()).find((resume) => resume.id === analyzed.resumeId);
  } catch {
    throw new AnalyzedPlanStaleError('暂时无法校验当前简历，请重新识别后再试');
  }

  if (!currentResume || currentResume.updatedAt !== analyzed.resumeUpdatedAt) {
    throw new AnalyzedPlanStaleError('当前简历已更新或切换，预览已失效，请重新识别后再试');
  }
}

export class FormFillerEngine {
  private readonly activeRuns = new Map<string, FillRunContext>();
  private activeRunId: string | null = null;

  getActiveRunId(): string | null {
    return this.activeRunId;
  }

  cancelRun(runId: string, reason = '填写已取消'): void {
    this.activeRuns.get(runId)?.abort(reason);
  }

  cancelActiveRun(reason = '填写已取消'): void {
    if (this.activeRunId) this.cancelRun(this.activeRunId, reason);
  }
  /**
   * 阶段一 + 阶段二：扫描页面并生成填表规划（不写入 DOM）
   *
   * 拆出此方法是为了支持「先预览、确认后再填写」的交互：
   * 调用方拿到规划后可以先展示给用户核对，再决定是否 executePlan。
   */
  async analyze(resume: StandardResume, options: { runId?: string } = {}): Promise<AnalyzedPlan> {
    // 同一 content script 同时只允许一条本地运行链，避免用户重新点击
    // 识别后旧的等待器继续占用 DOM 或在稍后恢复写入。
    if (this.activeRunId) {
      const previousRunId = this.activeRunId;
      this.cancelRun(previousRunId, '新的填写任务已开始');
      this.activeRuns.delete(previousRunId);
    }
    const run = new FillRunContext({ runId: options.runId });
    this.activeRuns.set(run.runId, run);
    this.activeRunId = run.runId;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const analysisStartedAt = Date.now();
    SnapshotRecorder.start(currentUrl, typeof document !== 'undefined' ? document.title : '', run.runId);
    let completed = false;
    try {
      run.throwIfAborted();
    // 1. 获取当前页面匹配的平台增强器 (Platform Enhancer)
    const enhancer = getEnhancerForUrl(currentUrl, typeof document !== 'undefined' ? document : undefined);
    if (enhancer) {
      console.log(`[OpenJobFill Pipeline] Matched Platform Enhancer: ${enhancer.name} (${enhancer.id})`);
      if (enhancer.onBeforePlan) {
        await enhancer.onBeforePlan(resume, typeof document !== 'undefined' ? document : undefined, run.signal);
      }
    }

    // 2. 全局通用多经历卡片差量扩增 (SectionEngine)
    try {
      await sectionEngine.ensureSectionCapacity(resume, enhancer, run.signal);
    } catch (err) {
      if (run.signal.aborted) throw err;
      console.warn('[OpenJobFill Pipeline] SectionEngine expansion warning:', err);
    }

    // 3. 加载用户针对当前站点的自定义规则
    const customRule = await ruleStorage.findMatchingRuleForUrl(currentUrl);
    const customFieldRules = customRule ? customRule.fields : [];

    // 4. 阶段一：页面全要素深度扫描 (Page Analyzer 重新扫描最新挂载的 DOM 节点)
    run.throwIfAborted();
    const descriptors = pageAnalyzer.analyzePage(document);
    SnapshotRecorder.record('scan', {
      totalCandidateCount: descriptors.length,
      fields: compactFieldSnapshot(descriptors),
    }, Date.now() - analysisStartedAt, run.runId);
    console.log(`[OpenJobFill Pipeline] PageAnalyzer discovered ${descriptors.length} candidate form fields.`);

    // 5. 阶段二：生成全局填表规划 (Fill Plan)
    run.throwIfAborted();
    const plan = planGenerator.generatePlan(descriptors, resume, enhancer, customFieldRules);
    console.log(
      `[OpenJobFill Pipeline] FillPlan generated: ${plan.highConfidenceCount} to fill, ${plan.needsUserCount} need user, ${plan.skipCount} skipped.`
    );

    // 5.5 AI 兜底：把规则标记为 NEEDS_USER 的字段交给 LLM 批量映射并就地提升为 FILL
    //     （本地优先，未配置时静默跳过；仅发送字段标签，不发送简历内容）
    try {
      const { appliedCount } = await applyAIFallbackToPlan(plan, resume, run.signal);
      if (appliedCount > 0) {
        console.log(`[OpenJobFill Pipeline] AI fallback promoted ${appliedCount} fields to FILL.`);
      }
    } catch (err) {
      if (run.signal.aborted) throw err;
      console.warn('[OpenJobFill Pipeline] AI fallback warning:', err);
    }

    run.refreshPageFingerprint(typeof document !== 'undefined' ? document : undefined);
    SnapshotRecorder.record('plan', compactPlanSnapshot(plan), Date.now() - analysisStartedAt, run.runId);

    completed = true;
    return {
      plan,
      adapterName: enhancer ? enhancer.name : '智能通用决策引擎 (Pipeline v2)',
      resumeId: resume.id,
      resumeUpdatedAt: resume.updatedAt,
      pageUrl: currentUrl,
      runId: run.runId,
      pageFingerprint: run.pageFingerprint,
    };
    } catch (error) {
      SnapshotRecorder.record('error', {
        phase: 'analysis',
        message: error instanceof Error ? error.message : String(error),
      }, Date.now() - analysisStartedAt, run.runId);
      await SnapshotRecorder.persist(run.runId);
      throw error;
    } finally {
      if (!completed) {
        run.abort('分析已取消');
        this.activeRuns.delete(run.runId);
        if (this.activeRunId === run.runId) this.activeRunId = null;
      }
    }
  }

  /**
   * Re-plan only fields introduced by a SPA mutation. The DOM scan may use
   * mutation roots when available, while the known fingerprint set prevents
   * already-filled controls from being mapped or written a second time.
   */
  async analyzeIncremental(
    resume: StandardResume,
    previous: AnalyzedPlan,
    options: { runId?: string; changedRoots?: HTMLElement[] } = {},
  ): Promise<AnalyzedPlan> {
    const run = new FillRunContext({ runId: options.runId });
    this.activeRuns.set(run.runId, run);
    this.activeRunId = run.runId;
    let completed = false;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const analysisStartedAt = Date.now();
    SnapshotRecorder.start(currentUrl, typeof document !== 'undefined' ? document.title : '', run.runId);

    try {
      run.throwIfAborted();
      const enhancer = getEnhancerForUrl(currentUrl, typeof document !== 'undefined' ? document : undefined);
      const customRule = await ruleStorage.findMatchingRuleForUrl(currentUrl);
      const customFieldRules = customRule ? customRule.fields : [];
      const roots = (options.changedRoots || []).filter((root, index, all) =>
        !!root && all.indexOf(root) === index,
      );
      const descriptors = roots.length > 0
        ? roots.flatMap((root) => pageAnalyzer.analyzePage(root))
        : pageAnalyzer.analyzePage(document);
      const uniqueDescriptors = descriptors.filter((field, index, all) => {
        const key = `${field.fingerprint || field.id}|${field.label}|${field.section?.type || ''}:${field.section?.index || 0}`;
        return all.findIndex((candidate) =>
          `${candidate.fingerprint || candidate.id}|${candidate.label}|${candidate.section?.type || ''}:${candidate.section?.index || 0}` === key,
        ) === index;
      });
      const known = new Set(previous.plan.items.map((item) =>
        `${item.field.fingerprint || item.field.id}|${item.field.label}|${item.field.section?.type || ''}:${item.field.section?.index || 0}`,
      ));
      const newDescriptors = uniqueDescriptors.filter((field) => {
        const key = `${field.fingerprint || field.id}|${field.label}|${field.section?.type || ''}:${field.section?.index || 0}`;
        return !known.has(key);
      });
      SnapshotRecorder.record('scan', {
        incremental: true,
        previousRunId: previous.runId,
        totalCandidateCount: newDescriptors.length,
        fields: compactFieldSnapshot(newDescriptors),
      }, Date.now() - analysisStartedAt, run.runId);

      run.throwIfAborted();
      const plan = planGenerator.generatePlan(newDescriptors, resume, enhancer, customFieldRules);
      try {
        await applyAIFallbackToPlan(plan, resume, run.signal);
      } catch (err) {
        if (run.signal.aborted) throw err;
        console.warn('[OpenJobFill Pipeline] Incremental AI fallback warning:', err);
      }
      run.refreshPageFingerprint(typeof document !== 'undefined' ? document : undefined);
      SnapshotRecorder.record('plan', {
        incremental: true,
        previousRunId: previous.runId,
        ...compactPlanSnapshot(plan),
      }, Date.now() - analysisStartedAt, run.runId);
      completed = true;
      return {
        plan,
        adapterName: enhancer ? enhancer.name : '智能通用决策引擎 (增量管道)',
        resumeId: resume.id,
        resumeUpdatedAt: resume.updatedAt,
        pageUrl: currentUrl,
        runId: run.runId,
        pageFingerprint: run.pageFingerprint,
        remoteFrames: [],
      };
    } catch (error) {
      SnapshotRecorder.record('error', {
        phase: 'analysis',
        incremental: true,
        message: error instanceof Error ? error.message : String(error),
      }, Date.now() - analysisStartedAt, run.runId);
      await SnapshotRecorder.persist(run.runId);
      throw error;
    } finally {
      if (!completed) {
        run.abort('增量分析已取消');
        this.activeRuns.delete(run.runId);
        if (this.activeRunId === run.runId) this.activeRunId = null;
      }
    }
  }

  /**
   * 阶段三：执行已生成的规划（写入 DOM + 写后读回验证）
   */
  async executePlan(analyzed: AnalyzedPlan): Promise<FillResult> {
    const { plan, adapterName } = analyzed;
    const run = this.activeRuns.get(analyzed.runId) || new FillRunContext({
      runId: analyzed.runId,
      pageUrl: analyzed.pageUrl,
    });
    this.activeRuns.set(analyzed.runId, run);
    this.activeRunId = analyzed.runId;
    const executionStartedAt = Date.now();

    try {
      run.throwIfAborted();
      // 先做完整性校验，再触碰任何页面控件，避免局部写入后才发现计划已过期。
      await assertAnalyzedPlanIsCurrent(analyzed);

      const executionResult: PipelineExecutionResult = await pipelineExecutor.executePlan(plan, { signal: run.signal });
      run.throwIfAborted();
      const remoteResults = await executeRemoteFrames(analyzed.remoteFrames || [], { runId: run.runId, signal: run.signal });
    const remoteDurationMs = remoteResults.reduce((max, remote) => Math.max(max, remote.durationMs), 0);

    for (const remote of remoteResults) {
      executionResult.filledCount += remote.filledCount;
      executionResult.skippedCount += remote.skippedCount;
      executionResult.failedCount += remote.failedCount;
      executionResult.logs.push(...remote.logs.map((log) => ({
        ...log,
        label: `${log.label}（子页面）`,
      })));
      executionResult.remainingTasks.push(...remote.remainingTasks.map((task) => ({
        ...task,
        frameUrl: remote.url,
      })));
    }
    executionResult.durationMs += remoteDurationMs;

    // 必填缺失与附件区域扫描
    try {
      const missingCount = scanMissingRequiredFields();
      const dropzoneCount = scanAttachmentDropzones();
      if (missingCount > 0 || dropzoneCount > 0) {
        console.log(`[OpenJobFill Pipeline] Detected ${missingCount} missing required fields, ${dropzoneCount} upload dropzones.`);
      }
    } catch (e) {
      console.warn('[OpenJobFill Pipeline] scanMissingRequiredFields error:', e);
    }


    SnapshotRecorder.record('fill', {
      filledCount: executionResult.filledCount,
      skippedCount: executionResult.skippedCount,
      failedCount: executionResult.failedCount,
      verifiedCount: executionResult.verifiedCount,
      fields: executionResult.logs.map((log) => ({
        status: log.status,
        label: log.label,
        field: log.field,
        message: log.message,
        failureCode: log.failureCode,
        attempts: log.attempts,
        fingerprint: plan.items.find((item) => item.semanticKey === log.field)?.field.fingerprint,
        locator: plan.items.find((item) => item.semanticKey === log.field)?.field.locator,
      })),
    }, executionResult.durationMs, run.runId);
    await SnapshotRecorder.finish(executionResult, plan.totalFieldsCount, run.runId);

    return {
      success: executionResult.filledCount > 0,
      adapterName,
      filledCount: executionResult.filledCount,
      skippedCount: executionResult.skippedCount,
      failedCount: executionResult.failedCount,
      logs: executionResult.logs,
      // 预览阶段可能停留很久；这里只展示真正写入与校验 DOM 的耗时。
      durationMs: executionResult.durationMs,
      remainingTasks: executionResult.remainingTasks,
      plan: executionResult.plan,
    };
    } catch (error) {
      SnapshotRecorder.record('error', {
        phase: 'execution',
        message: error instanceof Error ? error.message : String(error),
      }, Date.now() - executionStartedAt, analyzed.runId);
      await SnapshotRecorder.persist(analyzed.runId);
      throw error;
    } finally {
      this.activeRuns.delete(analyzed.runId);
      if (this.activeRunId === analyzed.runId) this.activeRunId = null;
    }
  }

  /**
   * 一键完成 分析 + 执行（保持原有「直接填写」行为，向后兼容）
   */
  async fill(resume: StandardResume): Promise<FillResult> {
    const analyzed = await this.analyze(resume);
    return this.executePlan(analyzed);
  }
}

export const formFillerEngine = new FormFillerEngine();
