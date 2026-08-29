import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resumeStorage } from '@/core/storage/resumeStorage';

const RESUMES_KEY = 'openjobfill_resumes';

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

  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', lastError: undefined },
    storage: { local: { get, set } },
  });

  return { data, get, set };
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
    expect(storage.data[RESUMES_KEY]).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'resume-default' }),
    ]));
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
    expect(storage.get).toHaveBeenCalledTimes(3);
    expect(storage.set).toHaveBeenCalledTimes(2);
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
