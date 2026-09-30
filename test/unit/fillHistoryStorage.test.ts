import { beforeEach, describe, expect, it } from 'vitest';
import {
  FILL_HISTORY_STORAGE_KEY,
  fillHistoryStorage,
} from '@/core/storage/fillHistoryStorage';
import type { FillResult } from '@/types/adapter';

const createResult = (index = 0): FillResult => ({
  success: true,
  adapterName: '通用引擎',
  filledCount: 1,
  skippedCount: 0,
  failedCount: 1,
  durationMs: 123 + index,
  logs: [
    { field: 'basics.phone', label: '手机号', value: '13800138000', status: 'success' },
    {
      field: 'basics.email',
      label: '电子邮箱',
      value: 'candidate@example.com',
      status: 'failed',
      message: '读回验证失败 (实际渲染: "张三 candidate@example.com 13800138000")',
    },
  ],
  remainingTasks: [{
    id: `task-${index}`,
    label: '身份证号码',
    type: 'text',
    required: true,
    reason: '写入验证未通过 (期望值: 张三 110101200105182345)',
  }],
});

describe('FillHistoryStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(FILL_HISTORY_STORAGE_KEY);
  });

  it('只保存诊断字段并移除 URL 查询参数和简历实际值', () => {
    const record = fillHistoryStorage.createRecord(createResult(), {
      pageTitle: '候选人 candidate@example.com 的网申',
      pageUrl: 'https://jobs.example.com/apply/110101200105182345?id=private#step2',
    });

    expect(record.pageUrl).toBe('https://jobs.example.com/apply/:id');
    expect(record.pageTitle).toContain('[邮箱]');
    expect(record.fields).toEqual([
      { field: 'basics.phone', label: '手机号', status: 'success', message: undefined },
      { field: 'basics.email', label: '电子邮箱', status: 'failed', message: '读回验证失败' },
    ]);
    expect(record.remainingTasks[0].reason).toBe('写入验证未通过');
    for (const secret of ['candidate@example.com', '13800138000', '张三', '110101200105182345', 'id=private', '#step2']) {
      expect(JSON.stringify(record)).not.toContain(secret);
    }
  });

  it('最新记录置顶且最多保留 30 次', async () => {
    for (let index = 0; index < 33; index++) {
      const record = fillHistoryStorage.createRecord(createResult(index), {
        pageTitle: `页面 ${index}`,
        pageUrl: `https://jobs.example.com/apply/${index}`,
      });
      await fillHistoryStorage.append(record);
    }

    const records = await fillHistoryStorage.getRecords();
    expect(records.map((record) => record.pageTitle)).toEqual(Array.from({ length: 30 }, (_, index) => `页面 ${32 - index}`));
  });

  it('可以导出和清空历史记录', async () => {
    const record = fillHistoryStorage.createRecord(createResult(), {
      pageTitle: '测试页面',
      pageUrl: 'https://jobs.example.com/apply',
    });
    await fillHistoryStorage.append(record);

    const exported = JSON.parse(await fillHistoryStorage.exportJSON());
    expect(exported.product).toBe('OpenJobFill');
    expect(exported.records).toEqual([JSON.parse(JSON.stringify(record))]);

    await fillHistoryStorage.clear();
    expect(await fillHistoryStorage.getRecords()).toEqual([]);
  });

  it('页面分析或执行崩溃时也能生成脱敏诊断记录', () => {
    const record = fillHistoryStorage.createErrorRecord({
      pageTitle: '测试页面',
      pageUrl: 'https://jobs.example.com/apply/12345678?token=secret',
      adapterName: '通用引擎',
      phase: 'analysis',
      error: new Error('解析 candidate@example.com 和张三失败，实际值: 张三'),
    });

    expect(record.phase).toBe('analysis');
    expect(record.pageUrl).toBe('https://jobs.example.com/apply/:id');
    expect(record.operationError).not.toContain('candidate@example.com');
    expect(record.operationError).not.toContain('实际值: 张三');
    expect(record.operationError).toBe('解析 [邮箱] 和[内容已隐藏]失败，实际值已隐藏');
    expect(JSON.stringify(record)).not.toContain('张三');
    expect(record.failedCount).toBe(1);
  });
});
