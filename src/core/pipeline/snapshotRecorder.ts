import type { FieldDescriptor, FillPlan, FieldLocatorEvidence } from '../../types/pipeline';
import type { FillResult } from '../../types/adapter';
import { scrubSensitiveData } from '../privacy/privacyScrubber';

export type SnapshotStage = 'scan' | 'plan' | 'fill' | 'error';
export type SnapshotSchemaVersion = 1 | 2;

export interface SnapshotRecord {
  stage: SnapshotStage;
  timestamp: number;
  durationMs?: number;
  payload: unknown;
}

export interface FillSnapshotSession {
  schemaVersion: SnapshotSchemaVersion;
  /** runId is intentionally also exposed as sessionId for older replay consumers. */
  sessionId: string;
  runId?: string;
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

export interface SnapshotProblemPackage {
  schemaVersion: 2;
  product: 'OpenJobFill';
  exportedAt: string;
  redaction: {
    applied: true;
    excludes: string[];
  };
  sessions: FillSnapshotSession[];
}

export interface SnapshotImportResult {
  imported: number;
  sessions: FillSnapshotSession[];
  redactionApplied: true;
}

export const MAX_REPLAY_SNAPSHOTS = 10;
export const SNAPSHOT_STORAGE_KEY = 'openjobfill_replay_snapshots';
const LEGACY_SNAPSHOT_STORAGE_KEY = 'openjobfill_last_replay_snapshot';
const MAX_LABEL_LENGTH = 180;
const SNAPSHOT_STAGES = new Set<SnapshotStage>(['scan', 'plan', 'fill', 'error']);

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

function safePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSnapshotRecord(value: unknown): SnapshotRecord | null {
  if (!isRecord(value) || !SNAPSHOT_STAGES.has(value.stage)) return null;
  return {
    stage: value.stage,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : undefined,
    payload: scrubSensitiveData(value.payload),
  };
}

function normalizeSnapshotSession(value: unknown): FillSnapshotSession | null {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || !Array.isArray(value.records)) return null;
  const records = value.records
    .map(normalizeSnapshotRecord)
    .filter((record): record is SnapshotRecord => !!record);
  const sessionId = value.sessionId.slice(0, 160);
  const runId = typeof value.runId === 'string' ? value.runId.slice(0, 160) : sessionId;
  const rawSummary = isRecord(value.summary) ? value.summary : undefined;
  return scrubSensitiveData({
    schemaVersion: value.schemaVersion === 1 ? 1 : 2,
    sessionId,
    runId,
    pageUrl: safePageUrl(typeof value.pageUrl === 'string' ? value.pageUrl : ''),
    pageTitle: String(value.pageTitle || '').slice(0, 180),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    records,
    summary: rawSummary ? {
      totalFields: Number(rawSummary.totalFields) || 0,
      filledFields: Number(rawSummary.filledFields) || 0,
      failedFields: Number(rawSummary.failedFields) || 0,
      totalTimeMs: Number(rawSummary.totalTimeMs) || 0,
    } : undefined,
  });
}

function parseStoredSessions(value: unknown): FillSnapshotSession[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map(normalizeSnapshotSession)
    .filter((session): session is FillSnapshotSession => !!session)
    .slice(0, MAX_REPLAY_SNAPSHOTS);
}

async function readStorage(keys: string[]): Promise<Record<string, unknown>> {
  if (isExtensionEnv()) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (result) => resolve((result || {}) as Record<string, unknown>));
      } catch {
        resolve({});
      }
    });
  }

  const result: Record<string, unknown> = {};
  try {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) result[key] = JSON.parse(raw);
    }
  } catch {
    // Unit tests and private browsing contexts may not expose localStorage.
  }
  return result;
}

async function writeStorage(sessions: FillSnapshotSession[]): Promise<void> {
  const safeSessions = sessions.slice(0, MAX_REPLAY_SNAPSHOTS).map((session) => scrubSensitiveData(session));
  if (isExtensionEnv()) {
    await new Promise<void>((resolve) => {
      try {
        chrome.storage.local.set({
          [SNAPSHOT_STORAGE_KEY]: safeSessions,
          [LEGACY_SNAPSHOT_STORAGE_KEY]: safeSessions[0] || null,
        }, () => resolve());
      } catch {
        resolve();
      }
    });
    return;
  }
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(safeSessions));
    localStorage.setItem(LEGACY_SNAPSHOT_STORAGE_KEY, JSON.stringify(safeSessions[0] || null));
  } catch {
    // Diagnostics must never break the filling flow when storage is unavailable.
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
      fingerprint: item.field.fingerprint,
      locator: item.field.locator,
    })),
  };
}

function cloneSession(session: FillSnapshotSession): FillSnapshotSession {
  return scrubSensitiveData(JSON.parse(JSON.stringify(session)));
}

export class SnapshotRecorder {
  private static current: FillSnapshotSession | null = null;
  private static currentRunId: string | null = null;
  private static readonly sessions = new Map<string, FillSnapshotSession>();
  private static recentSessions: FillSnapshotSession[] = [];
  private static hydrated = false;

  private static remember(session: FillSnapshotSession, makeCurrent = true): FillSnapshotSession {
    this.sessions.set(session.sessionId, session);
    if (session.runId && session.runId !== session.sessionId) this.sessions.set(session.runId, session);
    this.recentSessions = [session, ...this.recentSessions.filter((item) => item.sessionId !== session.sessionId)]
      .slice(0, MAX_REPLAY_SNAPSHOTS);
    if (makeCurrent) {
      this.current = session;
      this.currentRunId = session.runId || session.sessionId;
    } else if (!this.current) {
      this.current = session;
      this.currentRunId = session.runId || session.sessionId;
    }
    return session;
  }

  private static resolve(runId?: string): FillSnapshotSession | null {
    if (runId) return this.sessions.get(runId) || null;
    if (this.currentRunId) return this.sessions.get(this.currentRunId) || this.current;
    return this.current;
  }

  private static async hydrateRecentSessions(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const stored = await readStorage([SNAPSHOT_STORAGE_KEY, LEGACY_SNAPSHOT_STORAGE_KEY]);
    const persisted = parseStoredSessions(stored[SNAPSHOT_STORAGE_KEY]);
    if (persisted.length === 0) persisted.push(...parseStoredSessions(stored[LEGACY_SNAPSHOT_STORAGE_KEY]));
    for (const session of persisted.reverse()) this.remember(session, false);
  }

  static start(
    pageUrl = typeof window !== 'undefined' ? window.location.href : '',
    pageTitle = typeof document !== 'undefined' ? document.title : '',
    runId?: string,
  ): FillSnapshotSession {
    const createdAt = Date.now();
    const sessionId = runId || `session-${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
    return this.remember({
      schemaVersion: 2,
      sessionId,
      runId: sessionId,
      pageUrl: safePageUrl(pageUrl),
      pageTitle: String(pageTitle || '').slice(0, 180),
      createdAt,
      records: [],
    });
  }

  static record(stage: SnapshotStage, payload: unknown, durationMs?: number, runId?: string): void {
    const session = this.resolve(runId) || this.start(
      typeof window !== 'undefined' ? window.location.href : '',
      typeof document !== 'undefined' ? document.title : '',
      runId,
    );
    session.records.push({
      stage,
      timestamp: Date.now(),
      durationMs,
      payload: scrubSensitiveData(payload),
    });
    this.remember(session, !runId || this.currentRunId === runId);
  }

  static async finish(
    result: Pick<FillResult, 'filledCount' | 'failedCount' | 'durationMs'>,
    totalFields: number,
    runId?: string,
  ): Promise<FillSnapshotSession> {
    const session = this.resolve(runId) || this.start(
      typeof window !== 'undefined' ? window.location.href : '',
      typeof document !== 'undefined' ? document.title : '',
      runId,
    );
    session.summary = {
      totalFields,
      filledFields: result.filledCount,
      failedFields: result.failedCount,
      totalTimeMs: result.durationMs,
    };
    this.remember(session, !runId || this.currentRunId === runId);
    await writeStorage(this.recentSessions);
    return session;
  }

  /** 将尚未进入 fill 阶段的分析/执行异常也落入环形记录。 */
  static async persist(runId?: string): Promise<FillSnapshotSession | null> {
    const session = this.resolve(runId);
    if (!session) return null;
    await writeStorage(this.recentSessions);
    return session;
  }

  static getCurrent(runId?: string): FillSnapshotSession | null {
    return this.resolve(runId);
  }

  static getRecentSessions(): FillSnapshotSession[] {
    return this.recentSessions.map(cloneSession);
  }

  /** 兼容旧调用方：导出当前 run 的单会话 JSON。 */
  static exportJSON(runId?: string): string {
    return JSON.stringify(scrubSensitiveData(this.resolve(runId)), null, 2);
  }

  /** 导出最近运行的有界环形诊断包；包内永远不含 targetValue、DOM 引用或简历原文。 */
  static async exportProblemPackage(runId?: string): Promise<string> {
    await this.hydrateRecentSessions();
    const selected = runId
      ? this.resolve(runId)
      : this.recentSessions[0];
    const sessions = runId
      ? (selected ? [selected] : [])
      : this.recentSessions;
    const problemPackage: SnapshotProblemPackage = {
      schemaVersion: 2,
      product: 'OpenJobFill',
      exportedAt: new Date().toISOString(),
      redaction: {
        applied: true,
        excludes: ['targetValue', 'currentValue', 'DOM 引用', '简历原文'],
      },
      sessions: sessions.map(cloneSession),
    };
    return JSON.stringify(scrubSensitiveData(problemPackage), null, 2);
  }

  /** 导入外部问题包时重新清洗并校验结构，避免诊断文件反向污染本地记录。 */
  static async importProblemPackage(input: string | unknown): Promise<SnapshotImportResult> {
    let parsed: unknown = input;
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error('问题包不是有效 JSON');
      }
    }
    const rawSessions = isRecord(parsed) && Array.isArray(parsed.sessions)
      ? parsed.sessions
      : [parsed];
    const sessions = rawSessions
      .map(normalizeSnapshotSession)
      .filter((session): session is FillSnapshotSession => !!session)
      .slice(0, MAX_REPLAY_SNAPSHOTS);
    if (sessions.length === 0) throw new Error('问题包中没有有效的运行快照');
    // Problem packages are ordered newest-first; insert oldest-first so the
    // in-memory ring keeps the same order after import.
    for (const session of [...sessions].reverse()) this.remember(session, false);
    await writeStorage(this.recentSessions);
    return { imported: sessions.length, sessions: sessions.map(cloneSession), redactionApplied: true };
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
  planner: (scanPayload: unknown) => T | Promise<T>,
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

// Kept as a type-only import anchor for consumers that want to narrow locator payloads
// without importing the whole pipeline type module at runtime.
export type SnapshotLocator = FieldLocatorEvidence;
