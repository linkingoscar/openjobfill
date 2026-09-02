import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackerStorage } from '@/core/storage/trackerStorage';
import { applicationDraftStorage } from '@/core/storage/applicationDraftStorage';
import { createApplicationId } from '@/core/tracker/trackerSchema';

describe('投递看板数据契约', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('首次打开为空，不再写入虚构公司和岗位', async () => {
    expect(await trackerStorage.getApplications()).toEqual([]);
    expect(localStorage.getItem('openjobfill_job_applications')).toBeNull();
  });

  it('迁移旧记录并生成 schema、幂等键和本地同步状态', async () => {
    localStorage.setItem('openjobfill_job_applications', JSON.stringify([{
      id: 'legacy-1', companyName: '示例公司', jobTitle: '前端工程师', appliedDate: '2026-09-01',
      status: 'applied', jobUrl: 'https://jobs.example.com/1?utm_source=test', updatedAt: '2026-09-01T00:00:00.000Z',
    }]));
    const [record] = await trackerStorage.getApplications();
    expect(record).toMatchObject({ schemaVersion: 2, clientRequestId: 'legacy-1', syncState: 'local' });
    expect(record.jobUrl).toBe('https://jobs.example.com/1');
  });

  it('拒绝把非 HTTP(S) 地址保存为可点击岗位链接', async () => {
    await trackerStorage.saveApplication({
      id: 'unsafe-url', companyName: '示例公司', jobTitle: '工程师', appliedDate: '2026-09-01',
      status: 'applied', jobUrl: 'javascript:alert(1)', source: 'manual', updatedAt: new Date().toISOString(),
    });
    expect((await trackerStorage.getApplications())[0].jobUrl).toBe('');
  });

  it('并发保存被串行化，并按 clientRequestId/岗位身份防重复', async () => {
    const base = {
      appliedDate: '2026-09-02', status: 'applied' as const, updatedAt: new Date().toISOString(),
    };
    await Promise.all([
      trackerStorage.saveApplication({ ...base, id: createApplicationId(), clientRequestId: 'request-1', companyName: '甲公司', jobTitle: '前端', jobUrl: 'https://jobs.example.com/1', source: 'manual' }),
      trackerStorage.saveApplication({ ...base, id: createApplicationId(), clientRequestId: 'request-2', companyName: '乙公司', jobTitle: '后端', jobUrl: 'https://jobs.example.com/2', source: 'manual' }),
    ]);
    expect(await trackerStorage.getApplications()).toHaveLength(2);

    await trackerStorage.saveApplication({ ...base, id: createApplicationId(), clientRequestId: 'request-1', companyName: '错误覆盖', jobTitle: '前端', jobUrl: 'https://jobs.example.com/1', source: 'success_detection' });
    const records = await trackerStorage.getApplications();
    expect(records).toHaveLength(2);
    expect(records.find((item) => item.clientRequestId === 'request-1')?.companyName).toBe('甲公司');

    await trackerStorage.saveApplication({
      ...base,
      id: createApplicationId(),
      clientRequestId: 'request-3',
      companyName: '甲公司',
      jobTitle: '前端',
      jobUrl: 'https://jobs.example.com/1?utm_source=retry',
      source: 'success_detection',
    });
    expect(await trackerStorage.getApplications()).toHaveLength(2);
  });

  it('扩展页面经 background 访问 Tracker，并保留显式清空字段的用户来源', async () => {
    const application = {
      id: 'app-1', clientRequestId: 'request-1', companyName: '示例公司', jobTitle: '工程师',
      appliedDate: '2026-09-02', status: 'applied' as const, jobUrl: 'https://jobs.example.com/1',
      notes: '待清空', source: 'success_detection' as const, updatedAt: new Date().toISOString(),
    };
    const sent: unknown[] = [];
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        sendMessage(message: unknown, callback: (response: unknown) => void) {
          sent.push(message);
          callback({ success: true, applications: [application] });
        },
      },
      storage: { local: {} },
    });

    expect(await trackerStorage.getApplications()).toHaveLength(1);
    await trackerStorage.saveApplication({
      ...application,
      notes: undefined,
      source: 'user_confirmed',
      fieldSources: { notes: 'user' },
      lockedFields: ['notes'],
    });
    expect(sent).toEqual([
      { type: 'TRACKER_STORAGE_GET' },
      expect.objectContaining({ type: 'TRACKER_STORAGE_SAVE' }),
    ]);
  });

  it('用户显式清空的字段保持为空，后续页面抽取不能覆盖', async () => {
    const base = {
      id: 'app-clear', clientRequestId: 'request-clear', companyName: '示例公司', jobTitle: '工程师',
      appliedDate: '2026-09-02', status: 'applied' as const, jobUrl: 'https://jobs.example.com/clear',
      notes: '自动生成说明', source: 'success_detection' as const, fieldSources: { notes: 'heuristic' as const },
      updatedAt: new Date().toISOString(),
    };
    await trackerStorage.saveApplication(base);
    await trackerStorage.saveApplication({
      ...base,
      notes: undefined,
      source: 'user_confirmed',
      fieldSources: { notes: 'user' },
      lockedFields: ['notes'],
    });
    await trackerStorage.saveApplication({
      ...base,
      id: 'app-retry',
      clientRequestId: 'request-retry',
      notes: '重试抽取内容',
    });

    const [record] = await trackerStorage.getApplications();
    expect(record.notes).toBeUndefined();
    expect(record.fieldSources?.notes).toBe('user');
    expect(record.lockedFields).toContain('notes');
  });

  it('申请成功草稿可恢复，并在 TTL 到期后自动清除', async () => {
    const job = { companyName: '示例公司', jobTitle: '工程师', jobUrl: 'https://jobs.example.com/1' };
    const draft = await applicationDraftStorage.create(job, 10_000);
    expect((await applicationDraftStorage.get())?.clientRequestId).toBe(draft.clientRequestId);
    await applicationDraftStorage.create(job, -1);
    expect(await applicationDraftStorage.get()).toBeNull();
  });
});
