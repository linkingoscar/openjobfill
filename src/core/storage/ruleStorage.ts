import type { CustomSiteRule } from '../../types/rule';

const RULES_STORAGE_KEY = 'openjobfill_custom_rules';

type LegacyCustomSiteRule = Partial<CustomSiteRule> & {
  selector?: string;
  resumeKey?: string;
  description?: string;
};

const DEFAULT_PRESET_RULES: CustomSiteRule[] = [
  {
    id: 'preset-zhipin',
    name: 'BOSS直聘 (在线沟通/微简历)',
    domainPattern: 'zhipin.com',
    enabled: true,
    fields: [
      { id: 'f-zp-name', selector: 'input[name="name"], input[placeholder*="姓名"]', resumeKey: 'basics.name', description: '姓名' },
      { id: 'f-zp-phone', selector: 'input[name="phone"], input[placeholder*="手机"]', resumeKey: 'basics.phone', description: '手机' },
      { id: 'f-zp-email', selector: 'input[name="email"], input[placeholder*="邮箱"]', resumeKey: 'basics.email', description: '邮箱' },
      { id: 'f-zp-role', selector: 'input[placeholder*="期望职位"]', resumeKey: 'basics.expectedRole', description: '期望职位' }
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-liepin',
    name: '猎聘网 (Liepin)',
    domainPattern: 'liepin.com',
    enabled: true,
    fields: [
      { id: 'f-lp-name', selector: 'input[placeholder*="姓名"], input[name*="name"]', resumeKey: 'basics.name', description: '姓名' },
      { id: 'f-lp-phone', selector: 'input[placeholder*="手机"], input[name*="mobile"]', resumeKey: 'basics.phone', description: '手机号' },
      { id: 'f-lp-email', selector: 'input[placeholder*="邮箱"], input[name*="email"]', resumeKey: 'basics.email', description: '邮箱' }
    ],
    updatedAt: new Date().toISOString()
  }
];

function isExtensionEnv(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

function hasBalancedSelectorDelimiters(selector: string): boolean {
  const stack: string[] = [];
  let quote = '';
  let escaped = false;
  for (const char of selector) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
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

  try {
    new RegExp(rule.domainPattern, 'i');
  } catch {
    return `域名匹配模式不是有效文本或正则：${rule.domainPattern}`;
  }

  if (!Array.isArray(rule.fields) || rule.fields.length === 0) {
    return '至少需要配置一个字段映射';
  }

  const validationDocument = doc || (typeof document !== 'undefined' ? document : null);
  for (const [index, field] of rule.fields.entries()) {
    if (!field.selector?.trim()) return `第 ${index + 1} 个字段的 CSS 选择器不能为空`;
    if (!field.resumeKey?.trim()) return `第 ${index + 1} 个字段未选择简历属性`;
    if (!hasBalancedSelectorDelimiters(field.selector)) {
      return `第 ${index + 1} 个字段的 CSS 选择器无效：${field.selector}`;
    }
    if (validationDocument) {
      try {
        validationDocument.documentElement.matches(field.selector);
      } catch {
        return `第 ${index + 1} 个字段的 CSS 选择器无效：${field.selector}`;
      }
    }
  }

  return null;
}

/** 将早期“一条规则只含一个 selector”的备份格式迁移为当前 fields[] 结构。 */
export function normalizeCustomSiteRule(input: LegacyCustomSiteRule): CustomSiteRule | null {
  if (!input || !input.id || !input.domainPattern) return null;
  const fields = Array.isArray(input.fields)
    ? input.fields
    : input.selector && input.resumeKey
      ? [{
          id: `field-${input.id}`,
          selector: input.selector,
          resumeKey: input.resumeKey,
          description: input.description,
        }]
      : [];

  return {
    id: input.id,
    name: input.name?.trim() || `${input.domainPattern} 自定义规则`,
    domainPattern: input.domainPattern,
    enabled: input.enabled !== false,
    fields,
    updatedAt: input.updatedAt,
  };
}

export const ruleStorage = {
  async getCustomRules(): Promise<CustomSiteRule[]> {
    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([RULES_STORAGE_KEY], (res) => {
            if (chrome.runtime?.lastError || !res) {
              resolve(this.getFromLocalStorage());
              return;
            }
            const rules = res[RULES_STORAGE_KEY] as LegacyCustomSiteRule[] | undefined;
            if (!rules || rules.length === 0) {
              this.saveRules(DEFAULT_PRESET_RULES);
              resolve(DEFAULT_PRESET_RULES);
            } else {
              resolve(rules.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule));
            }
          });
        } catch {
          resolve(this.getFromLocalStorage());
        }
      });
    } else {
      return this.getFromLocalStorage();
    }
  },

  getFromLocalStorage(): CustomSiteRule[] {
    const data = localStorage.getItem(RULES_STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeCustomSiteRule).filter((rule): rule is CustomSiteRule => !!rule);
        }
      } catch {}
    }
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_PRESET_RULES));
    return DEFAULT_PRESET_RULES;
  },

  async saveRules(rules: CustomSiteRule[]): Promise<void> {
    const normalizedRules = rules
      .map((rule) => normalizeCustomSiteRule(rule))
      .filter((rule): rule is CustomSiteRule => !!rule);
    for (const rule of normalizedRules) {
      const validationError = validateCustomSiteRule(rule);
      if (validationError) throw new Error(`${rule.name}：${validationError}`);
    }

    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [RULES_STORAGE_KEY]: normalizedRules }, () => resolve());
        } catch {
          localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(normalizedRules));
          resolve();
        }
      });
    } else {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(normalizedRules));
    }
  },

  async saveCustomRule(rule: CustomSiteRule): Promise<void> {
    const normalizedRule = normalizeCustomSiteRule(rule);
    if (!normalizedRule) throw new Error('规则格式不完整');
    const validationError = validateCustomSiteRule(normalizedRule);
    if (validationError) throw new Error(validationError);

    const rules = await this.getCustomRules();
    const index = rules.findIndex((r) => r.id === normalizedRule.id);
    normalizedRule.updatedAt = new Date().toISOString();

    if (index >= 0) {
      rules[index] = normalizedRule;
    } else {
      rules.push(normalizedRule);
    }

    await this.saveRules(rules);
  },

  async deleteCustomRule(id: string): Promise<void> {
    const rules = await this.getCustomRules();
    const filtered = rules.filter((r) => r.id !== id);
    await this.saveRules(filtered);
  },

  async exportRulesToJson(): Promise<string> {
    const rules = await this.getCustomRules();
    return JSON.stringify(rules, null, 2);
  },

  async importRulesFromJson(jsonStr: string): Promise<number> {
    try {
      const imported = JSON.parse(jsonStr) as CustomSiteRule[];
      if (!Array.isArray(imported)) {
        throw new Error('导入的规则格式不正确，必须为规则数组');
      }

      const current = await this.getCustomRules();
      const map = new Map<string, CustomSiteRule>();
      current.forEach((r) => map.set(r.id, r));
      imported.forEach((rawRule, index) => {
        const rule = normalizeCustomSiteRule(rawRule);
        if (!rule) throw new Error(`第 ${index + 1} 条规则格式不完整`);
        const validationError = validateCustomSiteRule(rule);
        if (validationError) throw new Error(`第 ${index + 1} 条规则无效：${validationError}`);
        map.set(rule.id, rule);
      });

      const merged = Array.from(map.values());
      await this.saveRules(merged);

      return imported.length;
    } catch (err: any) {
      throw new Error(`规则导入解析失败: ${err.message}`);
    }
  },

  async findMatchingRuleForUrl(url: string): Promise<CustomSiteRule | null> {
    const rules = await this.getCustomRules();
    for (const rule of rules) {
      if (!rule.enabled) continue;
      try {
        if (url.includes(rule.domainPattern) || new RegExp(rule.domainPattern, 'i').test(url)) {
          return rule;
        }
      } catch {
        console.warn(`[OpenJobFill] 已跳过无效的自定义规则域名模式：${rule.name}`);
      }
    }
    return null;
  },

  /**
   * 将当前网页的某个元素选择器与简历字段建立永久映射绑定
   */
  async bindFieldToSite(
    url: string,
    selector: string,
    resumeKey: string,
    description: string
  ): Promise<CustomSiteRule> {
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    let rule = await this.findMatchingRuleForUrl(url);
    if (!rule) {
      rule = {
        id: 'rule-' + Date.now(),
        name: `${hostname} 专属自定义规则`,
        domainPattern: hostname,
        enabled: true,
        fields: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // 检查字段是否已存在 (仅按 selector 查重，允许不同选择器绑定相同字段)
    const existingFieldIdx = rule.fields.findIndex(
      (f) => f.selector === selector
    );
    const newField = {
      id: 'f-' + Date.now(),
      selector,
      resumeKey,
      description,
    };

    if (existingFieldIdx >= 0) {
      rule.fields[existingFieldIdx] = newField;
    } else {
      rule.fields.push(newField);
    }

    await this.saveCustomRule(rule);
    return rule;
  },
};
