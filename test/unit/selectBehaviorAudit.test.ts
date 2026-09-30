import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureHtml from '../fixtures/select-behavior.html?raw';
import { selectCascaderOptions, selectCustomOption } from '@/core/engine/selector';
import { executeControlAdapter, getMatchingControlAdapters, readBackControlAdapter } from '@/core/adapters/controlAdapters';
import type { FieldDescriptor } from '@/types/pipeline';
import { verifier } from '@/core/pipeline/verifier';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { parseResumeFromText } from '@/core/parser/resumeParser';

interface FixtureState {
  caseName: string;
  committed: string | string[];
  clicks: string[];
  queries: string[];
  path: string[];
}
interface FixtureApi {
  mount: (name: string) => FixtureState;
  state: FixtureState;
}
const fixtureWindow = window as unknown as { selectBehaviorFixture: FixtureApi };
const target = () => document.getElementById('audited-control')!;

/**
 * Exercises the same event-driven, network-free widgets as the browser fixture.
 * The state is written only by the widget's option/change handler. Typing a query
 * or dispatching a click therefore does not by itself satisfy an assertion.
 */
describe('select behavior audit against interactive widget state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const parsed = new DOMParser().parseFromString(fixtureHtml, 'text/html');
    document.body.innerHTML = parsed.body.innerHTML;
    // The trusted local fixture is deliberately the only script executed here.
    const script = parsed.querySelector('script')!.textContent!;
    new Function('window', 'document', script)(window, document);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function complete<T>(work: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return work;
  }

  function adapterFor(element: HTMLElement) {
    const field: FieldDescriptor = {
      id: 'select-audit', element, type: 'select', label: '技能', name: 'skills', placeholder: '',
      ariaLabel: '', required: false, disabled: false, readOnly: false, currentValue: '', contextText: '',
    };
    const context = { field, driverType: 'select' as const };
    const match = getMatchingControlAdapters(context)[0];
    expect(match).toBeDefined();
    return { context, match };
  }

  it('selects only the explicitly owned portal when another visible popup has the same text', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('portal-scope');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('ignores a duplicate option whose ancestor is display:none', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('hidden-duplicate');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('skips an aria-disabled option and commits the enabled option with the same label', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('disabled-duplicate');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('waits for async search results to replace stale nonmatching options', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('async-search');
    const selected = await complete(selectCustomOption(target(), '测试大学'));
    expect({ selected, committed: state.committed, clicks: state.clicks }).toEqual({ selected: true, committed: 'target', clicks: ['target'] });
  });

  it('waits for a dynamically assigned popup association without clicking unrelated options', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('late-popup-association');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('accepts the whitespace-separated IDREF list allowed in aria-controls', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('idref-list');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toBe('target');
  });

  it('skips disabled native options and options inside disabled optgroups', async () => {
    fixtureWindow.selectBehaviorFixture.mount('native-disabled');
    expect(await complete(selectCustomOption(target(), '本科'))).toBe(true);
    expect((target() as HTMLSelectElement).value).toBe('target');
  });

  it('executes an array value as multiple native selections rather than a comma-joined label', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('native-multiple');
    const { context, match } = adapterFor(target());
    const selected = await complete(executeControlAdapter(match, { ...context, value: ['JavaScript', 'TypeScript'] }));
    expect({ selected, committed: state.committed }).toEqual({ selected: true, committed: ['js', 'ts'] });
    expect(Array.from((target() as HTMLSelectElement).selectedOptions, option => option.text)).toEqual(['JavaScript', 'TypeScript']);
  });

  it('reads all committed native multi-select labels', () => {
    fixtureWindow.selectBehaviorFixture.mount('native-multiple');
    const select = target() as HTMLSelectElement;
    select.options[0].selected = true; select.options[1].selected = true;
    expect(readBackControlAdapter(adapterFor(select).match)).toEqual(['JavaScript', 'TypeScript']);
  });

  it('preserves every native multi-select value when one requested label does not exist', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('native-multiple');
    const select = target() as HTMLSelectElement;
    select.options[2].selected = true;
    const { context, match } = adapterFor(select);
    expect(await complete(executeControlAdapter(match, { ...context, value: ['JavaScript', 'Missing'] }))).toBe(false);
    expect(Array.from(select.selectedOptions, option => option.value)).toEqual(['go']);
    expect(state.committed).toBe(''); // No input/change event was dispatched.
  });

  it('rejects unsupported custom multi-select arrays before opening or toggling any choice', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('custom-multiple');
    const { context, match } = adapterFor(target());
    expect(await complete(executeControlAdapter(match, { ...context, value: ['测试大学', '另一个学校'] }))).toBe(false);
    expect(state.committed).toEqual(['target']);
    expect(state.clicks).toEqual([]);
    expect(target().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not toggle an already selected custom multi-select value off on replay', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('custom-multiple');
    expect(await complete(selectCustomOption(target(), '测试大学'))).toBe(true);
    expect(state.committed).toEqual(['target']);
    expect(document.querySelector('[role="option"]')!.getAttribute('aria-selected')).toBe('true');
  });

  it('limits cascader selection to the owned popup', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-scope');
    expect(await complete(selectCascaderOptions(target(), ['广东省']))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('ignores empty cascader loading placeholders', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-empty');
    expect(await complete(selectCascaderOptions(target(), ['广东省']))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('prefers an exact cascader label over a different partial-name branch', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-exact');
    expect(await complete(selectCascaderOptions(target(), ['软件工程']))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('does not select a different cascader branch when only a partial-name match exists', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-exact');
    document.querySelector('[data-option-key="target"]')!.remove();
    expect(await complete(selectCascaderOptions(target(), ['软件工程']))).toBe(false);
    expect(state.committed).toBe('');
    expect(state.clicks).toEqual([]);
  });

  it('waits for asynchronously loaded cascader children before selecting the next level', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-async');
    const selected = await complete(selectCascaderOptions(target(), ['广东省', '深圳市']));
    expect({ selected, committed: state.committed }).toEqual({ selected: true, committed: '广东省/深圳市' });
    expect(state.clicks).toEqual(['province', 'city']);
  });

  it('chooses the next cascader column when parent and child have identical labels', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-columns');
    expect(await complete(selectCascaderOptions(target(), ['其他', '其他']))).toBe(true);
    expect(state.committed).toBe('其他/其他');
    expect(state.clicks).toEqual(['parent', 'leaf']);
  });

  it('skips disabled cascader nodes', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('cascader-disabled');
    expect(await complete(selectCascaderOptions(target(), ['广东省']))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.clicks).toEqual(['target']);
  });

  it('reads SD committed sibling display text when its search input is empty', async () => {
    fixtureWindow.selectBehaviorFixture.mount('sd-selected-display');
    const { context, match } = adapterFor(target());
    expect(readBackControlAdapter(match)).toBe('20 条/页');
    expect(await verifier.readBack(context.field, 'select')).toBe('20 条/页');
  });

  it('searches the active Select2 portal and commits a label split by match-highlighting spans', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('legacy-select2');
    expect(await complete(selectCustomOption(target(), '清华大学'))).toBe(true);
    expect(state.committed).toBe('target');
    expect(state.queries).toEqual(['清华大学']);
    expect((target().querySelector('.select2-focusser') as HTMLInputElement).value).toBe('');
    expect(target().querySelector('.select2-chosen')!.textContent).toBe('清华大学');
  });

  it('scans, plans, fills, and verifies one Select2 field without duplicating offscreen proxies', async () => {
    const state = fixtureWindow.selectBehaviorFixture.mount('legacy-select2');
    const root = target();
    root.id = 's2id_id_college'; // Actual Select2 v3 backing-select linkage.
    document.getElementById('case-picker')!.remove();
    const fields = pageAnalyzer.analyzePage(document);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ element: root, type: 'select', label: '学校名称', name: 'college' });
    const resume = parseResumeFromText('教育经历\n本科-清华大学-2019.09-2023.06-软件工程-统招全日制');
    const plan = planGenerator.generatePlan(fields, resume);
    const result = await complete(pipelineExecutor.executePlan(plan));
    expect({ committed: state.committed, filled: result.filledCount, failed: result.failedCount }).toEqual({ committed: 'target', filled: 1, failed: 0 });
    expect((document.getElementById('id_college') as HTMLSelectElement).value).toBe('thu');
  });
});
