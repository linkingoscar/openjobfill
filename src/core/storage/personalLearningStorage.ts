import type { PersonalSiteCompatibility, PersonalSiteMapping } from './personalSiteLearning';
import { createCompatibility, markSelectorFingerprintConflict, recordMappingVerification, updateCompatibility } from './personalSiteLearning';

const MAPPINGS_KEY = 'openjobfill_personal_site_mappings_v1';
const COMPATIBILITY_KEY = 'openjobfill_personal_compatibility_v1';

function extensionStorageAvailable(): boolean {
  try { return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local; } catch { return false; }
}

async function read<T>(key: string, fallback: T): Promise<T> {
  if (extensionStorageAvailable()) {
    return new Promise((resolve) => chrome.storage.local.get([key], (result) => resolve((result?.[key] as T) ?? fallback)));
  }
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}

async function write<T>(key: string, value: T): Promise<void> {
  if (extensionStorageAvailable()) {
    await new Promise<void>((resolve, reject) => chrome.storage.local.set({ [key]: value }, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export const personalLearningStorage = {
  async getMappings(): Promise<PersonalSiteMapping[]> {
    return (await read<PersonalSiteMapping[]>(MAPPINGS_KEY, [])).filter((item) => item && item.id && item.hostname && item.resumeKey);
  },

  async saveMapping(mapping: PersonalSiteMapping): Promise<void> {
    const mappings = await this.getMappings();
    const index = mappings.findIndex((item) => item.id === mapping.id);
    if (index >= 0) mappings[index] = mapping; else mappings.push(mapping);
    await write(MAPPINGS_KEY, mappings);
  },

  async recordMappingResult(id: string, verified: boolean, reason?: string): Promise<PersonalSiteMapping | null> {
    const mappings = await this.getMappings();
    const index = mappings.findIndex((item) => item.id === id);
    if (index < 0) return null;
    mappings[index] = recordMappingVerification(mappings[index], { verified, reason });
    await write(MAPPINGS_KEY, mappings);
    return mappings[index];
  },

  async markMappingConflict(id: string, reason?: string): Promise<PersonalSiteMapping | null> {
    const mappings = await this.getMappings();
    const index = mappings.findIndex((item) => item.id === id);
    if (index < 0) return null;
    mappings[index] = markSelectorFingerprintConflict(mappings[index], reason);
    await write(MAPPINGS_KEY, mappings);
    return mappings[index];
  },

  async getCompatibilityMatrix(): Promise<PersonalSiteCompatibility[]> {
    return await read<PersonalSiteCompatibility[]>(COMPATIBILITY_KEY, []);
  },

  async recordCompatibility(hostname: string, module: Parameters<typeof updateCompatibility>[1], result: Parameters<typeof updateCompatibility>[2], options: Parameters<typeof updateCompatibility>[3] = {}): Promise<PersonalSiteCompatibility> {
    const matrix = await this.getCompatibilityMatrix();
    const index = matrix.findIndex((item) => item.hostname === hostname);
    const current = index >= 0 ? matrix[index] : createCompatibility(hostname);
    const next = updateCompatibility(current, module, result, options);
    if (index >= 0) matrix[index] = next; else matrix.push(next);
    await write(COMPATIBILITY_KEY, matrix);
    return next;
  },

  async exportAll(): Promise<string> {
    return JSON.stringify({ mappings: await this.getMappings(), compatibility: await this.getCompatibilityMatrix(), exportedAt: Date.now() }, null, 2);
  },

  async clear(): Promise<void> {
    await write(MAPPINGS_KEY, []);
    await write(COMPATIBILITY_KEY, []);
  },
};
