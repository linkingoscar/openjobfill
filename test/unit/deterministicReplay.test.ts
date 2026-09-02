import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnapshotRecorder } from '@/core/pipeline/snapshotRecorder';
import { replayRunSnapshot, createRecordedAIProvider } from '@/core/pipeline/deterministicReplay';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { retryLadder } from '@/core/pipeline/retryLadder';
import type { FillPlan } from '@/types/pipeline';

describe('deterministic recorded-I/O replay', () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
  async function recordRun() {
    document.body.innerHTML = '<input id="candidate"><input id="captcha">';
    const field = (id: string) => ({ id, element: document.getElementById(id)!, type: 'text' as const, label: id, name: id, placeholder: '', ariaLabel: '', contextText: '', currentValue: '', required: true, disabled: false, readOnly: false });
    const plan: FillPlan = { totalFieldsCount: 2, highConfidenceCount: 2, needsUserCount: 0, skipCount: 0, items: ['candidate', 'captcha'].map((id) => ({ id, field: field(id), action: 'FILL', confidence: 1, targetValue: 'Private Candidate Name', semanticKey: 'basics.name', driverType: 'input' })) };
    vi.spyOn(retryLadder, 'getStrategiesForField').mockReturnValue([
      { name: 'unhandled', execute: () => false },
      { name: 'throws', execute: () => { throw new Error('Synthetic error'); } },
      { name: 'mismatch', execute: () => true, readBack: () => 'wrong' },
      { name: 'success', execute: (field, value) => { (field.element as HTMLInputElement).value = value; return true; }, readBack: (field) => (field.element as HTMLInputElement).value },
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = SnapshotRecorder.start('https://example.com/apply', 'Replay', 'test-recorded-executor');
    const original = await pipelineExecutor.executePlan(plan, { runId: session.sessionId });
    expect(original).toMatchObject({ filledCount: 1, skippedCount: 1, verifiedCount: 1 });
    return JSON.parse(SnapshotRecorder.exportJSON(session.sessionId));
  }
  it('reexecutes production retry/verification logic with no live page writes or provider calls', async () => {
    const session = await recordRun();
    expect(JSON.stringify(session)).not.toContain('Private Candidate Name');
    document.body.innerHTML = '<input id="live-page" value="keep me">';
    const routeSpy = vi.spyOn(retryLadder, 'getStrategiesForField'); routeSpy.mockClear();
    const report = await replayRunSnapshot(session);
    expect(report).toMatchObject({ replaySuccess: true, executionCount: 1, differences: [] });
    expect(routeSpy).not.toHaveBeenCalled();
    expect((document.getElementById('live-page') as HTMLInputElement).value).toBe('keep me');
  });
  it('detects changed result counts, missing events and incomplete execution', async () => {
    const session = await recordRun();
    session.records.find((event: any) => event.stage === 'execution-result').payload.filledCount = 9;
    expect((await replayRunSnapshot(session)).replaySuccess).toBe(false);
    session.records.splice(2, 1);
    expect((await replayRunSnapshot(session)).differences.some((diff) => diff.reason.includes('序号'))).toBe(true);
    session.records = session.records.filter((event: any) => event.stage !== 'execution-result');
    expect((await replayRunSnapshot(session)).differences.some((diff) => diff.reason.includes('不完整'))).toBe(true);
  });
  it('supplies recorded AI mappings only for an identical request and rejects request drift', async () => {
    const session = SnapshotRecorder.start('', '', 'ai-transport-replay');
    const fields = [{ index: 0, label: '姓名', placeholder: '', name: '', ariaLabel: '', inputType: 'text' }];
    const options = [{ resumeKey: 'basics.name', label: '姓名' }];
    SnapshotRecorder.record('ai-request', { fields, options }, undefined, session.sessionId);
    SnapshotRecorder.record('ai-response', { success: true, mapping: { 0: 'basics.name', 1: 'unknown.path' } }, undefined, session.sessionId);
    const provider = createRecordedAIProvider(session);
    expect(await provider.map(fields, options)).toEqual({ 0: 'basics.name' });
    expect(provider.remaining()).toBe(0);
    await expect(createRecordedAIProvider(session).map(fields, [])).rejects.toThrow('Schema');
  });
  it('imports legacy plans without claiming they are full runtime recordings', async () => {
    const session = SnapshotRecorder.start('', '', 'legacy-runtime-test');
    session.schemaVersion = 2;
    expect((await replayRunSnapshot(session)).differences[0].reason).toContain('旧版');
  });
});
