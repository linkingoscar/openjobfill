import type { CustomSiteRule, CustomRuleStatus } from '../../types/rule';

const RULES_STORAGE_KEY = 'openjobfill_custom_rules';
const CURRENT_RULE_VERSION = 2 as const;

type LegacyCustomSiteRule = Partial<CustomSiteRule> & {
  selector?: string;
  resumeKey?: string;
  description?: string;
};

function normalizeHostname(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

function normalizePathPrefix(value: unknown): string | undefined {
  const path = String(value || '').trim();
  if (!path) return undefined;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : '/';
}

function isLiteralHostname(value: string): boolean {
  const hostname = value.replace(/^\*\./, '');
  if (hostname === 'localhost') return true;
  if (hostname.length === 0 || hostname.length > 253) return false;
  return hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function hostnameMatches(actual: string, expected: string): boolean {
  const normalizedActual = normalizeHostname(actual);
  const normalizedExpected = normalizeHostname(expected.replace(/^\*\./, ''));
  return normalizedActual === normalizedExpected || normalizedActual.endsWith(`.${normalizedExpected}`);
}

export function customRuleMatchesUrl(rule: CustomSiteRule, rawUrl: string): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (rule.site?.hostname) {
    if (!hostnameMatches(url.hostname, rule.site.hostname)) return false;
    const prefix = normalizePathPrefix(rule.site.pathPrefix);
    return !prefix || prefix === '/' || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
  }
  const pattern = rule.domainPattern.trim();
  if (isLiteralHostname(pattern)) return hostnameMatches(url.hostname, pattern);
  try { return new RegExp(pattern, 'i').test(`${url.hostname}${url.pathname}`); } catch { return false; }
}

const DEFAULT_PRESET_RULES: CustomSiteRule[] = [
  {
    id: 'preset-zhipin', name: 'BOSS直聘 (在线沟通/微简历)', domainPattern: 'zhipin.com', enabled: true,
    fields: [
      { id: 'f-zp-name', selector: 'input[name="name"], input[placeholder*="姓名"]', resumeKey: 'basics.name', description: '姓名' },
      { id: 'f-zp-phone', selector: 'input[name="phone"], input[placeholder*="手机"]', resumeKey: 'basics.phone', description: '手机' },
      { id: 'f-zp-email', selector: 'input[name="email"], input[placeholder*="邮箱"]', resumeKey: 'basics.email', description: '邮箱' },
      { id: 'f-zp-role', selector: 'input[placeholder*="期望职位"]', resumeKey: 'basics.expectedRole', description: '期望职位' },
    ], updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-liepin', name: '猎聘网 (Liepin)', domainPattern: 'liepin.com', enabled: true,
    fields: [
      { id: 'f-lp-name', selector: 'input[placeholder*="姓名"], input[name*="name"]', resumeKey: 'basics.name', description: '姓名' },
      { id: 'f-lp-phone', selector: 'input[placeholder*="手机"], input[name*="mobile"]', resumeKey: 'basics.phone', description: '手机号' },
      { id: 'f-lp-email', selector: 'input[placeholder*="邮箱"], input[name*="email"]', resumeKey: 'basics.email', description: '邮箱' },
    ], updatedAt: new Date().toISOString(),
  },
];

function isExtensionEnv(): boolean {
  try { return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage && !!chrome.storage.local; } catch { return false; }
}

function hasBalancedSelectorDelimiters(selector: string): boolean {
  const stack: string[] = []; let quote = ''; let escaped = false;
  for (const char of selector) {
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '[' || char === '(') stack.push(char);
    if (char === ']' || char === ')') {
      const expected = char === ']' ? '[' : '(';
      if (stack.pop() !== expected) return false;
    }
  }
  return !quote && stack.length === 0 && !escaped;
}

export function validateCustomSiteRule(rule: CustomSiteRule, doc?: Document): string | null {
  if (!rule?.id || !rule.name?.trim()) return '规则名称不能为空';
  if (!rule.domainPattern?.trim()) return '域名匹配模式不能为空';
  if (rule.site) {
    if (!normalizeHostname(rule.site.hostname) || !isLiteralHostname(rule.site.hostname)) return `站点 hostname 无效：${rule.site.hostname}`;
    if (rule.site.pathPrefix && /[?#]/.test(rule.site.pathPrefix)) return '站点路径范围不能包含查询参数或 hash';
  }
  try { new RegExp(rule.domainPattern, 'i'); } catch { return `域名匹配模式不是有效文本或正则：${rule.domainPattern}`; }
  if (!Array.isArray(rule.fields) || rule.fields.length === 0) return '至少需要配置一个字段映射';
  const validationDocument = doc || (typeof document !== 'undefined' ? document : null);
  for (const [index, field] of rule.fields.entries()) {
    if (!field.selector?.trim()) return `第 ${index + 1} 个字段的 CSS 选择器不能为空`;
    if (!field.resumeKey?.trim()) return `第 ${index + 1} 个字段未选择简历属性`;
    if (!hasBalancedSelectorDelimiters(field.selector)) return `第 ${index + 1} 个字段的 CSS 选择器无效：${field.selector}`;
    if (validationDocument) {
      try { validationDocument.documentElement.matches(field.selector); }
      catch { return `第 ${index + 1} 个字段的 CSS 选择器无效：${field.selector}`; }
    }
  }
  return null;
}

function normalizeStatus(status: unknown): CustomRuleStatus {
  return status === 'STALE' ? 'STALE' : status === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
}

export function normalizeCustomSiteRule(input: LegacyCustomSiteRule): CustomSiteRule | null {
  if (!input || !input.id || !input.domainPattern) return null;
  const fields = Array.isArray(input.fields)
    ? input.fields
    : input.selector && input.resumeKey
      ? [{ id: `field-${input.id}`, selector: input.selector, resumeKey: input.resumeKey, description: input.description }]
      : [];
  return {
    id: input.id,
    version: CURRENT_RULE_VERSION,
    name: input.name?.trim() || `${input.domainPattern} 自定义规则`,
    domainPattern: input.domainPattern,
    site: input.site?.hostname
      ? { hostname: normalizeHostname(input.site.hostname), pathPrefix: normalizePathPrefix(input.site.pathPrefix) }
      : isLiteralHostname(input.domainPattern)
        ? { hostname: normalizeHostname(input.domainPattern.replace(/^\*\./, '')) }
        : undefined,
    enabled: input.enabled !== false,
    fields: fields.map((field) => ({
      ...field,
      status: normalizeStatus(field.status),
      occurrenceMode: field.occurrenceMode || 'NONE',
      successCount: Number.isFinite(field.successCount) ? Math.max(0, Number(field.successCount)) : 0,
      failureCount: Number.isFinite(field.failureCount) ? Math.max(0, Number(field.failureCount)) : 0,
      lastVerifiedAt: Number.isFinite(field.lastVerifiedAt) ? Number(field.lastVerifiedAt) : undefined,
      lastFailureReason: typeof field.lastFailureReason === 'string' ? field.lastFailureReason.slice(0, 120) : undefined,
    })),
    updatedAt: input.updatedAt,
  };
}

export const ruleStorage = {
  async getCustomRules(): Promise<CustomSiteRule[]> {
    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([RULES_STORAGE_KEY], (res) => {
            if (chrome.runtime?.lastError || !res) { resolve(this.getFromLocalStorage()); return; }
            const rules = res[RULES_STORAGE_KEY] as LegacyCustomSiteRule[] | undefined;
            if (!rules || rules.length === 0) {
              const defaults = DEFAULT_PRESET_RULES.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule);
              void this.saveRules(defaults); resolve(defaults);
            } else resolve(rules.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule));
          });
        } catch { resolve(this.getFromLocalStorage()); }
      });
    }
    return this.getFromLocalStorage();
  },

  getFromLocalStorage(): CustomSiteRule[] {
    const data = localStorage.getItem(RULES_STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule);
      } catch {}
    }
    const defaults = DEFAULT_PRESET_RULES.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule);
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  },

  async saveRules(rules: CustomSiteRule[]): Promise<void> {
    const normalizedRules = rules.map((rule) => normalizeCustomSiteRule(rule)).filter((rule): rule is CustomSiteRule => !!rule);
    for (const rule of normalizedRules) {
      const validationError = validateCustomSiteRule(rule);
      if (validationError) throw new Error(`${rule.name}：${validationError}`);
    }
    if (isExtensionEnv()) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set({ [RULES_STORAGE_KEY]: normalizedRules }, () => {
            const error = chrome.runtime?.lastError;
            if (error) reject(new Error(error.message || '保存站点规则失败'));
            else resolve();
          });
        } catch (error) {
          try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(normalizedRules)); resolve(); }
          catch { reject(error); }
        }
      });
    }
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(normalizedRules));
  },

  async saveCustomRule(rule: CustomSiteRule): Promise<void> {
    const normalizedRule = normalizeCustomSiteRule(rule);
    if (!normalizedRule) throw new Error('规则格式不完整');
    const validationError = validateCustomSiteRule(normalizedRule);
    if (validationError) throw new Error(validationError);
    const rules = await this.getCustomRules();
    const index = rules.findIndex((candidate) => candidate.id === normalizedRule.id);
    normalizedRule.updatedAt = new Date().toISOString();
    if (index >= 0) rules[index] = normalizedRule; else rules.push(normalizedRule);
    await this.saveRules(rules);
  },

  async deleteCustomRule(id: string): Promise<void> {
    const rules = await this.getCustomRules();
    await this.saveRules(rules.filter((rule) => rule.id !== id));
  },

  async exportRulesToJson(): Promise<string> { return JSON.stringify(await this.getCustomRules(), null, 2); },

  async importRulesFromJson(jsonStr: string): Promise<number> {
    try {
      const imported = JSON.parse(jsonStr) as CustomSiteRule[];
      if (!Array.isArray(imported)) throw new Error('导入的规则格式不正确，必须为规则数组');
      const current = await this.getCustomRules();
      const map = new Map<string, CustomSiteRule>(); current.forEach((rule) => map.set(rule.id, rule));
      imported.forEach((rawRule, index) => {
        const rule = normalizeCustomSiteRule(rawRule);
        if (!rule) throw new Error(`第 ${index + 1} 条规则格式不完整`);
        const validationError = validateCustomSiteRule(rule);
        if (validationError) throw new Error(`第 ${index + 1} 条规则无效：${validationError}`);
        map.set(rule.id, rule);
      });
      await this.saveRules(Array.from(map.values()));
      return imported.length;
    } catch (err: any) { throw new Error(`规则导入解析失败: ${err.message}`); }
  },

  async findMatchingRuleForUrl(url: string): Promise<CustomSiteRule | null> {
    const rules = await this.getCustomRules();
    for (const rule of rules) if (rule.enabled && customRuleMatchesUrl(rule, url)) return rule;
    return null;
  },

  async bindFieldToSite(
    url: string,
    selector: string,
    resumeKey: string,
    description: string,
    evidence?: { fingerprint?: string; locator?: import('../../types/pipeline').FieldLocatorEvidence },
  ): Promise<CustomSiteRule> {
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch { hostname = url; }
    let rule = await this.findMatchingRuleForUrl(url);
    if (!rule) {
      rule = {
        id: 'rule-' + Date.now(), name: `${hostname} 专属自定义规则`, version: CURRENT_RULE_VERSION,
        domainPattern: hostname, site: { hostname: normalizeHostname(hostname) }, enabled: true, fields: [], updatedAt: new Date().toISOString(),
      };
    }
    const existingFieldIdx = rule.fields.findIndex((field) =>
      field.selector === selector
      || (field.resumeKey === resumeKey && field.status === 'STALE')
      || (!!evidence?.fingerprint && field.fingerprint === evidence.fingerprint)
    );
    const existing = existingFieldIdx >= 0 ? rule.fields[existingFieldIdx] : undefined;
    const newField = {
      id: existing?.id || 'f-' + Date.now(), selector, resumeKey, description,
      fingerprint: evidence?.fingerprint, locator: evidence?.locator,
      status: 'ACTIVE' as const, occurrenceMode: 'NONE' as const,
      successCount: existing?.successCount || 0, failureCount: existing?.failureCount || 0,
      lastVerifiedAt: existing?.lastVerifiedAt, lastFailureReason: undefined,
    };
    if (existingFieldIdx >= 0) rule.fields[existingFieldIdx] = newField; else rule.fields.push(newField);
    await this.saveCustomRule(rule);
    return rule;
  },

  /** Only explicit evidence conflicts are persisted as stale; absence on a multi-step page is not. */
  async markFieldMappingsStale(ruleId: string, fieldIds: string[]): Promise<void> {
    if (fieldIds.length === 0) return;
    const rules = await this.getCustomRules();
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    const staleIds = new Set(fieldIds); let changed = false;
    rule.fields = rule.fields.map((field) => {
      if (!staleIds.has(field.id) || field.status === 'STALE' || field.status === 'DISABLED') return field;
      changed = true;
      return { ...field, status: 'STALE' as const, failureCount: (field.failureCount || 0) + 1, lastFailureReason: 'selector_fingerprint_conflict' };
    });
    if (changed) await this.saveCustomRule(rule);
  },

  /** Feed strict read-back verification back into learned mappings without storing field values. */
  async recordFieldVerification(ruleId: string, fieldId: string, verified: boolean, reason?: string, now = Date.now()): Promise<void> {
    const rules = await this.getCustomRules();
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    const index = rule.fields.findIndex((field) => field.id === fieldId);
    if (index < 0) return;
    const field = rule.fields[index];
    if (field.status === 'DISABLED') return;
    const successCount = field.successCount || 0;
    const failureCount = field.failureCount || 0;
    rule.fields[index] = verified
      ? { ...field, status: 'ACTIVE', successCount: successCount + 1, lastVerifiedAt: now, lastFailureReason: undefined }
      : {
          ...field,
          status: failureCount + 1 >= 2 ? 'STALE' : field.status,
          failureCount: failureCount + 1,
          lastFailureReason: (reason || 'verification_mismatch').slice(0, 120),
        };
    await this.saveCustomRule(rule);
  },

  /** Explicit user control over one learned mapping; DISABLED entries never participate in matching. */
  async setFieldMappingStatus(ruleId: string, fieldId: string, status: CustomRuleStatus): Promise<void> {
    const rules = await this.getCustomRules();
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) throw new Error('找不到站点规则');
    const index = rule.fields.findIndex((field) => field.id === fieldId);
    if (index < 0) throw new Error('找不到字段映射');
    const field = rule.fields[index];
    rule.fields[index] = {
      ...field,
      status,
      lastFailureReason: status === 'ACTIVE' ? undefined : field.lastFailureReason,
    };
    await this.saveCustomRule(rule);
  },
};
