import type { PageJobSnapshot } from '../tracker/pageJobExtractor';
import { createApplicationId } from '../tracker/trackerSchema';

const DRAFT_STORAGE_KEY = 'openjobfill_application_tracker_draft';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface ApplicationTrackerDraft {
  id: string;
  clientRequestId: string;
  job: PageJobSnapshot;
  detectedAt: string;
  expiresAt: string;
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

async function readDraft(): Promise<unknown> {
  if (isExtensionEnv()) {
    return new Promise((resolve) => chrome.storage.local.get([DRAFT_STORAGE_KEY], (result) => resolve(result?.[DRAFT_STORAGE_KEY])));
  }
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function writeDraft(value: ApplicationTrackerDraft | null): Promise<void> {
  if (isExtensionEnv()) {
    if (value) await chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: value });
    else await chrome.storage.local.remove(DRAFT_STORAGE_KEY);
    return;
  }
  if (value) localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(value));
  else localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export const applicationDraftStorage = {
  async create(job: PageJobSnapshot, ttlMs = DEFAULT_TTL_MS): Promise<ApplicationTrackerDraft> {
    const detectedAt = new Date().toISOString();
    const draft: ApplicationTrackerDraft = {
      id: createApplicationId('draft'),
      clientRequestId: createApplicationId('application'),
      job,
      detectedAt,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    await writeDraft(draft);
    return draft;
  },

  async get(): Promise<ApplicationTrackerDraft | null> {
    const value = await readDraft();
    if (!isValidDraft(value) || Date.parse(value.expiresAt) <= Date.now()) {
      if (value) await writeDraft(null);
      return null;
    }
    return value;
  },

  async clear(): Promise<void> {
    await writeDraft(null);
  },
};
