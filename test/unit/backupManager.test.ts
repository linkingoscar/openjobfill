import { describe, it, expect, beforeEach } from 'vitest';
import { backupManager } from '@/core/storage/backupManager';
import { resumeStorage } from '@/core/storage/resumeStorage';
import { ruleStorage } from '@/core/storage/ruleStorage';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { getCustomDomains, saveCustomDomains } from '@/core/whitelist';
import { EMPTY_RESUME } from '@/core/storage/defaultData';

describe('BackupManager Suite (全量本地数据备份与恢复测试)', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('exportFullBackup 应该生成包含所有存储模块数据的完整 JSON 备份', async () => {
    // 准备测试数据
    const testResume = {
      ...EMPTY_RESUME,
      id: 'test-resume-1',
      title: '测试研发简历',
      basics: {
        ...EMPTY_RESUME.basics,
        name: '王小华',
        email: 'wang@example.com',
      },
    };
    await resumeStorage.saveResume(testResume);

    await ruleStorage.saveCustomRule({
      id: 'rule-1',
      domainPattern: 'custom.job.com',
      selector: '#user-phone',
      resumeKey: 'basics.phone',
      description: '自定义手机映射',
    });

    await saveCustomDomains(['job.custom-enterprise.com']);

    await trackerStorage.saveApplication({
      id: 'app-1',
      companyName: '某知名外企',
      jobTitle: '全栈架构师',
      appliedDate: '2026-08-28',
      status: 'applied',
      jobUrl: 'https://example.com',
      updatedAt: '2026-08-28T00:00:00.000Z',
    });

    // 导出备份
    const backupJson = await backupManager.exportFullBackup();
    const backup = JSON.parse(backupJson);

    expect(backup.app).toBe('OpenJobFill');
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBeDefined();
    expect(backup.data.resumes.length).toBeGreaterThanOrEqual(1);
    expect(backup.data.customRules.length).toBeGreaterThanOrEqual(1);
    expect(backup.data.customDomains).toContain('job.custom-enterprise.com');
    expect(backup.data.jobApplications.length).toBeGreaterThanOrEqual(1);
  });

  it('importFullBackup 能够完整还原各模块数据并兼容旧版纯数组格式', async () => {
    const mockBackup = {
      app: 'OpenJobFill',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        resumes: [
          {
            ...EMPTY_RESUME,
            id: 'restored-res-1',
            title: '还原后的简历',
            basics: {
              ...EMPTY_RESUME.basics,
              name: '李小龙',
            },
          },
        ],
        customRules: [
          {
            id: 'restored-rule-1',
            domainPattern: 'moka.custom.com',
            selector: 'input.moka-name',
            resumeKey: 'basics.name',
          },
        ],
        customDomains: ['restored.career.org'],
        jobApplications: [
          {
            id: 'restored-app-1',
            companyName: '未来科技',
            jobTitle: 'AI工程师',
            appliedDate: '2026-08-28',
            status: 'interview1',
            jobUrl: 'https://future.ai',
            updatedAt: '2026-08-28T00:00:00.000Z',
          },
        ],
      },
    };

    const result = await backupManager.importFullBackup(JSON.stringify(mockBackup));

    expect(result.resumes).toBe(1);
    expect(result.rules).toBe(1);
    expect(result.domains).toBe(1);
    expect(result.applications).toBe(1);

    // 验证存储还原
    const resumes = await resumeStorage.getAllResumes();
    const foundResume = resumes.find(r => r.id === 'restored-res-1');
    expect(foundResume).toBeDefined();
    expect(foundResume?.basics.name).toBe('李小龙');

    const rules = await ruleStorage.getCustomRules();
    expect(rules.some(r => r.id === 'restored-rule-1')).toBe(true);

    const domains = await getCustomDomains();
    expect(domains).toContain('restored.career.org');

    const apps = await trackerStorage.getAllApplications();
    expect(apps.some(a => a.id === 'restored-app-1')).toBe(true);
  });
});
