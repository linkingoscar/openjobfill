import type { FillResult } from '../../types/adapter';
import type { FillHistoryRecord } from '../../types/fillHistory';

export const FILL_HISTORY_STORAGE_KEY = 'openjobfill_fill_history';
export const MAX_FILL_HISTORY_RECORDS = 30;

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

function redactText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[邮箱]')
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '[手机号]')
    .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, '[身份证号]')
    .replace(/(?<!\d)\d{6,}(?!\d)/g, '[长数字]')
    .slice(0, 500);
}

function sanitizeDiagnosticMessage(value: unknown): string {
  return redactText(value)
    .replace(/读回验证失败\s*[（(][\s\S]*?[）)]/gi, '读回验证失败')
    .replace(/写入验证未通过\s*[（(][\s\S]*?[）)]/gi, '写入验证未通过')
    .replace(/(期望值|目标值|实际值|实际渲染)\s*[:：]\s*[^，,；;。]*/gi, '$1已隐藏')
    .replace(/(["“']).*?(["”'])/g, '[内容已隐藏]')
    .slice(0, 300);
}

function sanitizePathname(pathname: string): string {
  return pathname.split('/').map((segment) => {
    if (!segment) return segment;
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {}
    const containsSensitivePattern = redactText(decoded) !== decoded;
    const looksLikeDynamicId = /\d{4,}/.test(decoded) || /^[A-Za-z0-9_-]{20,}$/.test(decoded);
    return containsSensitivePattern || looksLikeDynamicId ? ':id' : segment;
  }).join('/');
}

function safePageUrl(rawUrl: string): { pageUrl: string; hostname: string } {
  try {
    const parsed = new URL(rawUrl);
    return {
      pageUrl: `${parsed.origin}${sanitizePathname(parsed.pathname)}`,
      hostname: parsed.hostname,
    };
  } catch {
    return { pageUrl: '', hostname: '' };
  }
}

function normalizeRecords(value: unknown): FillHistoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is FillHistoryRecord => !!item && typeof item === 'object' && typeof item.id === 'string')
    .slice(0, MAX_FILL_HISTORY_RECORDS);
}

async function readStoredRecords(): Promise<FillHistoryRecord[]> {
  if (isExtensionEnv()) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([FILL_HISTORY_STORAGE_KEY], (result) => {
          if (chrome.runtime?.lastError) {
            resolve([]);
            return;
          }
          resolve(normalizeRecords(result?.[FILL_HISTORY_STORAGE_KEY]));
        });
      } catch {
        resolve([]);
      }
    });
  }

  try {
    return normalizeRecords(JSON.parse(localStorage.getItem(FILL_HISTORY_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

async function writeStoredRecords(records: FillHistoryRecord[]): Promise<void> {
  const limited = records.slice(0, MAX_FILL_HISTORY_RECORDS);
  if (isExtensionEnv()) {
    await new Promise<void>((resolve) => {
      try {
        chrome.storage.local.set({ [FILL_HISTORY_STORAGE_KEY]: limited }, () => resolve());
      } catch {
        resolve();
      }
    });
    return;
  }
  localStorage.setItem(FILL_HISTORY_STORAGE_KEY, JSON.stringify(limited));
}

export const fillHistoryStorage = {
  async getRecords(): Promise<FillHistoryRecord[]> {
    return readStoredRecords();
  },

  createRecord(result: FillResult, context: { pageUrl: string; pageTitle: string }): FillHistoryRecord {
    const { pageUrl, hostname } = safePageUrl(context.pageUrl);
    const now = new Date();
    return {
      schemaVersion: 1,
      id: `fill-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now.toISOString(),
      pageTitle: redactText(context.pageTitle).slice(0, 160),
      pageUrl,
      hostname,
      adapterName: redactText(result.adapterName).slice(0, 100),
      filledCount: result.filledCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      durationMs: result.durationMs,
      phase: 'execution',
      // 有意不持久化 log.value 和 FillPlan，避免姓名、电话、经历正文等简历内容落入诊断历史。
      fields: result.logs.map((log) => ({
        label: redactText(log.label).slice(0, 160),
        field: redactText(log.field).slice(0, 160),
        status: log.status,
        message: log.message ? sanitizeDiagnosticMessage(log.message) : undefined,
      })),
      remainingTasks: (result.remainingTasks || []).map((task) => ({
        label: redactText(task.label).slice(0, 160),
        type: task.type,
        required: task.required,
        reason: sanitizeDiagnosticMessage(task.reason),
        frameUrl: task.frameUrl ? safePageUrl(task.frameUrl).pageUrl : undefined,
      })),
    };
  },

  createErrorRecord(context: {
    pageUrl: string;
    pageTitle: string;
    adapterName: string;
    phase: 'analysis' | 'execution';
    error: unknown;
  }): FillHistoryRecord {
    const { pageUrl, hostname } = safePageUrl(context.pageUrl);
    const now = new Date();
    return {
      schemaVersion: 1,
      id: `fill-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now.toISOString(),
      pageTitle: redactText(context.pageTitle).slice(0, 160),
      pageUrl,
      hostname,
      adapterName: redactText(context.adapterName).slice(0, 100),
      filledCount: 0,
      skippedCount: 0,
      failedCount: 1,
      durationMs: 0,
      phase: context.phase,
      operationError: sanitizeDiagnosticMessage(
        context.error instanceof Error ? context.error.message : context.error
      ),
      fields: [],
      remainingTasks: [],
    };
  },

  async append(record: FillHistoryRecord): Promise<FillHistoryRecord[]> {
    const records = await readStoredRecords();
    const next = [record, ...records.filter((item) => item.id !== record.id)]
      .slice(0, MAX_FILL_HISTORY_RECORDS);
    await writeStoredRecords(next);
    return next;
  },

  async clear(): Promise<void> {
    await writeStoredRecords([]);
  },

  async exportJSON(): Promise<string> {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      product: 'OpenJobFill',
      records: await readStoredRecords(),
    }, null, 2);
  },
};
