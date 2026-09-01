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

/** analyze 阶段的产物：一份尚未执行的填表规划，可预览、可确认后再执行 */
export interface AnalyzedPlan {
  plan: FillPlan;
  adapterName: string;
  /** 用于防止简历编辑或切换后继续执行旧预览。 */
  resumeId: string;
  resumeUpdatedAt: number;
  /** 用于防止 SPA 步骤切换或页面替换后继续执行旧预览。 */
  pageUrl: string;
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
  /**
   * 阶段一 + 阶段二：扫描页面并生成填表规划（不写入 DOM）
   *
   * 拆出此方法是为了支持「先预览、确认后再填写」的交互：
   * 调用方拿到规划后可以先展示给用户核对，再决定是否 executePlan。
   */
  async analyze(resume: StandardResume): Promise<AnalyzedPlan> {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    // 1. 获取当前页面匹配的平台增强器 (Platform Enhancer)
    const enhancer = getEnhancerForUrl(currentUrl, typeof document !== 'undefined' ? document : undefined);
    if (enhancer) {
      console.log(`[OpenJobFill Pipeline] Matched Platform Enhancer: ${enhancer.name} (${enhancer.id})`);
      if (enhancer.onBeforePlan) {
        await enhancer.onBeforePlan(resume);
      }
    }

    // 2. 全局通用多经历卡片差量扩增 (SectionEngine)
    try {
      await sectionEngine.ensureSectionCapacity(resume, enhancer);
    } catch (err) {
      console.warn('[OpenJobFill Pipeline] SectionEngine expansion warning:', err);
    }

    // 3. 加载用户针对当前站点的自定义规则
    const customRule = await ruleStorage.findMatchingRuleForUrl(currentUrl);
    const customFieldRules = customRule ? customRule.fields : [];

    // 4. 阶段一：页面全要素深度扫描 (Page Analyzer 重新扫描最新挂载的 DOM 节点)
    const descriptors = pageAnalyzer.analyzePage(document);
    console.log(`[OpenJobFill Pipeline] PageAnalyzer discovered ${descriptors.length} candidate form fields.`);

    // 5. 阶段二：生成全局填表规划 (Fill Plan)
    const plan = planGenerator.generatePlan(descriptors, resume, enhancer, customFieldRules);
    console.log(
      `[OpenJobFill Pipeline] FillPlan generated: ${plan.highConfidenceCount} to fill, ${plan.needsUserCount} need user, ${plan.skipCount} skipped.`
    );

    // 5.5 AI 兜底：把规则标记为 NEEDS_USER 的字段交给 LLM 批量映射并就地提升为 FILL
    //     （本地优先，未配置时静默跳过；仅发送字段标签，不发送简历内容）
    try {
      const { appliedCount } = await applyAIFallbackToPlan(plan, resume);
      if (appliedCount > 0) {
        console.log(`[OpenJobFill Pipeline] AI fallback promoted ${appliedCount} fields to FILL.`);
      }
    } catch (err) {
      console.warn('[OpenJobFill Pipeline] AI fallback warning:', err);
    }

    return {
      plan,
      adapterName: enhancer ? enhancer.name : '智能通用决策引擎 (Pipeline v2)',
      resumeId: resume.id,
      resumeUpdatedAt: resume.updatedAt,
      pageUrl: currentUrl,
    };
  }

  /**
   * 阶段三：执行已生成的规划（写入 DOM + 写后读回验证）
   */
  async executePlan(analyzed: AnalyzedPlan): Promise<FillResult> {
    const { plan, adapterName } = analyzed;

    // 先做完整性校验，再触碰任何页面控件，避免局部写入后才发现计划已过期。
    await assertAnalyzedPlanIsCurrent(analyzed);

    const executionResult: PipelineExecutionResult = await pipelineExecutor.executePlan(plan);
    const remoteResults = await executeRemoteFrames(analyzed.remoteFrames || []);
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
