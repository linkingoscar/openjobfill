import type { CustomSiteRule } from '../../types/rule';

const RULES_STORAGE_KEY = 'openjobfill_custom_rules';

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
            const rules = res[RULES_STORAGE_KEY] as CustomSiteRule[] | undefined;
            if (!rules || rules.length === 0) {
              this.saveRules(DEFAULT_PRESET_RULES);
              resolve(DEFAULT_PRESET_RULES);
            } else {
              resolve(rules);
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_PRESET_RULES));
    return DEFAULT_PRESET_RULES;
  },

  async saveRules(rules: CustomSiteRule[]): Promise<void> {
    if (isExtensionEnv()) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [RULES_STORAGE_KEY]: rules }, () => resolve());
        } catch {
          localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
          resolve();
        }
      });
    } else {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    }
  },

  async saveCustomRule(rule: CustomSiteRule): Promise<void> {
    const rules = await this.getCustomRules();
    const index = rules.findIndex((r) => r.id === rule.id);
    rule.updatedAt = new Date().toISOString();

    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.push(rule);
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
      imported.forEach((r) => {
        if (r.id && r.name && r.domainPattern) {
          map.set(r.id, r);
        }
      });

      const merged = Array.from(map.values());
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [RULES_STORAGE_KEY]: merged }, () => resolve());
      });

      return imported.length;
    } catch (err: any) {
      throw new Error(`规则导入解析失败: ${err.message}`);
    }
  },

  async findMatchingRuleForUrl(url: string): Promise<CustomSiteRule | null> {
    const rules = await this.getCustomRules();
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (url.includes(rule.domainPattern) || new RegExp(rule.domainPattern, 'i').test(url)) {
        return rule;
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
