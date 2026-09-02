import type { FieldDescriptor, FillPlan } from '../../types/pipeline';
import type { FillResult } from '../../types/adapter';
import { scrubSensitiveData } from '../privacy/privacyScrubber';

export type SnapshotStage = 'scan' | 'plan' | 'fill' | 'error';

export interface SnapshotRecord {
  stage: SnapshotStage;
  timestamp: number;
  durationMs?: number;
  payload: unknown;
}

export interface FillSnapshotSession {
  schemaVersion: 1;
  sessionId: string;
  pageUrl: string;
  pageTitle: string;
  createdAt: number;
  records: SnapshotRecord[];
  summary?: {
    totalFields: number;
    filledFields: number;
    failedFields: number;
    totalTimeMs: number;
  };
}

const SNAPSHOT_STORAGE_KEY = 'openjobfill_last_replay_snapshot';
const MAX_LABEL_LENGTH = 180;

function safePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

/** 生成只含表单语义、不含 DOM 引用和当前输入值的紧凑扫描快照。 */
export function compactFieldSnapshot(fields: FieldDescriptor[], maxFields = 120) {
  return fields.slice(0, maxFields).map((field) => ({
    id: field.id,
    type: field.type,
    label: field.label.slice(0, MAX_LABEL_LENGTH),
    placeholder: field.placeholder.slice(0, MAX_LABEL_LENGTH),
    name: field.name.slice(0, MAX_LABEL_LENGTH),
    ariaLabel: field.ariaLabel.slice(0, MAX_LABEL_LENGTH),
    required: field.required,
    disabled: field.disabled,
    readOnly: field.readOnly,
    options: field.options?.slice(0, 20).map((option) => option.slice(0, 100)),
    section: field.section,
    fingerprint: field.fingerprint,
    locator: field.locator,
    safety: field.safety?.blocked ? {
      blocked: true,
      category: field.safety.category,
      reason: field.safety.reason,
    } : undefined,
  }));
}

/** 规划快照故意不记录 targetValue，防止简历内容进入诊断文件。 */
export function compactPlanSnapshot(plan: FillPlan) {
  return {
    totalFieldsCount: plan.totalFieldsCount,
    highConfidenceCount: plan.highConfidenceCount,
    needsUserCount: plan.needsUserCount,
    skipCount: plan.skipCount,
    items: plan.items.map((item) => ({
      id: item.id,
      fieldId: item.field.id,
      label: item.field.label.slice(0, MAX_LABEL_LENGTH),
      action: item.action,
      semanticKey: item.semanticKey,
      confidence: item.confidence,
      reason: item.reason,
      source: item.source,
      driverType: item.driverType,
    })),
  };
}

export class SnapshotRecorder {
  private static current: FillSnapshotSession | null = null;

  static start(
    pageUrl = typeof window !== 'undefined' ? window.location.href : '',
    pageTitle = typeof document !== 'undefined' ? document.title : '',
    runId?: string,
  ): FillSnapshotSession {
    const createdAt = Date.now();
    this.current = {
      schemaVersion: 1,
      sessionId: runId || `session-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      pageUrl: safePageUrl(pageUrl),
      pageTitle: String(pageTitle || '').slice(0, 180),
      createdAt,
      records: [],
    };
    return this.current;
  }

  static record(stage: SnapshotStage, payload: unknown, durationMs?: number): void {
    if (!this.current) this.start();
    this.current!.records.push({
      stage,
      timestamp: Date.now(),
      durationMs,
      payload: scrubSensitiveData(payload),
    });
  }

  static async finish(result: Pick<FillResult, 'filledCount' | 'failedCount' | 'durationMs'>, totalFields: number): Promise<FillSnapshotSession> {
    if (!this.current) this.start();
    this.current!.summary = {
      totalFields,
      filledFields: result.filledCount,
      failedFields: result.failedCount,
      totalTimeMs: result.durationMs,
    };
    const snapshot = this.current!;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) => chrome.storage.local.set({ [SNAPSHOT_STORAGE_KEY]: snapshot }, () => resolve()));
    }
    return snapshot;
  }

  static getCurrent(): FillSnapshotSession | null {
    return this.current;
  }

  static exportJSON(): string {
    return JSON.stringify(scrubSensitiveData(this.current), null, 2);
  }
}

export interface SnapshotReplayResult<T> {
  sessionId: string;
  replaySuccess: boolean;
  diffCount: number;
  originalResult: unknown;
  replayedResult: T;
}

function stableJSON(value: unknown): string {
  const normalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.keys(input).sort().reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalize(input[key]);
        return result;
      }, {});
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

/** 用脱敏扫描骨架离线重跑规划算法，便于在没有招聘网站账号时复现匹配回归。 */
export async function replaySnapshot<T>(
  session: FillSnapshotSession,
  planner: (scanPayload: unknown) => T | Promise<T>
): Promise<SnapshotReplayResult<T>> {
  const scan = session.records.find((record) => record.stage === 'scan');
  if (!scan) throw new Error('快照中缺少 scan 阶段数据，无法回放');
  const original = session.records.find((record) => record.stage === 'plan')?.payload;
  const replayed = await planner(scan.payload);
  const replaySuccess = stableJSON(original ?? {}) === stableJSON(replayed ?? {});
  return {
    sessionId: session.sessionId,
    replaySuccess,
    diffCount: replaySuccess ? 0 : 1,
    originalResult: original,
    replayedResult: replayed,
  };
}
