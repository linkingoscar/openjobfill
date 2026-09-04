import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it.each(['merge', 'overwrite'] as const)('无网址记录可原样恢复，当前空网址也不阻断其他备份：%s', async (mode) => {
    await trackerStorage.saveApplication({ id: 'no-url', companyName: '线下招聘', jobTitle: '工程师', appliedDate: '2026-09-04', status: 'applied', jobUrl: '' });
    const json = await backupManager.exportFullBackup();
    await backupManager.importFullBackup(json, mode);
    expect((await trackerStorage.getAllApplications()).find((a) => a.id === 'no-url')?.jobUrl).toBe('');
    const other = JSON.parse(json);
    other.data.jobApplications[0] = { ...other.data.jobApplications[0], id: 'online', clientRequestId: 'online-request', jobUrl: 'https://jobs.example.com/2' };
    await backupManager.importFullBackup(JSON.stringify(other), mode);
    expect((await trackerStorage.getAllApplications()).some((a) => a.id === 'online')).toBe(true);
    other.data.jobApplications[0].jobUrl = 42;
    expect(() => backupManager.previewBackup(JSON.stringify(other))).toThrow('jobUrl');
  });

  it('预览不写入；覆盖后跨调用恢复旧数据和原激活简历', async () => {
    await resumeStorage.saveResume({ ...EMPTY_RESUME, id: 'original', title: '需要保留' });
    await resumeStorage.setActiveResumeId('original');
    await saveCustomDomains(['original.example.com']);
    const original = await backupManager.exportFullBackup();
    const incoming = JSON.parse(original);
    incoming.data.resumes = [{ ...EMPTY_RESUME, id: 'replacement' }];
    incoming.data.customDomains = ['replacement.example.com'];
    const summary = backupManager.previewBackup(JSON.stringify(incoming));
    expect(summary).toMatchObject({ resumes: 1, domains: 1, isFullBackup: true });
    expect(summary.exportedAt).toBe(incoming.exportedAt);
    expect(await getCustomDomains()).toEqual(['original.example.com']);
    await backupManager.importFullBackup(JSON.stringify(incoming), 'overwrite');
    expect((await resumeStorage.getAllResumes()).map((r) => r.id)).toEqual(['replacement']);
    expect(await backupManager.getRecoveryPointSummary()).toMatchObject({ domains: 1 });
    await backupManager.restoreRecoveryPoint();
    expect((await resumeStorage.getAllResumes()).some((r) => r.id === 'original')).toBe(true);
    expect((await resumeStorage.getActiveResume()).id).toBe('original');
    expect(await getCustomDomains()).toEqual(['original.example.com']);
  });

  it('恢复点无法保存时不得开始覆盖', async () => {
    const incoming = JSON.parse(await backupManager.exportFullBackup());
    const replace = vi.spyOn(resumeStorage, 'replaceAllResumes');
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
      await expect(backupManager.importFullBackup(JSON.stringify(incoming), 'overwrite')).rejects.toThrow('quota');
      expect(replace).not.toHaveBeenCalled();
    } finally { write.mockRestore(); replace.mockRestore(); }
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

  it('importFullBackup 支持 mode: overwrite 完全覆盖恢复当前数据', async () => {
    // 写入旧数据
    await resumeStorage.saveResume({
      ...EMPTY_RESUME,
      id: 'old-obsolete-resume',
      title: '旧版待覆盖简历',
      basics: {
        ...EMPTY_RESUME.basics,
        name: '旧用户',
      },
    });
    await saveCustomDomains(['old-domain.com']);
    await ruleStorage.saveCustomRule({
      id: 'old-rule-1',
      domainPattern: 'old.com',
      selector: '#old',
      resumeKey: 'basics.name',
    });

    const newBackup = {
      app: 'OpenJobFill',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        resumes: [
          {
            ...EMPTY_RESUME,
            id: 'overwrite-res-1',
            title: '全新覆盖简历',
            basics: {
              ...EMPTY_RESUME.basics,
              name: '新用户',
            },
          },
        ],
        customRules: [
          {
            id: 'new-rule-1',
            domainPattern: 'new.com',
            selector: '#new',
            resumeKey: 'basics.email',
          },
        ],
        customDomains: ['new-only.com'],
        jobApplications: [],
      },
    };

    const result = await backupManager.importFullBackup(JSON.stringify(newBackup), 'overwrite');
    expect(result.resumes).toBe(1);

    const allResumes = await resumeStorage.getAllResumes();
    expect(allResumes.length).toBe(1);
    expect(allResumes[0].id).toBe('overwrite-res-1');
    expect(allResumes.some(r => r.id === 'old-obsolete-resume')).toBe(false); // 旧简历被彻底覆盖移除

    const domains = await getCustomDomains();
    expect(domains).toEqual(['new-only.com']); // 旧域名被完全覆盖清空
    expect(domains).not.toContain('old-domain.com');

    const rules = await ruleStorage.getCustomRules();
    expect(rules.some(r => r.id === 'new-rule-1')).toBe(true);
    expect(rules.some(r => r.id === 'old-rule-1')).toBe(false); // 旧规则被清空
  });

  it('遇到任一模块格式错误时应在写入前拒绝，避免部分导入', async () => {
    await resumeStorage.saveResume({
      ...EMPTY_RESUME,
      id: 'safe-resume',
      basics: { ...EMPTY_RESUME.basics, name: '原始用户' },
    });

    const malformed = {
      app: 'OpenJobFill',
      version: 1,
      data: {
        resumes: [{ ...EMPTY_RESUME, id: 'incoming-resume' }],
        customRules: [{ id: 'broken-rule', domainPattern: 'example.com', fields: 'not-an-array' }],
        customDomains: ['safe.example.com'],
        jobApplications: [],
      },
    };

    await expect(backupManager.importFullBackup(JSON.stringify(malformed), 'overwrite'))
      .rejects.toThrow('自定义规则');
    const resumes = await resumeStorage.getAllResumes();
    expect(resumes.some((resume) => resume.id === 'safe-resume')).toBe(true);
    expect(resumes.some((resume) => resume.id === 'incoming-resume')).toBe(false);
  });

  it('简历嵌套字段类型错误时也应在写入前拒绝', async () => {
    const malformed = {
      app: 'OpenJobFill',
      version: 1,
      data: {
        resumes: [{
          ...EMPTY_RESUME,
          id: 'bad-resume',
          basics: { ...EMPTY_RESUME.basics },
          educations: [{ id: 'edu-1', schoolName: 123, degree: '本科', major: '', startDate: '', endDate: '' }],
        }],
        customRules: [],
        customDomains: [],
        jobApplications: [],
      },
    };

    await expect(backupManager.importFullBackup(JSON.stringify(malformed), 'overwrite'))
      .rejects.toThrow('schoolName');
    expect((await resumeStorage.getAllResumes()).some((resume) => resume.id === 'bad-resume')).toBe(false);
  });

  it('覆盖恢复中途写入失败时应回滚所有已写入模块', async () => {
    await resumeStorage.saveResume({
      ...EMPTY_RESUME,
      id: 'before-resume',
      basics: { ...EMPTY_RESUME.basics, name: '恢复前用户' },
    });
    await saveCustomDomains(['before.example.com']);

    const incoming = {
      app: 'OpenJobFill',
      version: 1,
      data: {
        resumes: [{ ...EMPTY_RESUME, id: 'after-resume', basics: { ...EMPTY_RESUME.basics, name: '恢复后用户' } }],
        customRules: [{
          id: 'after-rule',
          name: '恢复后规则',
          domainPattern: 'after.example.com',
          enabled: true,
          fields: [{ id: 'after-field', selector: '#name', resumeKey: 'basics.name' }],
        }],
        customDomains: ['after.example.com'],
        jobApplications: [],
      },
    };

    const originalSaveApplications = trackerStorage.saveApplications.bind(trackerStorage);
    const saveApplicationsSpy = vi.spyOn(trackerStorage, 'saveApplications')
      .mockImplementationOnce(async () => {
        throw new Error('模拟投递记录写入失败');
      })
      .mockImplementation(originalSaveApplications);

    await expect(backupManager.importFullBackup(JSON.stringify(incoming), 'overwrite'))
      .rejects.toThrow('已回滚原数据');

    const resumes = await resumeStorage.getAllResumes();
    expect(resumes.some((resume) => resume.id === 'before-resume')).toBe(true);
    expect(resumes.some((resume) => resume.id === 'after-resume')).toBe(false);
    expect(await getCustomDomains()).toEqual(['before.example.com']);
    expect(saveApplicationsSpy).toHaveBeenCalledTimes(2);
    saveApplicationsSpy.mockRestore();
  });
});
