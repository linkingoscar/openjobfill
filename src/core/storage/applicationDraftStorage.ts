import type { PageJobSnapshot } from '../tracker/pageJobExtractor';
import { createApplicationId } from '../tracker/trackerSchema';

const DRAFT_STORAGE_KEY = 'openjobfill_application_tracker_draft';
const scopedKey = (pageUrl: string) => `${DRAFT_STORAGE_KEY}:${encodeURIComponent(new URL(pageUrl).href)}`;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface ApplicationTrackerDraft {
  id: string;
  clientRequestId: string;
  job: PageJobSnapshot;
  detectedAt: string;
  expiresAt: string;
  resumeVersionTitle?: string;
}

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

function isValidDraft(value: unknown): value is ApplicationTrackerDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Partial<ApplicationTrackerDraft>;
  return !!draft.id && !!draft.clientRequestId && !!draft.detectedAt && !!draft.expiresAt
    && !!draft.job?.companyName && !!draft.job?.jobTitle && !!draft.job?.jobUrl;
}

async function readDraft(key: string): Promise<unknown> {
  if (isExtensionEnv()) {
    return new Promise((resolve, reject) => chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result?.[key]);
    }));
  }
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function writeDraft(key: string, value: ApplicationTrackerDraft | null): Promise<void> {
  if (isExtensionEnv()) {
    if (value) await chrome.storage.local.set({ [key]: value });
    else await chrome.storage.local.remove(key);
    return;
  }
  if (value) localStorage.setItem(key, JSON.stringify(value));
  else localStorage.removeItem(key);
}

export const applicationDraftStorage = {
  async create(job: PageJobSnapshot, ttlMs = DEFAULT_TTL_MS, resumeVersionTitle?: string): Promise<ApplicationTrackerDraft> {
    const detectedAt = new Date().toISOString();
    const draft: ApplicationTrackerDraft = {
      id: createApplicationId('draft'),
      clientRequestId: createApplicationId('application'),
      job,
      detectedAt,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      resumeVersionTitle,
    };
    await writeDraft(scopedKey(job.jobUrl), draft);
    return draft;
  },

  async get(pageUrl: string): Promise<ApplicationTrackerDraft | null> {
    const key = scopedKey(pageUrl);
    let value = await readDraft(key);
    // 旧版单一草稿只在来源页面恢复，不挪用到其他岗位，也不删除其他页面的数据。
    if (!value) {
      const legacy = await readDraft(DRAFT_STORAGE_KEY);
      if (isValidDraft(legacy) && legacy.job.jobUrl === pageUrl) {
        value = legacy;
        await writeDraft(key, legacy);
        await writeDraft(DRAFT_STORAGE_KEY, null);
      }
    }
    if (!isValidDraft(value) || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) {
      if (value) await writeDraft(key, null);
      return null;
    }
    return value.job.jobUrl === pageUrl ? value : null;
  },

  async clear(pageUrl: string): Promise<void> {
    await writeDraft(scopedKey(pageUrl), null);
  },
};
