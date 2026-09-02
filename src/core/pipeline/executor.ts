import type { FillPlan, FillPlanItem, PipelineExecutionResult, RemainingTaskItem } from '../../types/pipeline';
import type { FillLogItem } from '../../types/adapter';
import { retryLadder } from './retryLadder';
import { verifier } from './verifier';
import { decorateElement } from '../engine/badgeDecorator';
import { sleep } from '../../utils/dom';
import { inspectFieldSafety } from './fieldSafety';
import { throwIfAborted, isFillRunAbortedError } from './runContext';
import { recordRunTrace, type RunTraceStage } from './runTrace';

export interface ExecutionEnvironment {
  strategiesForField: typeof retryLadder.getStrategiesForField;
  inspectSafety: typeof inspectFieldSafety;
  wait: typeof sleep;
  decorate: typeof decorateElement;
  trace: (stage: RunTraceStage, payload: unknown) => void;
}

export class PipelineExecutor {
  async executePlan(
    plan: FillPlan,
    options: { signal?: AbortSignal; runId?: string; pageUrl?: string; environment?: ExecutionEnvironment } = {},
  ): Promise<PipelineExecutionResult> {
    const signal = options.signal;
    const env: ExecutionEnvironment = options.environment || {
      strategiesForField: retryLadder.getStrategiesForField.bind(retryLadder),
      inspectSafety: inspectFieldSafety,
      wait: sleep,
      decorate: decorateElement,
      trace: (stage, payload) => recordRunTrace(stage, payload, options.runId),
    };
    env.trace('execution-plan', { items: plan.items.map((item) => ({
      id: item.id, action: item.action, decision: item.decision, semanticKey: item.semanticKey,
      driverType: item.driverType, riskLevel: item.riskLevel,
      field: { id: item.field.id, type: item.field.type, required: item.field.required },
    })) });

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
      const safety = env.inspectSafety(field.element, label, field.contextText);
      env.trace('field-gate', { fieldId: field.id, blocked: safety.blocked });

      if (safety.blocked) {
        item.verificationStatus = 'NOT_HANDLED';
        skippedCount++;
        logs.push({ status: 'skipped', label, field: item.semanticKey || '', value: '', message: safety.reason || '安全策略禁止自动填写', failureCode: 'safety_blocked' });
        continue;
      }

      if (item.action === 'SKIP') {
        item.verificationStatus = 'NOT_HANDLED';
        skippedCount++;
        logs.push({ status: 'skipped', label, field: item.semanticKey || '', value: '', message: item.reason || '跳过' });
        continue;
      }

      if (item.action === 'NEEDS_USER') {
        item.verificationStatus = 'NOT_HANDLED';
        failedCount++;
        remainingTasks.push({
          id: item.id, label, type: field.type, required: field.required,
          reason: item.reason || '需人工核对填入', element: field.element,
          fingerprint: field.fingerprint, locator: field.locator, failureCode: 'mapping_missing',
        });
        env.decorate(field.element, { status: 'warning', label: `[需人工] ${label}`, value: '' });
        logs.push({ status: 'skipped', label, field: item.semanticKey || '', value: '', message: item.reason || '需人工填入', failureCode: 'mapping_missing' });
        continue;
      }

      const strategies = env.strategiesForField(field, item.driverType, { runId: options.runId, pageUrl: options.pageUrl });
      env.trace('adapter-route', { fieldId: field.id, strategies: strategies.map((strategy) => ({ name: strategy.name, adapterId: strategy.adapterId, executionWorld: strategy.executionWorld })) });
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
          const attemptMeta = { adapterId: strategy.adapterId, executionWorld: strategy.executionWorld };
          const handled = await strategy.execute(field, item.targetValue, signal);
          env.trace('adapter-attempt', { fieldId: field.id, strategy: strategy.name, handled });
          if (!handled) {
            attempts.push({ strategy: strategy.name, outcome: 'not_handled', ...attemptMeta });
            continue;
          }

          await env.wait(50, signal);
          throwIfAborted(signal);
          actualReadValue = strategy.readBack
            ? await strategy.readBack(field, item.driverType)
            : await verifier.readBack(field, item.driverType);
          item.actualValue = actualReadValue;

          const adapterEquivalent = strategy.isEquivalent?.(actualReadValue, item.targetValue, item.driverType);
          const verification = adapterEquivalent === undefined
            ? verifier.verify(actualReadValue, item.targetValue, item.driverType, item.semanticKey)
            : {
                status: adapterEquivalent ? 'VERIFIED' as const : 'MISMATCH' as const,
                actual: actualReadValue,
                expected: item.targetValue,
              };
          item.verificationStatus = verification.status;
          const isEquivalent = verification.status === 'VERIFIED';

          env.trace('read-back', {
            fieldId: field.id,
            strategy: strategy.name,
            equivalent: isEquivalent,
            verificationStatus: verification.status,
          });

          if (isEquivalent) {
            attempts.push({ strategy: strategy.name, outcome: 'success', ...attemptMeta });
            isSuccess = true;
            verifiedCount++;
            break;
          }

          attempts.push({ strategy: strategy.name, outcome: 'mismatch', ...attemptMeta });
          console.warn(`[OpenJobFill Pipeline] Read-back check ${verification.status} on [${label}]. Retrying with next strategy...`);
        } catch (err) {
          if (signal?.aborted || isFillRunAbortedError(err)) throw err;
          env.trace('adapter-attempt', { fieldId: field.id, strategy: strategy.name, error: true });
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
        logs.push({ status: 'success', label, field: item.semanticKey || '', value: String(item.targetValue), attempts });
        env.decorate(field.element, { status: 'success', label, value: String(item.targetValue) });
        continue;
      }

      const allNotHandled = attempts.length > 0 && attempts.every((attempt) => attempt.outcome === 'not_handled');
      const unreadable = item.verificationStatus === 'UNREADABLE';
      const failureCode = allNotHandled
        ? 'adapter_not_handled'
        : unreadable
          ? 'verification_unreadable'
          : attempts.some((attempt) => attempt.outcome === 'error')
            ? 'write_error'
            : 'verification_mismatch';
      const failureMessage = allNotHandled
        ? '当前控件没有可用的自动填写驱动'
        : unreadable
          ? '页面状态不可读，需人工确认'
          : `写入验证未通过 (期望值: ${item.targetValue})`;

      failedCount++;
      remainingTasks.push({
        id: item.id, label, type: field.type, required: field.required,
        reason: failureMessage, element: field.element, fingerprint: field.fingerprint,
        locator: field.locator, failureCode,
      });
      env.decorate(field.element, { status: 'warning', label: `[验证未通过] ${label}`, value: String(item.targetValue) });
      logs.push({
        status: 'failed', label, field: item.semanticKey || '', value: String(item.targetValue),
        message: allNotHandled ? failureMessage : `读回验证失败或不完整 (实际渲染: "${actualReadValue}")`,
        failureCode, attempts,
      });
    }

    env.trace('execution-result', { filledCount, skippedCount, failedCount, verifiedCount });
    return {
      success: failedCount === 0 && filledCount > 0,
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
