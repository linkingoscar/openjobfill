import { describe, expect, it } from 'vitest';
import { compactPlanSnapshot, replaySnapshot, SnapshotRecorder } from '../../src/core/pipeline/snapshotRecorder';

describe('SnapshotRecorder', () => {
  it('规划快照不保存目标值或 DOM 引用', () => {
    const element = document.createElement('input');
    const compact = compactPlanSnapshot({
      totalFieldsCount: 1,
      highConfidenceCount: 1,
      needsUserCount: 0,
      skipCount: 0,
      items: [{
        id: 'plan-1',
        field: {
          id: 'field-1', element, type: 'text', label: '手机号', placeholder: '', name: 'phone', ariaLabel: '',
          required: true, disabled: false, readOnly: false, currentValue: '', contextText: '',
        },
        semanticKey: 'basics.phone',
        targetValue: '13800138000',
        confidence: 1,
        action: 'FILL',
        source: 'semantic_dictionary',
        driverType: 'input',
      }],
    });

    const json = JSON.stringify(compact);
    expect(json).not.toContain('13800138000');
    expect(json).not.toContain('element');
    expect(compact.items[0]).toMatchObject({ fieldId: 'field-1', semanticKey: 'basics.phone' });
  });

  it('导出时再次递归脱敏', () => {
    SnapshotRecorder.start('https://jobs.example.com/apply?id=123', '测试岗位');
    SnapshotRecorder.record('error', { message: '联系 13800138000 或 demo@example.com' });
    expect(SnapshotRecorder.exportJSON()).not.toContain('13800138000');
    expect(SnapshotRecorder.exportJSON()).not.toContain('demo@example.com');
  });

  it('使用脱敏 scan 负载离线重跑并比较规划结果', async () => {
    const session = {
      schemaVersion: 1 as const,
      sessionId: 'session-replay',
      pageUrl: 'https://example.com/apply',
      pageTitle: 'Apply',
      createdAt: 1,
      records: [
        { stage: 'scan' as const, timestamp: 1, payload: [{ id: 'f1', label: '姓名' }] },
        { stage: 'plan' as const, timestamp: 2, payload: { items: [{ fieldId: 'f1', semanticKey: 'basics.name' }] } },
      ],
    };
    const result = await replaySnapshot(session, () => ({ items: [{ semanticKey: 'basics.name', fieldId: 'f1' }] }));
    expect(result.replaySuccess).toBe(true);
    expect(result.diffCount).toBe(0);
  });
});
