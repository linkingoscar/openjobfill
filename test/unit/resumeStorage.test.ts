import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resumeStorage } from '@/core/storage/resumeStorage';

const RESUMES_KEY = 'openjobfill_resumes';
const RESUME_INDEX_KEY = 'openjobfill_resume_ids';

function installChromeStorageMock(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initial);
  const get = vi.fn((keys: string[], callback: (result: Record<string, unknown>) => void) => {
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = data[key];
    callback(result);
  });
  const set = vi.fn((values: Record<string, unknown>, callback?: () => void) => {
    Object.assign(data, structuredClone(values));
    callback?.();
  });
  const remove = vi.fn((keys: string[], callback?: () => void) => {
    for (const key of keys) delete data[key];
    callback?.();
  });

  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', lastError: undefined },
    storage: { local: { get, set, remove } },
  });

  return { data, get, set, remove };
}

describe('ResumeStorage 首装初始化', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('扩展空存储应直接写入默认简历，不递归调用读取', async () => {
    const storage = installChromeStorageMock();

    const resumes = await resumeStorage.getAllResumes();

    expect(resumes).toHaveLength(1);
    expect(resumes[0].id).toBe('resume-default');
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.data[RESUME_INDEX_KEY]).toEqual(['resume-default']);
    expect(storage.data['openjobfill_resume_resume-default']).toEqual(expect.objectContaining({ id: 'resume-default' }));
  });

  it('首装初始化后应能正常保存并重新读取简历', async () => {
    const storage = installChromeStorageMock();
    const [defaultResume] = await resumeStorage.getAllResumes();

    await resumeStorage.saveResume({
      ...defaultResume,
      basics: { ...defaultResume.basics, name: '张三' },
    });

    const resumes = await resumeStorage.getAllResumes();
    expect(resumes).toHaveLength(1);
    expect(resumes[0].basics.name).toBe('张三');
    expect(storage.get.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(storage.set).toHaveBeenCalledTimes(2);
  });

  it('连续保存时 updatedAt 必须单调递增，保证预览失效校验可区分每次写入', async () => {
    installChromeStorageMock();
    const [defaultResume] = await resumeStorage.getAllResumes();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    try {
      await resumeStorage.saveResume({
        ...defaultResume,
        basics: { ...defaultResume.basics, name: '第一次保存' },
      });
      const [first] = await resumeStorage.getAllResumes();

      await resumeStorage.saveResume({
        ...first,
        basics: { ...first.basics, name: '第二次保存' },
      });
      const [second] = await resumeStorage.getAllResumes();

      expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
      expect(second.basics.name).toBe('第二次保存');
    } finally {
      now.mockRestore();
    }
  });

  it('浏览器拒绝写入时应明确报错，不能伪装成保存成功', async () => {
    const storage = installChromeStorageMock();
    const [defaultResume] = await resumeStorage.getAllResumes();
    storage.set.mockImplementationOnce((_values, callback) => {
      (globalThis as any).chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
      callback?.();
      (globalThis as any).chrome.runtime.lastError = undefined;
    });

    await expect(resumeStorage.saveResume({
      ...defaultResume,
      basics: { ...defaultResume.basics, name: '不会被静默丢失' },
    })).rejects.toThrow('QUOTA_BYTES quota exceeded');
  });

  it('解析导入的简历应在重新读取及恢复激活项后仍完整存在', async () => {
    installChromeStorageMock();
    const [defaultResume] = await resumeStorage.getAllResumes();
    const imported = await resumeStorage.importResumeFromJson(JSON.stringify({
      ...defaultResume,
      title: '上传解析简历',
      basics: { ...defaultResume.basics, name: '持久化用户' },
    }));
    await resumeStorage.setActiveResumeId(imported.id);

    const restored = await resumeStorage.getActiveResume();
    expect(restored.id).toBe(imported.id);
    expect(restored.title).toBe('上传解析简历');
    expect(restored.basics.name).toBe('持久化用户');
  });

  it('跨页面交错更新应由 background 串行化并保留双方字段', async () => {
    const storage = installChromeStorageMock();
    await resumeStorage.getAllResumes();
    let queued = Promise.resolve();
    (globalThis as any).chrome.runtime.sendMessage = vi.fn((message: any, callback: (response: any) => void) => {
      queued = queued.then(async () => {
        if (message.type === 'RESUME_STORAGE_UPDATE_FIELDS') {
          await resumeStorage.updateResumeFieldsDirect(message.payload.id, message.payload.updates);
        }
      });
      queued.then(() => callback({ success: true }), (error) => callback({ success: false, error: error.message }));
    });

    await Promise.all([
      resumeStorage.updateResumeFields('resume-default', { 'basics.name': '管理页用户' }),
      resumeStorage.updateResumeFields('resume-default', { 'basics.email': 'content@example.com' }),
    ]);

    const [resume] = await resumeStorage.getAllResumes();
    expect(resume.basics.name).toBe('管理页用户');
    expect(resume.basics.email).toBe('content@example.com');
    expect(storage.data['openjobfill_resume_resume-default']).toEqual(expect.objectContaining({
      basics: expect.objectContaining({ name: '管理页用户', email: 'content@example.com' }),
    }));
  });

  it('localStorage 中的空数组也应自动恢复默认简历', async () => {
    vi.stubGlobal('chrome', undefined);
    localStorage.setItem(RESUMES_KEY, '[]');

    const resumes = await resumeStorage.getAllResumes();

    expect(resumes).toHaveLength(1);
    expect(resumes[0].id).toBe('resume-default');
    expect(JSON.parse(localStorage.getItem(RESUMES_KEY) || '[]')).toHaveLength(1);
  });

  it('公开下载的 JSON 模板应始终可以被当前版本直接导入', async () => {
    vi.stubGlobal('chrome', undefined);
    const templatePath = resolve(process.cwd(), 'src/public/openjobfill-resume-template.json');
    const templateJson = readFileSync(templatePath, 'utf8');

    const imported = await resumeStorage.importResumeFromJson(templateJson);

    expect(imported.schemaVersion).toBe(4);
    expect(imported.title).toBe('校招通用简历模板');
    expect(imported.basics.name).toBe('张三');
    expect(imported.educations).toHaveLength(1);
    expect(imported.awards).toHaveLength(1);
    expect(imported.academicAchievements).toHaveLength(1);
    expect(imported.campusExperiences).toHaveLength(1);
  });
});
