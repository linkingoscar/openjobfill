import type { StandardResume } from '../../types/resume';
import type { FillResult } from '../../types/adapter';
import type { PipelineExecutionResult } from '../../types/pipeline';
import { pageAnalyzer } from '../pipeline/pageAnalyzer';
import { planGenerator } from '../pipeline/planGenerator';
import { pipelineExecutor } from '../pipeline/executor';
import { sectionEngine } from './sectionEngine';
import { getEnhancerForUrl } from '../adapters/enhancers';
import { ruleStorage } from '../storage/ruleStorage';
import { scanMissingRequiredFields, scanAttachmentDropzones } from './badgeDecorator';

export class FormFillerEngine {
  /**
   * 执行新一代两阶段决策与执行管道 (Section Expansion -> Page Analyzer -> Plan -> Execute with Read-Back Verification)
   */
  async fill(resume: StandardResume): Promise<FillResult> {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const startTime = Date.now();

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

    // 6. 阶段三：执行规划与写后读回验证 (Execution with Read-Back & Retry Ladder)
    const executionResult: PipelineExecutionResult = await pipelineExecutor.executePlan(plan);

    // 7. 必填缺失与附件区域扫描
    try {
      const missingCount = scanMissingRequiredFields();
      const dropzoneCount = scanAttachmentDropzones();
      if (missingCount > 0 || dropzoneCount > 0) {
        console.log(`[OpenJobFill Pipeline] Detected ${missingCount} missing required fields, ${dropzoneCount} upload dropzones.`);
      }
    } catch (e) {
      console.warn('[OpenJobFill Pipeline] scanMissingRequiredFields error:', e);
    }

    const durationMs = Date.now() - startTime;

    return {
      success: executionResult.filledCount > 0,
      adapterName: enhancer ? enhancer.name : '智能通用决策引擎 (Pipeline v2)',
      filledCount: executionResult.filledCount,
      skippedCount: executionResult.skippedCount,
      failedCount: executionResult.failedCount,
      logs: executionResult.logs,
      durationMs,
      remainingTasks: executionResult.remainingTasks,
      plan: executionResult.plan,
    };
  }
}

export const formFillerEngine = new FormFillerEngine();
