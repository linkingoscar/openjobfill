import { resumeStorage } from './resumeStorage';
import { ruleStorage } from './ruleStorage';
import { trackerStorage } from './trackerStorage';
import { getCustomDomains, saveCustomDomains } from '../whitelist';
import type { StandardResume } from '../../types/resume';
import type { CustomSiteRule } from '../../types/rule';
import type { JobApplicationRecord } from '../../types/tracker';

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

export const backupManager = {
  /**
   * 导出全部本地数据为 JSON 字符串
   */
  async exportFullBackup(): Promise<string> {
    const resumes = await resumeStorage.getAllResumes();
    const customRules = await ruleStorage.getCustomRules();
    const customDomains = await getCustomDomains();
    const jobApplications = await trackerStorage.getAllApplications();

    const backup: FullBackupData = {
      app: 'OpenJobFill',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        resumes,
        customRules,
        customDomains,
        jobApplications,
      },
    };

    return JSON.stringify(backup, null, 2);
  },

  /**
   * 导入全量本地数据备份并还原各个存储模块 (支持 合并导入 与 完全覆盖恢复 两种模式)
   */
  async importFullBackup(
    jsonStr: string,
    mode: 'merge' | 'overwrite' = 'merge'
  ): Promise<{
    resumes: number;
    rules: number;
    applications: number;
    domains: number;
  }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e: any) {
      throw new Error(`JSON 解析失败: ${e.message}`);
    }

    // 兼容全量备份模型与纯简历数组格式
    let rawResumes: StandardResume[] = [];
    let rawRules: CustomSiteRule[] = [];
    let rawDomains: string[] = [];
    let rawApps: JobApplicationRecord[] = [];

    if (parsed.app === 'OpenJobFill' && parsed.data) {
      rawResumes = Array.isArray(parsed.data.resumes) ? parsed.data.resumes : [];
      rawRules = Array.isArray(parsed.data.customRules) ? parsed.data.customRules : [];
      rawDomains = Array.isArray(parsed.data.customDomains) ? parsed.data.customDomains : [];
      rawApps = Array.isArray(parsed.data.jobApplications) ? parsed.data.jobApplications : [];
    } else if (Array.isArray(parsed)) {
      rawResumes = parsed;
    } else {
      throw new Error('未识别的备份文件格式，请确保是由 OpenJobFill 导出的数据备份');
    }

    // 1. 恢复多简历档案
    let importedResumesCount = 0;
    if (rawResumes.length > 0) {
      if (mode === 'overwrite') {
        for (const r of rawResumes) {
          if (r && r.basics) {
            await resumeStorage.saveResume(r);
            importedResumesCount++;
          }
        }
        await resumeStorage.setActiveResumeId(rawResumes[0].id);
      } else {
        for (const r of rawResumes) {
          if (r && r.basics) {
            await resumeStorage.saveResume(r);
            importedResumesCount++;
          }
        }
      }
    }

    // 2. 恢复自定义填表规则
    let importedRulesCount = 0;
    if (mode === 'overwrite') {
      await ruleStorage.saveRules(rawRules);
      importedRulesCount = rawRules.length;
    } else if (rawRules.length > 0) {
      for (const rule of rawRules) {
        if (rule && rule.domainPattern) {
          await ruleStorage.saveCustomRule(rule);
          importedRulesCount++;
        }
      }
    }

    // 3. 恢复自定义白名单域名
    let importedDomainsCount = 0;
    if (mode === 'overwrite') {
      await saveCustomDomains(rawDomains);
      importedDomainsCount = rawDomains.length;
    } else if (rawDomains.length > 0) {
      const currentDomains = await getCustomDomains();
      const merged = Array.from(new Set([...currentDomains, ...rawDomains]));
      await saveCustomDomains(merged);
      importedDomainsCount = rawDomains.length;
    }

    // 4. 恢复投递看板记录
    let importedAppsCount = 0;
    if (mode === 'overwrite') {
      await trackerStorage.saveApplications(rawApps);
      importedAppsCount = rawApps.length;
    } else if (rawApps.length > 0) {
      for (const app of rawApps) {
        if (app && app.id) {
          await trackerStorage.saveApplication(app);
          importedAppsCount++;
        }
      }
    }

    return {
      resumes: importedResumesCount,
      rules: importedRulesCount,
      applications: importedAppsCount,
      domains: importedDomainsCount,
    };
  },
};
