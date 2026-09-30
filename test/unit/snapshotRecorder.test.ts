import { describe, expect, it } from 'vitest';
import { compactPlanSnapshot, SnapshotRecorder } from '../../src/core/pipeline/snapshotRecorder';

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



  it('按 runId 隔离并导出有界回放问题包', async () => {
    SnapshotRecorder.start('https://example.com/one', 'One', 'run-one');
    SnapshotRecorder.record('scan', { runId: 'run-one', email: 'demo@example.com' }, undefined, 'run-one');
    SnapshotRecorder.start('https://example.com/two', 'Two', 'run-two');
    SnapshotRecorder.record('error', { runId: 'run-two', message: '第二次运行失败' }, undefined, 'run-two');

    expect(SnapshotRecorder.getCurrent('run-one')?.records).toHaveLength(1);
    expect(SnapshotRecorder.getCurrent('run-two')?.records).toHaveLength(1);

    const exported = JSON.parse(await SnapshotRecorder.exportProblemPackage('run-one'));
    expect(exported.sessions).toHaveLength(1);
    expect(exported.sessions[0].runId).toBe('run-one');
    expect(exported.redaction.applied).toBe(true);
    expect(JSON.stringify(exported)).not.toContain('demo@example.com');
  });



  it('导入问题包时重新脱敏并拒绝无效结构', async () => {
    const imported = await SnapshotRecorder.importProblemPackage(JSON.stringify({
      schemaVersion: 2,
      sessions: [{
        schemaVersion: 2,
        sessionId: 'imported-run',
        pageUrl: 'https://example.com/apply',
        pageTitle: 'Apply',
        createdAt: 1,
        records: [{ stage: 'error', timestamp: 1, payload: { email: 'demo@example.com' } }],
      }],
    }));
    expect(imported.imported).toBe(1);
    expect(JSON.stringify(imported.sessions)).not.toContain('demo@example.com');
    await expect(SnapshotRecorder.importProblemPackage('{"sessions":[]}')).rejects.toThrow('没有有效');
  });
});
