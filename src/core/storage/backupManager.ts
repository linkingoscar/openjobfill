import { resumeStorage } from './resumeStorage';
import { parseResumePayload } from '../schema/resumeSchema';
import { normalizeCustomSiteRule, ruleStorage, validateCustomSiteRule } from './ruleStorage';
import { trackerStorage } from './trackerStorage';
import { getCustomDomains, saveCustomDomains } from '../whitelist';
import type { StandardResume } from '../../types/resume';
import type { CustomSiteRule } from '../../types/rule';
import type { JobApplicationRecord, ApplicationStatus } from '../../types/tracker';

const BACKUP_APP = 'OpenJobFill';
const CURRENT_BACKUP_VERSION = 1;
const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'applied', 'screening', 'assessment', 'interview1',
  'interview2', 'hr', 'offer', 'rejected',
];

export interface FullBackupData {
  app: 'OpenJobFill';
  version: number;
  exportedAt: string;
  data: {
    resumes: StandardResume[];
    customRules: CustomSiteRule[];
    customDomains: string[];
    jobApplications: JobApplicationRecord[];
  };
}

interface BackupModules {
  resumes: StandardResume[];
  customRules: CustomSiteRule[];
  customDomains: string[];
  jobApplications: JobApplicationRecord[];
}

interface ParsedBackup {
  data: BackupModules;
  isFullBackup: boolean;
}

type UnknownRecord = Record<string, unknown>;

/**
 * 将备份载荷逐版本迁移到当前读取格式。
 *
 * 目前 v1 已经是当前格式，但保留显式分支很重要：后续增加字段时，
 * 新版本应在这里逐步迁移，而不是在导入入口直接把版本号“改成当前版本”。
 */
function migrateBackupPayload(payload: UnknownRecord, version: number): UnknownRecord {
  let migrated = payload;
  switch (version) {
    case 1:
      return migrated;
    default:
      // parseBackup 会先拦截未知版本；这里的分支用于防止未来调用方绕过该检查。
      throw new Error(`不支持的备份版本：${String(version)}`);
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} 必须是非空字符串`);
  }
  return value.trim();
}

function validateArrayItems(
  value: unknown,
  field: string,
  validator: (item: unknown, index: number) => void,
): void {
  if (!Array.isArray(value)) throw new Error(`${field} 必须是数组`);
  value.forEach(validator);
}

function normalizeBackupResume(value: unknown, index: number): StandardResume {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 份简历不是对象`);
  try {
    return parseResumePayload(value, { strict: true }).resume;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`第 ${index + 1} 份简历无效：${message}`);
  }
}

function normalizeBackupResumes(value: unknown): StandardResume[] {
  const seen = new Set<string>();
  const resumes: StandardResume[] = [];
  validateArrayItems(value, 'data.resumes', (item, index) => {
    const resume = normalizeBackupResume(item, index);
    if (seen.has(resume.id)) throw new Error(`简历 id 重复：${resume.id}`);
    seen.add(resume.id);
    resumes.push(resume);
  });
  return resumes;
}

function normalizeBackupRules(value: unknown): CustomSiteRule[] {
  const seen = new Set<string>();
  const rules: CustomSiteRule[] = [];
  validateArrayItems(value, 'data.customRules', (item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 条自定义规则不是对象`);
    asNonEmptyString(item.id, `第 ${index + 1} 条自定义规则的 id`);
    asNonEmptyString(item.domainPattern, `第 ${index + 1} 条自定义规则的 domainPattern`);
    if ('name' in item && item.name !== undefined && typeof item.name !== 'string') {
      throw new Error(`第 ${index + 1} 条自定义规则的 name 必须是字符串`);
    }
    if ('enabled' in item && item.enabled !== undefined && typeof item.enabled !== 'boolean') {
      throw new Error(`第 ${index + 1} 条自定义规则的 enabled 必须是布尔值`);
    }
    if ('updatedAt' in item && item.updatedAt !== undefined && typeof item.updatedAt !== 'string') {
      throw new Error(`第 ${index + 1} 条自定义规则的 updatedAt 必须是字符串`);
    }
    if ('selector' in item && item.selector !== undefined && typeof item.selector !== 'string') {
      throw new Error(`第 ${index + 1} 条自定义规则的 selector 必须是字符串`);
    }
    if ('resumeKey' in item && item.resumeKey !== undefined && typeof item.resumeKey !== 'string') {
      throw new Error(`第 ${index + 1} 条自定义规则的 resumeKey 必须是字符串`);
    }
    if ('description' in item && item.description !== undefined && typeof item.description !== 'string') {
      throw new Error(`第 ${index + 1} 条自定义规则的 description 必须是字符串`);
    }
    if ('fields' in item) {
      if (!Array.isArray(item.fields)) throw new Error(`第 ${index + 1} 条自定义规则的 fields 必须是数组`);
      item.fields.forEach((rawField, fieldIndex) => {
        if (!isRecord(rawField)) throw new Error(`第 ${index + 1} 条自定义规则的 fields[${fieldIndex}] 必须是对象`);
        asNonEmptyString(rawField.id, `第 ${index + 1} 条自定义规则的 fields[${fieldIndex}].id`);
        asNonEmptyString(rawField.selector, `第 ${index + 1} 条自定义规则的 fields[${fieldIndex}].selector`);
        asNonEmptyString(rawField.resumeKey, `第 ${index + 1} 条自定义规则的 fields[${fieldIndex}].resumeKey`);
        for (const optionalField of ['type', 'description'] as const) {
          if (optionalField in rawField && rawField[optionalField] !== undefined
            && typeof rawField[optionalField] !== 'string') {
            throw new Error(`第 ${index + 1} 条自定义规则的 fields[${fieldIndex}].${optionalField} 必须是字符串`);
          }
        }
      });
    }
    const rule = normalizeCustomSiteRule(item as Parameters<typeof normalizeCustomSiteRule>[0]);
    if (!rule) throw new Error(`第 ${index + 1} 条自定义规则格式不完整`);
    if (seen.has(rule.id)) throw new Error(`自定义规则 id 重复：${rule.id}`);
    let validationError: string | null = null;
    try {
      validationError = validateCustomSiteRule(rule);
    } catch {
      validationError = '字段映射结构无效';
    }
    if (validationError) throw new Error(`第 ${index + 1} 条自定义规则无效：${validationError}`);
    seen.add(rule.id);
    rules.push(rule);
  });
  return rules;
}

function normalizeBackupDomains(value: unknown): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];
  validateArrayItems(value, 'data.customDomains', (item, index) => {
    const domain = asNonEmptyString(item, `第 ${index + 1} 个自定义域名`);
    if (/\s/.test(domain) || /[\u0000-\u001f]/.test(domain)) {
      throw new Error(`第 ${index + 1} 个自定义域名包含非法字符`);
    }
    const normalized = domain.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      domains.push(domain);
    }
  });
  return domains;
}

function normalizeBackupApplication(value: unknown, index: number): JobApplicationRecord {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 条投递记录不是对象`);
  const id = asNonEmptyString(value.id, `第 ${index + 1} 条投递记录的 id`);
  const companyName = asNonEmptyString(value.companyName, `第 ${index + 1} 条投递记录的 companyName`);
  const jobTitle = asNonEmptyString(value.jobTitle, `第 ${index + 1} 条投递记录的 jobTitle`);
  const appliedDate = asNonEmptyString(value.appliedDate, `第 ${index + 1} 条投递记录的 appliedDate`);
  const jobUrl = asNonEmptyString(value.jobUrl, `第 ${index + 1} 条投递记录的 jobUrl`);
  const status = asNonEmptyString(value.status, `第 ${index + 1} 条投递记录的 status`) as ApplicationStatus;
  if (!APPLICATION_STATUSES.includes(status)) {
    throw new Error(`第 ${index + 1} 条投递记录的 status 无效：${status}`);
  }

  const optionalStringFields = ['salary', 'resumeVersionTitle', 'jdSummary', 'notes', 'updatedAt'] as const;
  for (const field of optionalStringFields) {
    if (field in value && value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error(`第 ${index + 1} 条投递记录的 ${field} 必须是字符串`);
    }
  }

  return {
    id, companyName, jobTitle, appliedDate, status, jobUrl,
    ...(typeof value.salary === 'string' ? { salary: value.salary } : {}),
    ...(typeof value.resumeVersionTitle === 'string' ? { resumeVersionTitle: value.resumeVersionTitle } : {}),
    ...(typeof value.jdSummary === 'string' ? { jdSummary: value.jdSummary } : {}),
    ...(typeof value.notes === 'string' ? { notes: value.notes } : {}),
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.trim()
      ? value.updatedAt
      : new Date().toISOString(),
  };
}

function normalizeBackupApplications(value: unknown): JobApplicationRecord[] {
  const seen = new Set<string>();
  const applications: JobApplicationRecord[] = [];
  validateArrayItems(value, 'data.jobApplications', (item, index) => {
    const application = normalizeBackupApplication(item, index);
    if (seen.has(application.id)) throw new Error(`投递记录 id 重复：${application.id}`);
    seen.add(application.id);
    applications.push(application);
  });
  return applications;
}

function parseBackup(jsonStr: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知 JSON 错误';
    throw new Error(`JSON 解析失败: ${message}`);
  }

  // 旧版本支持直接导入简历数组；它只影响简历模块，不应意外清空其它模块。
  if (Array.isArray(parsed)) {
    return {
      data: { resumes: normalizeBackupResumes(parsed), customRules: [], customDomains: [], jobApplications: [] },
      isFullBackup: false,
    };
  }

  if (!isRecord(parsed) || parsed.app !== BACKUP_APP || !isRecord(parsed.data)) {
    throw new Error('未识别的备份文件格式，请确保是由 OpenJobFill 导出的数据备份');
  }

  const version = parsed.version === undefined ? 1 : parsed.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CURRENT_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(version)}`);
  }

  const migrated = migrateBackupPayload(parsed, version);
  if (!isRecord(migrated.data)) throw new Error('备份迁移后缺少有效的 data 对象');

  return {
    data: {
      resumes: normalizeBackupResumes(migrated.data.resumes),
      customRules: normalizeBackupRules(migrated.data.customRules),
      customDomains: normalizeBackupDomains(migrated.data.customDomains),
      jobApplications: normalizeBackupApplications(migrated.data.jobApplications),
    },
    isFullBackup: true,
  };
}

async function restoreModules(
  data: BackupModules,
  mode: 'merge' | 'overwrite',
  modules: 'all' | 'resumes-only' = 'all',
): Promise<void> {
  if (mode === 'overwrite' || data.resumes.length > 0) {
    if (mode === 'overwrite') {
      await resumeStorage.replaceAllResumes(data.resumes);
      if (data.resumes.length > 0) await resumeStorage.setActiveResumeId(data.resumes[0].id);
    } else {
      for (const resume of data.resumes) await resumeStorage.saveResume(resume);
    }
  }

  if (modules === 'all') {
    if (mode === 'overwrite') {
      await ruleStorage.saveRules(data.customRules);
      await saveCustomDomains(data.customDomains);
      await trackerStorage.saveApplications(data.jobApplications);
    } else {
      for (const rule of data.customRules) await ruleStorage.saveCustomRule(rule);
      if (data.customDomains.length > 0) {
        const currentDomains = await getCustomDomains();
        await saveCustomDomains(Array.from(new Set([...currentDomains, ...data.customDomains])));
      }
      for (const application of data.jobApplications) await trackerStorage.saveApplication(application);
    }
  }
}

async function restoreWithRollback(incoming: ParsedBackup, mode: 'merge' | 'overwrite'): Promise<void> {
  // 导出并解析当前状态，既作为回滚快照，也确保回滚数据本身经过同一套校验。
  const previous = parseBackup(await backupManager.exportFullBackup());
  try {
    await restoreModules(incoming.data, mode, incoming.isFullBackup ? 'all' : 'resumes-only');
  } catch (error) {
    try {
      await restoreModules(previous.data, 'overwrite', 'all');
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`备份恢复失败，且回滚未完成：${rollbackMessage}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`备份恢复失败，已回滚原数据：${message}`);
  }
}

export const backupManager = {
  /** 导出全部本地数据为 JSON 字符串。 */
  async exportFullBackup(): Promise<string> {
    const resumes = await resumeStorage.getAllResumes();
    const customRules = await ruleStorage.getCustomRules();
    const customDomains = await getCustomDomains();
    const jobApplications = await trackerStorage.getAllApplications();

    const backup: FullBackupData = {
      app: BACKUP_APP,
      version: CURRENT_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { resumes, customRules, customDomains, jobApplications },
    };

    return JSON.stringify(backup, null, 2);
  },

  /**
   * 导入全量本地数据。所有模块会先完成解析、迁移和校验，再开始写入；
   * 任一步写入失败都会用导入前快照回滚，避免留下半恢复状态。
   */
  async importFullBackup(
    jsonStr: string,
    mode: 'merge' | 'overwrite' = 'merge',
  ): Promise<{ resumes: number; rules: number; applications: number; domains: number }> {
    if (mode !== 'merge' && mode !== 'overwrite') throw new Error(`不支持的恢复模式：${mode}`);
    const incoming = parseBackup(jsonStr);
    await restoreWithRollback(incoming, mode);

    return {
      resumes: incoming.data.resumes.length,
      rules: incoming.isFullBackup ? incoming.data.customRules.length : 0,
      applications: incoming.isFullBackup ? incoming.data.jobApplications.length : 0,
      domains: incoming.isFullBackup ? incoming.data.customDomains.length : 0,
    };
  },
};
