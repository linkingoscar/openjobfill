import type { FillSnapshotSession, SnapshotRecord } from './snapshotRecorder';
import type { FillPlan, FieldDescriptor } from '../../types/pipeline';
import type { FieldIndexMapping, ResumeKeyOption, UnmatchedFieldDescriptor } from '../../types/ai';
import { PipelineExecutor, type ExecutionEnvironment } from './executor';
import { RepeatableSectionWorkflowRunner, type SectionWorkflowEnvironment } from '../engine/sectionWorkflow';

export interface RunReplayDifference { sequence: number; stage: string; reason: string }
export interface DeterministicReplayResult {
  sessionId: string;
  replaySuccess: boolean;
  executionCount: number;
  aiResponseCount: number;
  sectionCount: number;
  differences: RunReplayDifference[];
  mode: 'RECORDED_IO';
}
function stable(value: unknown): string {
  return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b))) : v);
}

/** Offline AI transport. Request order and field/key contracts must match; never calls a provider. */
export function createRecordedAIProvider(session: FillSnapshotSession) {
  const events = session.records.filter((record) => record.stage === 'ai-request' || record.stage === 'ai-response');
  let cursor = 0;
  return {
    remaining: () => events.length - cursor,
    async map(fields: UnmatchedFieldDescriptor[], options: ResumeKeyOption[]): Promise<FieldIndexMapping | null> {
      const request = events[cursor++];
      const response = events[cursor++];
      if (request?.stage !== 'ai-request' || response?.stage !== 'ai-response') throw new Error('AI 请求/响应记录不完整或顺序已变化');
      if (stable(request.payload) !== stable({ fields, options })) throw new Error('AI 请求字段或候选 Schema 已变化');
      const payload = response.payload as { success: boolean; mapping: FieldIndexMapping };
      if (!payload.success) return null;
      // The replayed transport applies the same allow-list boundary as the live pipeline.
      const indices = new Set(fields.map((field) => String(field.index)));
      const keys = new Set(options.map((option) => option.resumeKey));
      return Object.fromEntries(Object.entries(payload.mapping || {}).filter(([index, key]) => indices.has(index) && keys.has(key)));
    },
  };
}

/**
 * Re-execute the production executor with recorded nondeterministic I/O.
 * No network, clipboard, real-page writes, timer waits or real resume values are used.
 * This tests control flow (retry/verification/counts), not browser rendering fidelity.
 */
export async function replayRunSnapshot(session: FillSnapshotSession): Promise<DeterministicReplayResult> {
  const differences: RunReplayDifference[] = [];
  const result: DeterministicReplayResult = { sessionId: session.sessionId, replaySuccess: false, executionCount: 0, aiResponseCount: 0, sectionCount: 0, differences, mode: 'RECORDED_IO' };
  const diff = (record: SnapshotRecord | undefined, reason: string, index = 0) => differences.push({ sequence: record?.sequence ?? index, stage: record?.stage || 'missing', reason });
  if (session.schemaVersion !== 3) {
    diff(undefined, '旧版快照只支持规划回放，请重新录制一次填写运行');
    return result;
  }
  if (session.truncated) { diff(undefined, '运行记录达到容量上限，不能进行完整回放'); return result; }
  for (let i = 0; i < session.records.length; i++) {
    if (session.records[i].sequence !== i) diff(session.records[i], '事件序号不连续，运行记录可能缺失或被重排', i);
  }
  const ai = createRecordedAIProvider(session);
  for (const request of session.records.filter((record) => record.stage === 'ai-request')) {
    try {
      const payload = request.payload as { fields: UnmatchedFieldDescriptor[]; options: ResumeKeyOption[] };
      await ai.map(payload.fields, payload.options);
      result.aiResponseCount++;
    } catch (error) { diff(request, String(error)); }
  }
  if (ai.remaining()) diff(undefined, '存在未消费的 AI 事件');

  const sectionEvents = session.records.filter((record) => ['section-plan', 'section-transition', 'section-result'].includes(record.stage));
  let sectionCursor = 0;
  while (sectionCursor < sectionEvents.length) {
    const initial = sectionEvents[sectionCursor];
    if (initial.stage !== 'section-plan') { diff(initial, '区块状态机缺少开始事件'); break; }
    const payload = initial.payload as { section: any; recordCount: number; maxRecords: number; saveAfterLast: boolean };
    const outcome = (state: string): boolean => {
      const next = sectionEvents[sectionCursor];
      if (next?.stage !== 'section-transition' || (next.payload as any).state !== state) throw new Error(`区块状态机预期 ${state}`);
      return !!(next.payload as any).success;
    };
    const root = document.createElement('section');
    const environment: SectionWorkflowEnvironment = {
      findRoot: () => outcome('FIND_SECTION') ? root : null,
      editableScope: () => root,
      enterEdit: async () => outcome('ENTER_EDIT'), save: async () => outcome('SAVE_RECORD'), add: async () => outcome('ADD_RECORD'),
      trace: (stage, actual) => {
        const expected = sectionEvents[sectionCursor++];
        if (expected?.stage !== stage || stable(expected.payload) !== stable(actual)) throw new Error(`区块状态机 ${stage} 结果变化`);
      },
    };
    try {
      await new RepeatableSectionWorkflowRunner().run({ sectionKey: payload.section, mode: 'single-card', rootSelectors: [], itemSelectors: [], maxRecords: payload.maxRecords, saveAfterLast: payload.saveAfterLast }, payload.recordCount,
        async () => ({ canAdvance: outcome('FILL_RECORD') }), undefined, undefined, environment);
      result.sectionCount++;
    } catch (error) { diff(sectionEvents[sectionCursor] || initial, String(error)); break; }
  }

  for (let start = 0; start < session.records.length; start++) {
    const initial = session.records[start];
    if (initial.stage !== 'execution-plan') continue;
    let end = start + 1;
    while (end < session.records.length && !['execution-result', 'execution-plan', 'error'].includes(session.records[end].stage)) end++;
    if (session.records[end]?.stage !== 'execution-result') { diff(initial, '执行被取消或记录不完整，缺少 execution-result'); continue; }
    const records = session.records.slice(start, end + 1);
    let cursor = 0;
    const peek = (stage: string): any => {
      const record = records[cursor];
      if (record?.stage !== stage) throw new Error(`第 ${record?.sequence ?? cursor} 步预期 ${stage}，实际 ${record?.stage || '记录耗尽'}`);
      return record.payload;
    };
    const rawItems = (initial.payload as { items: any[] }).items;
    const items = rawItems.map((item) => ({ ...item, confidence: 1, targetValue: '[REPLAY_TARGET]',
      field: { ...item.field, element: document.createElement('input'), label: '', name: '', placeholder: '', ariaLabel: '', contextText: '', currentValue: '', disabled: false, readOnly: false } as FieldDescriptor,
    }));
    const plan: FillPlan = { items, totalFieldsCount: items.length, highConfidenceCount: items.filter((i) => i.action === 'FILL').length, needsUserCount: items.filter((i) => i.action === 'NEEDS_USER').length, skipCount: items.filter((i) => i.action === 'SKIP').length };
    const env: ExecutionEnvironment = {
      wait: async () => {}, decorate: () => {},
      inspectSafety: () => ({ blocked: !!peek('field-gate').blocked }),
      strategiesForField: () => peek('adapter-route').strategies.map((strategy: any) => ({
        ...strategy,
        execute: async () => {
          const attempt = peek('adapter-attempt');
          if (attempt.error) throw new Error('Recorded strategy failure');
          return !!attempt.handled;
        },
        readBack: async () => {
          if (records[cursor]?.stage === 'adapter-attempt' && (records[cursor].payload as any).error) throw new Error('Recorded read-back failure');
          return !!peek('read-back').equivalent;
        },
        isEquivalent: (actual: unknown) => actual === true,
      })),
      trace: (stage, payload) => {
        const recorded = records[cursor++];
        if (recorded?.stage !== stage || stable(recorded?.payload) !== stable(payload)) {
          diff(recorded, `执行阶段 ${stage} 的顺序或结果与录制值不同`);
          throw new Error('回放阶段发生差异');
        }
      },
    };
    try {
      await new PipelineExecutor().executePlan(plan, { environment: env });
      if (cursor !== records.length) diff(records[cursor], '执行器未消费全部运行事件');
      result.executionCount++;
    } catch (error) { diff(records[cursor], String(error)); }
    start = end;
  }
  if (!result.executionCount && !result.sectionCount) diff(undefined, '没有可完整回放的执行阶段（可能仅录制了预览）');
  if (session.records.some((record) => record.stage === 'context-invalidated')) diff(session.records.find((record) => record.stage === 'context-invalidated'), '原始运行上下文已失效，不能标记为完整成功回放');
  result.replaySuccess = differences.length === 0;
  return result;
}
