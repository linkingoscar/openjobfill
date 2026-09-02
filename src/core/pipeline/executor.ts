import type { FillPlan, FillPlanItem, PipelineExecutionResult, RemainingTaskItem } from '../../types/pipeline';
import type { FillLogItem } from '../../types/adapter';
import { retryLadder } from './retryLadder';
import { verifier } from './verifier';
import { decorateElement } from '../engine/badgeDecorator';
import { sleep } from '../../utils/dom';
import { inspectFieldSafety } from './fieldSafety';
import { throwIfAborted, isFillRunAbortedError } from './runContext';

export class PipelineExecutor {
  /**
   * 调度执行 FillPlan，执行 Write -> Read-Back -> Verify -> Retry 闭环
   */
  async executePlan(
    plan: FillPlan,
    options: { signal?: AbortSignal; runId?: string; pageUrl?: string } = {},
  ): Promise<PipelineExecutionResult> {
    const signal = options.signal;
    const startTime = Date.now();
    const logs: FillLogItem[] = [];
    const remainingTasks: RemainingTaskItem[] = [];

    let filledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let verifiedCount = 0;

    for (const item of plan.items) {
      throwIfAborted(signal);
      const field = item.field;
      const label = field.label || field.placeholder || field.name || '未命名输入框';

      // 最终写入闸门再次读取实时 DOM 语义，防止分析之后字段被替换为
      // 密码、验证码、支付或提交相关控件时仍沿用旧计划。
      const safety = inspectFieldSafety(field.element, label, field.contextText);
      if (safety.blocked) {
        skippedCount++;
        logs.push({
          status: 'skipped',
          label,
          field: item.semanticKey || '',
          value: '',
          message: safety.reason || '安全策略禁止自动填写',
          failureCode: 'safety_blocked',
        });
        continue;
      }

      // 1. 跳过项
      if (item.action === 'SKIP') {
        skippedCount++;
        logs.push({
          status: 'skipped',
          label,
          field: item.semanticKey || '',
          value: '',
          message: item.reason || '跳过',
        });
        continue;
      }

      // 2. 需人工处理项 (NEEDS_USER)
      if (item.action === 'NEEDS_USER') {
        failedCount++;
        remainingTasks.push({
          id: item.id,
          label,
          type: field.type,
          required: field.required,
          reason: item.reason || '需人工核对填入',
          element: field.element,
          fingerprint: field.fingerprint,
          locator: field.locator,
        });

        decorateElement(field.element, {
          status: 'warning',
          label: `[需人工] ${label}`,
          value: '',
        });

        logs.push({
          status: 'skipped',
          label,
          field: item.semanticKey || '',
          value: '',
          message: item.reason || '需人工填入',
          failureCode: 'missing_mapping',
        });
        continue;
      }

      // 3. 执行填表 (FILL) 并进行读回验证 (Read-Back)
      const strategies = retryLadder.getStrategiesForField(field, item.driverType, {
        runId: options.runId,
        pageUrl: options.pageUrl,
      });
      let isSuccess = false;
      let actualReadValue: any = null;
      const attempts: Array<{
        strategy: string;
        outcome: 'success' | 'not_handled' | 'mismatch' | 'error';
        message?: string;
        adapterId?: string;
        executionWorld?: 'ISOLATED' | 'MAIN';
      }> = [];

      for (const strategy of strategies) {
        try {
          throwIfAborted(signal);
          const attemptMeta = {
            adapterId: strategy.adapterId,
            executionWorld: strategy.executionWorld,
          };
          const handled = await strategy.execute(field, item.targetValue, signal);
          if (!handled) {
            attempts.push({ strategy: strategy.name, outcome: 'not_handled', ...attemptMeta });
            continue;
          }
          
          // 等待 DOM / Vue / React 受控状态响应
          await sleep(50, signal);
          throwIfAborted(signal);

          // 读回验证 (Read-Back)
          actualReadValue = strategy.readBack
            ? await strategy.readBack(field, item.driverType)
            : await verifier.readBack(field, item.driverType);
          const adapterEquivalent = strategy.isEquivalent?.(actualReadValue, item.targetValue, item.driverType);
          const isEquivalent = adapterEquivalent ?? verifier.isSemanticEquivalent(
            actualReadValue,
            item.targetValue,
            item.driverType,
          );

          if (isEquivalent) {
            attempts.push({ strategy: strategy.name, outcome: 'success', ...attemptMeta });
            isSuccess = true;
            verifiedCount++;
            break;
          } else {
            attempts.push({ strategy: strategy.name, outcome: 'mismatch', ...attemptMeta });
            console.warn(
              `[OpenJobFill Pipeline] Read-back check mismatch on [${label}]: expected "${item.targetValue}", read "${actualReadValue}". Retrying with next strategy...`
            );
          }
        } catch (err) {
          if (signal?.aborted || isFillRunAbortedError(err)) throw err;
          attempts.push({
            strategy: strategy.name,
            outcome: 'error',
            message: err instanceof Error ? err.message.slice(0, 180) : '策略执行异常',
            adapterId: strategy.adapterId,
            executionWorld: strategy.executionWorld,
          });
          console.warn(`[OpenJobFill Pipeline] Strategy "${strategy.name}" threw error on [${label}]:`, err);
        }
      }

      if (isSuccess) {
        filledCount++;
        logs.push({
          status: 'success',
          label,
          field: item.semanticKey || '',
          value: String(item.targetValue),
          attempts,
        });

        decorateElement(field.element, {
          status: 'success',
          label,
          value: String(item.targetValue),
        });
      } else {
        const allNotHandled = attempts.length > 0 && attempts.every((attempt) => attempt.outcome === 'not_handled');
        const failureCode = allNotHandled
          ? 'adapter_not_handled'
          : attempts.some((attempt) => attempt.outcome === 'error')
            ? 'strategy_error'
            : 'verification_mismatch';
        const failureMessage = allNotHandled
          ? '当前控件没有可用的自动填写驱动'
          : `写入验证未通过 (期望值: ${item.targetValue})`;
        failedCount++;
        remainingTasks.push({
          id: item.id,
          label,
          type: field.type,
          required: field.required,
          reason: failureMessage,
          element: field.element,
          fingerprint: field.fingerprint,
          locator: field.locator,
        });

        decorateElement(field.element, {
          status: 'warning',
          label: `[验证未通过] ${label}`,
          value: String(item.targetValue),
        });

        logs.push({
          status: 'failed',
          label,
          field: item.semanticKey || '',
          value: String(item.targetValue),
          message: allNotHandled
            ? failureMessage
            : `读回验证失败 (实际渲染: "${actualReadValue}")`,
          failureCode,
          attempts,
        });
      }
    }

    return {
      success: filledCount > 0,
      filledCount,
      skippedCount,
      failedCount,
      verifiedCount,
      logs,
      remainingTasks,
      durationMs: Date.now() - startTime,
      plan,
    };
  }
}

export const pipelineExecutor = new PipelineExecutor();
