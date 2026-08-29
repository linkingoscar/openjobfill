import type { StandardResume } from '../../types/resume';
import { EMPTY_RESUME, DEMO_RESUME, DEFAULT_RESUME } from './defaultData';

const STORAGE_KEY_RESUMES = 'openjobfill_resumes';
const STORAGE_KEY_ACTIVE_ID = 'openjobfill_active_resume_id';

function createDefaultResumeList(): StandardResume[] {
  return [sanitizeResume(DEFAULT_RESUME)];
}

function sanitizeResume(data: Partial<StandardResume> | null | undefined): StandardResume {
  const base = JSON.parse(JSON.stringify(EMPTY_RESUME)) as StandardResume;
  if (!data || typeof data !== 'object') return base;

  return {
    ...base,
    ...data,
    id: data.id || ('resume-' + Date.now()),
    title: data.title || '我的求职档案',
    isDefault: Boolean(data.isDefault),
    schemaVersion: 3,
    createdAt: Number(data.createdAt) || Date.now(),
    updatedAt: Number(data.updatedAt) || Date.now(),
    basics: {
      ...base.basics,
      ...(data.basics || {}),
      currentLocation: {
        ...(base.basics.currentLocation || {}),
        ...(data.basics?.currentLocation || {}),
      },
      nativePlace: {
        ...(base.basics.nativePlace || {}),
        ...(data.basics?.nativePlace || {}),
      },
      hukouLocation: {
        ...(base.basics.hukouLocation || {}),
        ...(data.basics?.hukouLocation || {}),
      },
    },
    educations: Array.isArray(data.educations) ? data.educations : [],
    experiences: Array.isArray(data.experiences) ? data.experiences : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    languages: Array.isArray(data.languages) ? data.languages : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    certificates: Array.isArray(data.certificates) ? data.certificates : [],
    familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
    qaBank: Array.isArray(data.qaBank) ? data.qaBank.map(item => ({
      ...item,
      scope: item.scope || (item.domain ? 'domain' : 'global'),
    })) : [],
  };
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
          return parsed.map(sanitizeResume);
        }
      } catch (e) {
        console.error('Failed to parse resumes from localStorage', e);
      }
    }
    const defaults = createDefaultResumeList();
    localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(defaults));
    return defaults;
  }

  /**
   * 获取所有存储的简历列表
   */
  async getAllResumes(): Promise<StandardResume[]> {
    if (this.isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([STORAGE_KEY_RESUMES], (result) => {
            if (chrome.runtime?.lastError || !result) {
              resolve(createDefaultResumeList());
              return;
            }
            const stored = result[STORAGE_KEY_RESUMES];
            if (Array.isArray(stored) && stored.length > 0) {
              resolve(stored.map(sanitizeResume));
            } else {
              // 首次安装时直接初始化底层存储。不能调用 saveResume()：
              // saveResume() 会再次调用 getAllResumes()，从而在空存储上无限递归。
              const defaults = createDefaultResumeList();
              chrome.storage.local.set({ [STORAGE_KEY_RESUMES]: defaults }, () => {
                resolve(defaults);
              });
            }
          });
        } catch {
          resolve(this.getFromLocalStorage());
        }
      });
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
      activeId = await new Promise((resolve) => {
        try {
          chrome.storage.local.get([STORAGE_KEY_ACTIVE_ID], (result) => {
            if (chrome.runtime?.lastError) {
              resolve(localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
              return;
            }
            resolve(result?.[STORAGE_KEY_ACTIVE_ID] || null);
          });
        } catch {
          resolve(localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
        }
      });
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
      await new Promise<void>((resolve) => {
        try {
          chrome.storage.local.set({ [STORAGE_KEY_ACTIVE_ID]: id }, () => resolve());
        } catch {
          localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
          resolve();
        }
      });
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    }
  }

  /**
   * 保存或更新单份简历
   */
  async saveResume(resume: StandardResume): Promise<void> {
    const cleanResume = sanitizeResume(resume);
    const resumes = await this.getAllResumes();
    const index = resumes.findIndex((r) => r.id === cleanResume.id);
    
    cleanResume.updatedAt = Date.now();
    if (index >= 0) {
      resumes[index] = cleanResume;
    } else {
      resumes.push(cleanResume);
    }

    if (this.isExtensionEnv()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY_RESUMES]: resumes }, () => resolve());
      });
    } else {
      localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(resumes));
    }
  }

  /**
   * 完全替换覆盖所有简历列表 (用于备份全量覆盖恢复，杜绝留存遗留数据)
   */
  async replaceAllResumes(resumes: StandardResume[]): Promise<void> {
    const sanitized = (resumes && resumes.length > 0 ? resumes : [DEFAULT_RESUME]).map(sanitizeResume);
    if (this.isExtensionEnv()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY_RESUMES]: sanitized }, () => resolve());
      });
    } else {
      localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(sanitized));
    }
  }

  /**
   * 删除指定简历
   */
  async deleteResume(id: string): Promise<void> {
    let resumes = await this.getAllResumes();
    resumes = resumes.filter((r) => r.id !== id);

    if (resumes.length === 0) {
      resumes = [DEFAULT_RESUME];
    }

    if (this.isExtensionEnv()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY_RESUMES]: resumes }, () => resolve());
      });
    } else {
      localStorage.setItem(STORAGE_KEY_RESUMES, JSON.stringify(resumes));
    }
  }

  /**
   * 导入 JSON 简历 (带深度结构校验与安全默认值)
   */
  async importResumeFromJson(jsonString: string): Promise<StandardResume> {
    const parsed = JSON.parse(jsonString) as Partial<StandardResume>;
    const newResume = sanitizeResume({
      ...parsed,
      id: 'resume-' + Date.now(),
      title: parsed.title || `导入的简历 (${new Date().toLocaleDateString()})`,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
