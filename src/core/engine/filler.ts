import type { StandardResume } from '../../types/resume';
import type { FillResult } from '../../types/adapter';
import type { PipelineExecutionResult, FillPlan } from '../../types/pipeline';
import { pageAnalyzer } from '../pipeline/pageAnalyzer';
import { planGenerator } from '../pipeline/planGenerator';
import { pipelineExecutor } from '../pipeline/executor';
import { sectionEngine } from './sectionEngine';
import { getEnhancerForUrl } from '../adapters/enhancers';
import { ruleStorage } from '../storage/ruleStorage';
import { scanMissingRequiredFields, scanAttachmentDropzones } from './badgeDecorator';
import { applyAIFallbackToPlan } from '../ai/aiFallback';

/** analyze 阶段的产物：一份尚未执行的填表规划，可预览、可确认后再执行 */
export interface AnalyzedPlan {
  plan: FillPlan;
  adapterName: string;
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
    const enhancer = getEnhancerForUrl(currentUrl);
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
    };
  }

  /**
   * 阶段三：执行已生成的规划（写入 DOM + 写后读回验证）
   */
  async executePlan(analyzed: AnalyzedPlan): Promise<FillResult> {
    const { plan, adapterName } = analyzed;

    const executionResult: PipelineExecutionResult = await pipelineExecutor.executePlan(plan);

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
