import type { StandardResume } from '../../types/resume';
import { EMPTY_RESUME, DEMO_RESUME, DEFAULT_RESUME } from './defaultData';
import { parseResumePayload } from '../schema/resumeSchema';

const STORAGE_KEY_RESUMES = 'openjobfill_resumes';
export const RESUME_STORAGE_INDEX_KEY = 'openjobfill_resume_ids';
const STORAGE_KEY_ACTIVE_ID = 'openjobfill_active_resume_id';
export const RESUME_STORAGE_ENTRY_PREFIX = 'openjobfill_resume_';

export const RESUME_STORAGE_MESSAGE_TYPES = {
  SAVE: 'RESUME_STORAGE_SAVE',
  UPDATE_FIELDS: 'RESUME_STORAGE_UPDATE_FIELDS',
  APPEND_ARRAY_ITEM: 'RESUME_STORAGE_APPEND_ARRAY_ITEM',
  REPLACE_ALL: 'RESUME_STORAGE_REPLACE_ALL',
  DELETE: 'RESUME_STORAGE_DELETE',
} as const;

function getResumeEntryKey(id: string): string {
  return `${RESUME_STORAGE_ENTRY_PREFIX}${id}`;
}

function nextResumeUpdatedAt(previous: unknown): number {
  const now = Date.now();
  const previousTimestamp = typeof previous === 'number' && Number.isFinite(previous)
    ? previous
    : Number(previous);
  return Number.isFinite(previousTimestamp)
    ? Math.max(now, previousTimestamp + 1)
    : now;
}

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function parseResumePath(path: string): string[] {
  if (typeof path !== 'string') throw new Error('简历字段路径必须是字符串');
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => UNSAFE_PATH_SEGMENTS.has(part))) {
    throw new Error(`简历字段路径无效：${path}`);
  }
  return parts;
}

function createDefaultResumeList(): StandardResume[] {
  return [normalizeResume(DEFAULT_RESUME)];
}

export function normalizeResume(
  data: Partial<StandardResume> | null | undefined,
  options: { strict?: boolean; regenerateMetadata?: boolean; fallbackTitle?: string } = {},
): StandardResume {
  const source = data && typeof data === 'object' ? data : EMPTY_RESUME;
  const result = parseResumePayload(source, options);
  if (options.strict === false && result.issues.length > 0) {
    console.warn('[OpenJobFill] 已修复损坏的本地简历字段：', result.issues);
  }
  return result.resume;
}

class ResumeStorage {
  private isExtensionEnv(): boolean {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage && !!chrome.storage.local;
    } catch {
      return false;
    }
  }

  private getFromLocalStorage(): StandardResume[] {
    const data = localStorage.getItem(STORAGE_KEY_RESUMES);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((resume) => normalizeResume(resume, { strict: false }));
        }
      } catch (e) {
        console.error('Failed to parse resumes from localStorage', e);
        // Keep the original bytes recoverable. A downgrade or corrupt payload must
        // not be overwritten with defaults merely because the current reader rejects it.
        return createDefaultResumeList();
      }
    }
    const defaults = createDefaultResumeList();
    localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(defaults));
    return defaults;
  }

  private getExtensionValues(keys: string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(`读取简历存储失败：${error.message || '浏览器存储不可用'}`));
          return;
        }
        resolve(result || {});
      });
    });
  }

  private setExtensionValues(values: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(`保存简历失败：${error.message || '浏览器存储不可用'}`));
          return;
        }
        resolve();
      });
    });
  }

  private removeExtensionValues(keys: string[]): Promise<void> {
    if (keys.length === 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(new Error(`清理简历存储失败：${error.message || '浏览器存储不可用'}`));
          return;
        }
        resolve();
      });
    });
  }

  private shouldBrokerWrites(): boolean {
    return this.isExtensionEnv()
      && typeof window !== 'undefined'
      && typeof chrome.runtime?.sendMessage === 'function';
  }

  private async getExtensionResumeIndex(): Promise<string[]> {
    const result = await this.getExtensionValues([RESUME_STORAGE_INDEX_KEY]);
    return Array.isArray(result[RESUME_STORAGE_INDEX_KEY])
      ? Array.from(new Set(result[RESUME_STORAGE_INDEX_KEY].filter((id): id is string => typeof id === 'string' && id.length > 0)))
      : [];
  }

  private async writeResumeEntries(resumes: StandardResume[], previousIds: string[] = []): Promise<void> {
    const values: Record<string, unknown> = {
      [RESUME_STORAGE_INDEX_KEY]: resumes.map((resume) => resume.id),
    };
    for (const resume of resumes) values[getResumeEntryKey(resume.id)] = resume;
    await this.setExtensionValues(values);

    const removedIds = previousIds.filter((id) => !resumes.some((resume) => resume.id === id));
    await this.removeExtensionValues(removedIds.map(getResumeEntryKey));
  }

  private async migrateLegacyResumes(legacy: unknown): Promise<StandardResume[] | null> {
    if (!Array.isArray(legacy) || legacy.length === 0) return null;
    const resumes = legacy.map((resume) => normalizeResume(resume, { strict: false }));
    await this.writeResumeEntries(resumes);
    return resumes;
  }

  /**
   * 获取所有存储的简历列表
   */
  async getAllResumes(): Promise<StandardResume[]> {
    if (this.isExtensionEnv()) {
      const result = await this.getExtensionValues([RESUME_STORAGE_INDEX_KEY, STORAGE_KEY_RESUMES]);
      const index = Array.isArray(result[RESUME_STORAGE_INDEX_KEY])
        ? Array.from(new Set(result[RESUME_STORAGE_INDEX_KEY].filter((id): id is string => typeof id === 'string' && id.length > 0)))
        : [];

      if (index.length > 0) {
        const entries = await this.getExtensionValues(index.map(getResumeEntryKey));
        const resumes = index
          .map((id) => entries[getResumeEntryKey(id)])
          .filter((resume): resume is Partial<StandardResume> => !!resume && typeof resume === 'object')
          .map((resume) => normalizeResume(resume, { strict: false }));
        if (resumes.length > 0) return resumes;
      }

      const migrated = await this.migrateLegacyResumes(result[STORAGE_KEY_RESUMES]);
      if (migrated) return migrated;

      // 首次安装时直接初始化底层存储。不能调用 saveResume()：
      // saveResume() 会再次调用 getAllResumes()，从而在空存储上无限递归。
      const defaults = createDefaultResumeList();
      await this.writeResumeEntries(defaults);
      return defaults;
    } else {
      return this.getFromLocalStorage();
    }
  }

  /**
   * 获取当前选中的激活简历
   */
  async getActiveResume(): Promise<StandardResume> {
    const resumes = await this.getAllResumes();
    if (resumes.length === 0) {
      return createDefaultResumeList()[0];
    }

    let activeId: string | null = null;
    if (this.isExtensionEnv()) {
      const result = await this.getExtensionValues([STORAGE_KEY_ACTIVE_ID]);
      activeId = typeof result[STORAGE_KEY_ACTIVE_ID] === 'string'
        ? result[STORAGE_KEY_ACTIVE_ID] as string
        : null;
    } else {
      activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    }

    if (activeId) {
      const found = resumes.find((r) => r.id === activeId);
      if (found) return found;
    }

    const defaultResume = resumes.find((r) => r.isDefault) || resumes[0];
    return defaultResume;
  }

  /**
   * 设置当前激活的简历 ID
   */
  async setActiveResumeId(id: string): Promise<void> {
    if (this.isExtensionEnv()) {
      await this.setExtensionValues({ [STORAGE_KEY_ACTIVE_ID]: id });
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    }
  }

  /**
   * 保存或更新单份简历
   */
  async saveResume(resume: StandardResume): Promise<void> {
    if (this.shouldBrokerWrites()) {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: RESUME_STORAGE_MESSAGE_TYPES.SAVE,
          payload: { resume },
        }, (response?: { success?: boolean; error?: string }) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(new Error(`保存简历失败：${error.message || 'background 不可用'}`));
          } else if (!response?.success) {
            reject(new Error(response?.error || '保存简历失败'));
          } else {
            resolve();
          }
        });
      });
      return;
    }
    await this.saveResumeDirect(resume);
  }

  /** Background 专用：所有窗口/页面的写入最终在此串行化入口执行。 */
  async saveResumeDirect(resume: StandardResume): Promise<void> {
    const cleanResume = normalizeResume(resume, { strict: true });
    if (this.isExtensionEnv()) {
      const index = await this.getExtensionResumeIndex();
      const stored = await this.getExtensionValues([getResumeEntryKey(cleanResume.id)]);
      const storedResume = stored[getResumeEntryKey(cleanResume.id)];
      const exists = !!storedResume || index.includes(cleanResume.id);
      cleanResume.updatedAt = nextResumeUpdatedAt(
        storedResume && typeof storedResume === 'object'
          ? (storedResume as Partial<StandardResume>).updatedAt
          : undefined,
      );
      if (exists) {
        await this.setExtensionValues({ [getResumeEntryKey(cleanResume.id)]: cleanResume });
      } else {
        await this.setExtensionValues({
          [getResumeEntryKey(cleanResume.id)]: cleanResume,
          [RESUME_STORAGE_INDEX_KEY]: [...index, cleanResume.id],
        });
      }
      return;
    }

    const resumes = await this.getAllResumes();
    const index = resumes.findIndex((r) => r.id === cleanResume.id);
    
    cleanResume.updatedAt = nextResumeUpdatedAt(index >= 0 ? resumes[index].updatedAt : undefined);
    if (index >= 0) {
      resumes[index] = cleanResume;
    } else {
      resumes.push(cleanResume);
    }

    localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(resumes));
  }

  /**
   * 以字段路径更新最新简历快照，供 content script 的学习器等并发调用方使用。
   * updates 的 key 支持 basics.name、qaBank 等点号路径。
   */
  async updateResumeFields(id: string, updates: Record<string, unknown>): Promise<void> {
    if (this.shouldBrokerWrites()) {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: RESUME_STORAGE_MESSAGE_TYPES.UPDATE_FIELDS,
          payload: { id, updates },
        }, (response?: { success?: boolean; error?: string }) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(`更新简历失败：${error.message || 'background 不可用'}`));
          else if (!response?.success) reject(new Error(response?.error || '更新简历失败'));
          else resolve();
        });
      });
      return;
    }
    await this.updateResumeFieldsDirect(id, updates);
  }

  async updateResumeFieldsDirect(id: string, updates: Record<string, unknown>): Promise<void> {
    if (!id || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('简历更新参数无效');
    }
    const current = (await this.getAllResumes()).find((resume) => resume.id === id);
    if (!current) throw new Error(`找不到要更新的简历：${id}`);
    const next = normalizeResume(current, { strict: true });
    for (const [path, value] of Object.entries(updates)) {
      const parts = parseResumePath(path);
      let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (const part of parts.slice(0, -1)) {
        const existing = target[part];
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
      target[parts[parts.length - 1]] = value;
    }
    await this.saveResumeDirect(next);
  }

  async appendResumeArrayItem(id: string, path: string, item: unknown): Promise<void> {
    if (this.shouldBrokerWrites()) {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: RESUME_STORAGE_MESSAGE_TYPES.APPEND_ARRAY_ITEM,
          payload: { id, path, item },
        }, (response?: { success?: boolean; error?: string }) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(`更新简历失败：${error.message || 'background 不可用'}`));
          else if (!response?.success) reject(new Error(response?.error || '更新简历失败'));
          else resolve();
        });
      });
      return;
    }
    await this.appendResumeArrayItemDirect(id, path, item);
  }

  async appendResumeArrayItemDirect(id: string, path: string, item: unknown): Promise<void> {
    if (!id) throw new Error('简历 ID 无效');
    const current = (await this.getAllResumes()).find((resume) => resume.id === id);
    if (!current) throw new Error(`找不到要更新的简历：${id}`);
    const parts = parseResumePath(path);
    let target: unknown = current;
    for (const part of parts) {
      if (!target || typeof target !== 'object') throw new Error(`简历数组路径无效：${path}`);
      target = (target as Record<string, unknown>)[part];
    }
    if (!Array.isArray(target)) throw new Error(`目标字段不是数组：${path}`);
    await this.updateResumeFieldsDirect(id, { [path]: [...target, item] });
  }

  /**
   * 完全替换覆盖所有简历列表 (用于备份全量覆盖恢复，杜绝留存遗留数据)
   */
  async replaceAllResumes(resumes: StandardResume[]): Promise<void> {
    if (this.shouldBrokerWrites()) {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: RESUME_STORAGE_MESSAGE_TYPES.REPLACE_ALL,
          payload: { resumes },
        }, (response?: { success?: boolean; error?: string }) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(`恢复简历失败：${error.message || 'background 不可用'}`));
          else if (!response?.success) reject(new Error(response?.error || '恢复简历失败'));
          else resolve();
        });
      });
      return;
    }
    const sanitized = (resumes && resumes.length > 0 ? resumes : [DEFAULT_RESUME])
      .map((resume) => normalizeResume(resume, { strict: true }));
    if (this.isExtensionEnv()) {
      const previousIds = await this.getExtensionResumeIndex();
      await this.writeResumeEntries(sanitized, previousIds);
    } else {
      localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(sanitized));
    }
  }

  /**
   * 删除指定简历
   */
  async deleteResume(id: string): Promise<void> {
    if (this.shouldBrokerWrites()) {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: RESUME_STORAGE_MESSAGE_TYPES.DELETE,
          payload: { id },
        }, (response?: { success?: boolean; error?: string }) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(`删除简历失败：${error.message || 'background 不可用'}`));
          else if (!response?.success) reject(new Error(response?.error || '删除简历失败'));
          else resolve();
        });
      });
      return;
    }
    let resumes = await this.getAllResumes();
    resumes = resumes.filter((r) => r.id !== id);

    if (resumes.length === 0) {
      resumes = [DEFAULT_RESUME];
    }

    if (this.isExtensionEnv()) {
      const previousIds = await this.getExtensionResumeIndex();
      await this.writeResumeEntries(resumes, previousIds);
    } else {
      localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(resumes));
    }
  }

  /**
   * 导入 JSON 简历 (带深度结构校验与安全默认值)
   */
  async importResumeFromJson(jsonString: string): Promise<StandardResume> {
    const parsed = JSON.parse(jsonString) as Partial<StandardResume>;
    const newResume = normalizeResume(parsed, {
      strict: true,
      regenerateMetadata: true,
      fallbackTitle: `导入的简历 (${new Date().toLocaleDateString()})`,
    });

    await this.saveResume(newResume);
    return newResume;
  }

  /**
   * 导出指定简历为 JSON 字符串
   */
  exportResumeAsJson(resume: StandardResume): string {
    return JSON.stringify(resume, null, 2);
  }
}

export const resumeStorage = new ResumeStorage();
