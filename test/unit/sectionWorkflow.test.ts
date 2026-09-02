import { beforeEach, describe, expect, it } from 'vitest';
import { RepeatableSectionWorkflowRunner } from '@/core/engine/sectionWorkflow';
import type { RepeatableWorkflowConfig } from '@/types/siteProfile';
import { SnapshotRecorder } from '@/core/pipeline/snapshotRecorder';
import { replayRunSnapshot } from '@/core/pipeline/deterministicReplay';

const CONFIG: RepeatableWorkflowConfig = {
  sectionKey: 'education',
  mode: 'save-before-next',
  rootSelectors: ['[data-section="education"]'],
  itemSelectors: ['.record-card'],
  saveButtonLabels: ['保存'],
  addButtonLabels: ['新增经历'],
  editButtonLabels: ['编辑'],
  saveAfterLast: true,
  maxRecords: 5,
};

function card(index: number): HTMLElement {
  const element = document.createElement('div');
  element.className = 'record-card';
  element.innerHTML = `<input name="school-${index}"><button type="button">保存</button>`;
  element.querySelector('button')!.addEventListener('click', () => {
    const input = element.querySelector<HTMLInputElement>('input');
    if (input) input.style.display = 'none';
  });
  return element;
}

describe('受控重复区块状态机', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('严格执行填写、保存、再新增，并对每一步保留验证轨迹', async () => {
    document.body.innerHTML = '<section data-section="education"><button type="button" class="add">新增经历</button></section>';
    const root = document.querySelector<HTMLElement>('[data-section="education"]')!;
    root.prepend(card(0));
    root.querySelector('.add')!.addEventListener('click', () => root.prepend(card(root.querySelectorAll('.record-card').length)));

    const filled: number[] = [];
    const session = SnapshotRecorder.start('', '', 'section-deterministic-replay');
    const result = await new RepeatableSectionWorkflowRunner().run(CONFIG, 2, async (index, scope) => {
      const input = scope.querySelector<HTMLInputElement>('input')!;
      input.value = `学校${index + 1}`;
      filled.push(index);
      return { canAdvance: true };
    }, undefined, session.sessionId);

    expect(result.success).toBe(true);
    expect(result.completedRecords).toBe(2);
    expect(filled).toEqual([0, 1]);
    expect(result.steps.map((step) => step.state)).toEqual([
      'FIND_SECTION', 'ENTER_EDIT', 'FILL_RECORD', 'SAVE_RECORD', 'ADD_RECORD', 'WAIT_FOR_EDITOR',
      'ENTER_EDIT', 'FILL_RECORD', 'SAVE_RECORD', 'COMPLETE',
    ]);
    const before = root.innerHTML;
    expect(await replayRunSnapshot(session)).toMatchObject({ replaySuccess: true, sectionCount: 1 });
    expect(root.innerHTML).toBe(before);
    const transition = session.records.find((record) => record.stage === 'section-transition' && (record.payload as any).state === 'ADD_RECORD')!;
    (transition.payload as any).recordIndex = 9;
    expect((await replayRunSnapshot(session)).replaySuccess).toBe(false);
  });

  it('即使文案为保存，也绝不点击 submit 类型按钮', async () => {
    document.body.innerHTML = `
      <section data-section="education">
        <div class="record-card"><input><button type="submit">保存</button></div>
      </section>`;
    let submitted = false;
    document.querySelector('button')!.addEventListener('click', () => { submitted = true; });
    const result = await new RepeatableSectionWorkflowRunner().run(CONFIG, 1, async () => ({ canAdvance: true }));
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('无法确认保存状态');
    expect(result.steps.at(-1)?.state).toBe('BLOCKED');
    expect(submitted).toBe(false);
  });

  it('站点画像命中 submit 内层元素时也不得绕过安全门禁', async () => {
    document.body.innerHTML = `
      <section data-section="education">
        <div class="record-card"><input><button type="submit"><span class="save-label">保存</span></button></div>
      </section>`;
    let submitted = false;
    document.querySelector('button')!.addEventListener('click', () => { submitted = true; });
    const result = await new RepeatableSectionWorkflowRunner().run({
      ...CONFIG,
      saveButtonSelectors: ['.save-label'],
    }, 1, async () => ({ canAdvance: true }));
    expect(result.success).toBe(false);
    expect(submitted).toBe(false);
  });
});
