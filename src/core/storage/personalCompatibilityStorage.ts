import type { FillLogItem } from '../../types/adapter';
import type { FillPlan, FillPlanItem } from '../../types/pipeline';
import {
  createCompatibility,
  markPersonalVerified,
  updateCompatibility,
  type CompatibilityModule,
  type PersonalSiteCompatibility,
} from './personalSiteLearning';

export const PERSONAL_COMPATIBILITY_STORAGE_KEY = 'openjobfill_personal_compatibility_v1';

function isExtensionEnv(): boolean {
  try { return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local; }
  catch { return false; }
}

function normalizeList(value: unknown): PersonalSiteCompatibility[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PersonalSiteCompatibility =>
    !!item && typeof item === 'object' && typeof (item as PersonalSiteCompatibility).hostname === 'string'
  );
}

async function readAll(): Promise<PersonalSiteCompatibility[]> {
  if (isExtensionEnv()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([PERSONAL_COMPATIBILITY_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) resolve([]);
        else resolve(normalizeList(result?.[PERSONAL_COMPATIBILITY_STORAGE_KEY]));
      });
    });
  }
  try { return normalizeList(JSON.parse(localStorage.getItem(PERSONAL_COMPATIBILITY_STORAGE_KEY) || '[]')); }
  catch { return []; }
}

async function writeAll(items: PersonalSiteCompatibility[]): Promise<void> {
  const normalized = items.slice(0, 100);
  if (isExtensionEnv()) {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [PERSONAL_COMPATIBILITY_STORAGE_KEY]: normalized }, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || '保存个人兼容性记录失败'));
        else resolve();
      });
    });
    return;
  }
  localStorage.setItem(PERSONAL_COMPATIBILITY_STORAGE_KEY, JSON.stringify(normalized));
}

function moduleForItem(item: FillPlanItem): CompatibilityModule {
  const key = item.semanticKey || '';
  const section = item.field.section?.type;
  if (key.startsWith('qaBank.') || section === 'qa') return 'qa';
  if (section === 'education' || key.startsWith('educations.')) return 'education';
  if (section === 'experience' || key.startsWith('experiences.')) return 'experience';
  if (section === 'project' || key.startsWith('projects.')) return 'project';
  if (item.field.type === 'date' || item.field.type === 'date-range' || /Date$|\.startDate$|\.endDate$/.test(key)) return 'date';
  if (item.field.type === 'cascader' || /Location|Place|City|province|district|address/i.test(key)) return 'region';
  return 'basics';
}

function resultForItems(items: FillPlanItem[]): 'PASS' | 'PARTIAL' | 'FAIL' {
  const statuses = items.map((item) => item.verificationStatus);
  if (statuses.some((status) => status === 'MISMATCH' || status === 'UNREADABLE' || !status)) return 'FAIL';
  if (statuses.some((status) => status === 'PARTIALLY_VERIFIED' || status === 'NOT_HANDLED')) return 'PARTIAL';
  return 'PASS';
}

function failureCodeForItems(items: FillPlanItem[], logs: FillLogItem[]): string | undefined {
  for (const item of items) {
    const log = logs.find((candidate) => candidate.status === 'failed' && (
      (!!item.semanticKey && candidate.field === item.semanticKey) || candidate.label === item.field.label
    ));
    if (log?.failureCode) return log.failureCode;
  }
  return undefined;
}

function hostFor(rawUrl: string): { hostname: string; urlScope: string } | null {
  try {
    const url = new URL(rawUrl);
    return { hostname: url.hostname.toLowerCase(), urlScope: url.origin };
  } catch { return null; }
}

export const personalCompatibilityStorage = {
  getAll: readAll,

  async getForUrl(rawUrl: string): Promise<PersonalSiteCompatibility | null> {
    const host = hostFor(rawUrl);
    if (!host) return null;
    return (await readAll()).find((item) => item.hostname === host.hostname) || null;
  },

  /** Persist one module result; used by attachments and other non-FillPlan flows. */
  async recordModuleResult(
    rawUrl: string,
    module: CompatibilityModule,
    result: 'PASS' | 'PARTIAL' | 'FAIL',
    failureCode?: string,
  ): Promise<PersonalSiteCompatibility | null> {
    const host = hostFor(rawUrl);
    if (!host) return null;
    const all = await readAll();
    const index = all.findIndex((item) => item.hostname === host.hostname);
    const current = index >= 0 ? all[index] : createCompatibility(host.hostname);
    const next = updateCompatibility(current, module, result, {
      urlScope: host.urlScope,
      failureCode,
    });
    const limitations = new Set(next.knownLimitations || []);
    if (result === 'FAIL' && failureCode) limitations.add(`${module}:${failureCode}`);
    if (result === 'PASS') {
      for (const entry of [...limitations]) if (entry.startsWith(`${module}:`)) limitations.delete(entry);
    }
    next.knownLimitations = [...limitations].slice(0, 20);
    if (index >= 0) all[index] = next; else all.unshift(next);
    await writeAll(all);
    return next;
  },

  /** Convert strict field read-back outcomes into a value-free personal compatibility matrix. */
  async recordPlanOutcome(rawUrl: string, plan: FillPlan, logs: FillLogItem[] = []): Promise<PersonalSiteCompatibility | null> {
    const attempted = plan.items.filter((item) => item.action === 'FILL');
    if (!attempted.length) return this.getForUrl(rawUrl);
    const grouped = new Map<CompatibilityModule, FillPlanItem[]>();
    for (const item of attempted) {
      const module = moduleForItem(item);
      const list = grouped.get(module) || [];
      list.push(item);
      grouped.set(module, list);
    }
    let latest: PersonalSiteCompatibility | null = null;
    for (const [module, items] of grouped) {
      const result = resultForItems(items);
      latest = await this.recordModuleResult(rawUrl, module, result, result === 'FAIL' ? failureCodeForItems(items, logs) || 'verification_mismatch' : undefined);
    }
    return latest;
  },

  /**
   * Explicitly mark a site PERSONAL_VERIFIED after an external real-flow confirmation step.
   * Passive runtime telemetry and fixture tests never call this method automatically.
   */
  async markPersonalVerified(rawUrl: string, browserVersion?: string): Promise<PersonalSiteCompatibility> {
    const host = hostFor(rawUrl);
    if (!host) throw new Error('站点 URL 无效');
    const all = await readAll();
    const index = all.findIndex((item) => item.hostname === host.hostname);
    const current = index >= 0 ? all[index] : createCompatibility(host.hostname);
    const next = markPersonalVerified(current, { browserVersion, urlScope: host.urlScope });
    if (index >= 0) all[index] = next; else all.unshift(next);
    await writeAll(all);
    return next;
  },

  async clear(): Promise<void> { await writeAll([]); },
};
