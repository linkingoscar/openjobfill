import type { JobApplicationRecord, ApplicationStatus, TrackerEditableField } from '../../types/tracker';
import type { ExtensionMessage, ExtensionResponse } from '../../types/message';
import {
  applicationIdentity,
  mergeApplicationRecords,
  normalizeJobApplicationRecord,
  TRACKER_EDITABLE_FIELDS,
} from '../tracker/trackerSchema';

const TRACKER_STORAGE_KEY = 'openjobfill_job_applications';
let writeQueue: Promise<void> = Promise.resolve();

export const TRACKER_STORAGE_MESSAGE_TYPES = {
  GET: 'TRACKER_STORAGE_GET',
  SAVE: 'TRACKER_STORAGE_SAVE',
  REPLACE_ALL: 'TRACKER_STORAGE_REPLACE_ALL',
  DELETE: 'TRACKER_STORAGE_DELETE',
  UPDATE_STATUS: 'TRACKER_STORAGE_UPDATE_STATUS',
} as const;

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

function shouldBrokerAccess(): boolean {
  return isExtensionEnv()
    && typeof window !== 'undefined'
    && typeof chrome.runtime?.sendMessage === 'function';
}

function sendTrackerMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response?: ExtensionResponse) => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(`投递记录存储失败：${error.message || 'background 不可用'}`));
        else if (!response?.success) reject(new Error(response?.error || '投递记录存储失败'));
        else resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function normalizeList(value: unknown): JobApplicationRecord[] {
  if (!Array.isArray(value)) return [];
  const unique: JobApplicationRecord[] = [];
  const aliases = new Map<string, number>();
  for (const raw of value) {
    const record = normalizeJobApplicationRecord(raw);
    if (!record) continue;
    const keys = [`id:${record.id}`, `request:${record.clientRequestId}`, `job:${applicationIdentity(record)}`];
    const index = keys.map((key) => aliases.get(key)).find((candidate) => candidate !== undefined);
    if (index === undefined) {
      const nextIndex = unique.push(record) - 1;
      keys.forEach((key) => aliases.set(key, nextIndex));
      continue;
    }
    unique[index] = mergeApplicationRecords(unique[index], record);
    const merged = unique[index];
    [...keys, `id:${merged.id}`, `request:${merged.clientRequestId}`, `job:${applicationIdentity(merged)}`]
      .forEach((key) => aliases.set(key, index));
  }
  return unique.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function readRaw(): Promise<unknown> {
  if (isExtensionEnv()) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get([TRACKER_STORAGE_KEY], (result) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve(result?.[TRACKER_STORAGE_KEY]);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  const data = localStorage.getItem(TRACKER_STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeRaw(list: JobApplicationRecord[]): Promise<void> {
  if (isExtensionEnv()) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ [TRACKER_STORAGE_KEY]: list }, () => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(list));
}

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function userFields(record: JobApplicationRecord): TrackerEditableField[] {
  if (record.source === 'manual') {
    return TRACKER_EDITABLE_FIELDS.filter((field) => record[field] !== undefined && record[field] !== '');
  }
  if (record.source === 'user_confirmed') {
    return [...new Set([
      ...(record.lockedFields || []),
      ...TRACKER_EDITABLE_FIELDS.filter((field) => record.fieldSources?.[field] === 'user'),
    ])];
  }
  return record.lockedFields || [];
}

export const trackerStorage = {
  async getAllApplications(): Promise<JobApplicationRecord[]> {
    return this.getApplications();
  },

  async getApplications(): Promise<JobApplicationRecord[]> {
    if (shouldBrokerAccess()) {
      const response = await sendTrackerMessage({ type: TRACKER_STORAGE_MESSAGE_TYPES.GET });
      return normalizeList(response.applications);
    }
    return this.getApplicationsDirect();
  },

  /** Background 专用：把迁移也纳入同一队列，避免旧数据回写覆盖并发新增。 */
  async getApplicationsDirect(): Promise<JobApplicationRecord[]> {
    return withWriteLock(async () => {
      const raw = await readRaw();
      const normalized = normalizeList(raw);
      // Migrate legacy arrays in place, but never seed fabricated application data.
      if (Array.isArray(raw) && JSON.stringify(raw) !== JSON.stringify(normalized)) {
        await writeRaw(normalized);
      }
      return normalized;
    });
  },

  getFromLocalStorage(): JobApplicationRecord[] {
    const data = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!data) return [];
    try {
      return normalizeList(JSON.parse(data));
    } catch {
      return [];
    }
  },

  async saveApplications(list: JobApplicationRecord[]): Promise<void> {
    if (shouldBrokerAccess()) {
      await sendTrackerMessage({ type: TRACKER_STORAGE_MESSAGE_TYPES.REPLACE_ALL, payload: { applications: list } });
      return;
    }
    await this.saveApplicationsDirect(list);
  },

  async saveApplicationsDirect(list: JobApplicationRecord[]): Promise<void> {
    const normalized = normalizeList(list);
    if (normalized.length !== list.length) throw new Error('投递记录中包含无效或重复数据');
    await withWriteLock(() => writeRaw(normalized));
  },

  async saveApplication(record: JobApplicationRecord): Promise<void> {
    if (shouldBrokerAccess()) {
      await sendTrackerMessage({ type: TRACKER_STORAGE_MESSAGE_TYPES.SAVE, payload: { application: record } });
      return;
    }
    await this.saveApplicationDirect(record);
  },

  async saveApplicationDirect(record: JobApplicationRecord): Promise<void> {
    const normalized = normalizeJobApplicationRecord({
      ...record,
      lockedFields: [...new Set([...(record.lockedFields || []), ...userFields(record)])],
      fieldSources: {
        ...(record.fieldSources || {}),
        ...Object.fromEntries(TRACKER_EDITABLE_FIELDS
          .filter((field) => record[field] !== undefined && record[field] !== '')
          .map((field) => [field, record.fieldSources?.[field]
            || (record.source === 'manual' ? 'user' : 'heuristic')])),
      },
      updatedAt: new Date().toISOString(),
    });
    if (!normalized) throw new Error('投递记录缺少公司名称或岗位名称');

    await withWriteLock(async () => {
      const list = normalizeList(await readRaw());
      const index = list.findIndex((candidate) => candidate.id === normalized.id
        || candidate.clientRequestId === normalized.clientRequestId
        || applicationIdentity(candidate) === applicationIdentity(normalized));
      if (index >= 0) list[index] = mergeApplicationRecords(list[index], normalized);
      else list.unshift(normalized);
      await writeRaw(normalizeList(list));
    });
  },

  async deleteApplication(id: string): Promise<void> {
    if (shouldBrokerAccess()) {
      await sendTrackerMessage({ type: TRACKER_STORAGE_MESSAGE_TYPES.DELETE, payload: { id } });
      return;
    }
    await this.deleteApplicationDirect(id);
  },

  async deleteApplicationDirect(id: string): Promise<void> {
    await withWriteLock(async () => {
      const list = normalizeList(await readRaw());
      await writeRaw(list.filter((record) => record.id !== id));
    });
  },

  async updateApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
    if (shouldBrokerAccess()) {
      await sendTrackerMessage({ type: TRACKER_STORAGE_MESSAGE_TYPES.UPDATE_STATUS, payload: { id, status } });
      return;
    }
    await this.updateApplicationStatusDirect(id, status);
  },

  async updateApplicationStatusDirect(id: string, status: ApplicationStatus): Promise<void> {
    await withWriteLock(async () => {
      const list = normalizeList(await readRaw());
      const target = list.find((record) => record.id === id);
      if (!target) return;
      target.status = status;
      target.updatedAt = new Date().toISOString();
      await writeRaw(list);
    });
  },

  async exportApplicationsToCSV(): Promise<string> {
    const list = await this.getApplications();
    const headers = ['公司名称', '岗位名称', '投递日期', '当前状态', '投递链接', '期望/标明薪资', '使用简历版本', '备忘笔记', '最后更新时间'];
    const statusMap: Record<ApplicationStatus, string> = {
      applied: '已投递', screening: '简历初筛', assessment: '笔试/测评', interview1: '技术一面',
      interview2: '复试/二面', hr: 'HR终面', offer: '已录用 (Offer)', rejected: '流程结束',
    };
    const quote = (value: unknown) => `"${String(value || '').replace(/"/g, '""')}"`;
    const rows = list.map((item) => [
      quote(item.companyName), quote(item.jobTitle), item.appliedDate || '', statusMap[item.status] || item.status,
      quote(item.jobUrl), quote(item.salary), quote(item.resumeVersionTitle), quote(item.notes), item.updatedAt || '',
    ]);
    return '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  },

  async exportApplicationsToJSON(): Promise<string> {
    return JSON.stringify(await this.getApplications(), null, 2);
  },
};
