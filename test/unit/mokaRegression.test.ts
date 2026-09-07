import { beforeEach, describe, expect, it } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { verifier } from '@/core/pipeline/verifier';
import { decorateElement } from '@/core/engine/badgeDecorator';
import { parseResumeFromText } from '@/core/parser/resumeParser';
import { pipelineExecutor } from '@/core/pipeline/executor';

// Reduced structural reproduction from the exported scan and screenshots.
// This is not a captured copy of the live Moka DOM.
const input = (placeholder: string) => `<label><input class="sd-Input-input-10L0t sd-Input-common-input-1XimE sd-Input-has-addon-3djHe" placeholder="${placeholder}"></label>`;
const row = (label: string, control: string) => `<div><div class="field-title">${label}</div><div><div>${control}</div></div></div>`;
const resumeText = `教育经历
硕士-测试大学-2019.09-2022.06-软件工程-统招全日制
本科-示例大学-2015.09-2019.06-计算机科学-统招全日制
高中-测试中学-2012.09-2015.06-理科`;

describe('Moka diagnostic regressions', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('counts education cards within education rather than all sibling sections', () => {
    document.body.innerHTML = `<form>
      <div class="section"><h2>推荐信息</h2><input></div>
      <div class="section"><h2>联系方式</h2><input></div>
      <div class="section"><h2>基本信息</h2><input></div>
      <div class="section">${row('就读时间 *', input('年') + input('月'))}${row('学校名称 *', input('请输入就读学校'))}</div>
      <div class="section">${row('就读时间 *', input('年') + input('月'))}${row('学校名称 *', input('请输入就读学校'))}</div>
    </form>`;
    const fields = pageAnalyzer.analyzePage(document);
    const schools = fields.filter(f => f.placeholder === '请输入就读学校');
    expect(schools.map(f => f.section?.index)).toEqual([0, 1]);
    const plan = planGenerator.generatePlan(fields, parseResumeFromText(resumeText));
    expect(plan.items.filter(i => schools.includes(i.field)).map(i => [i.semanticKey, i.targetValue])).toEqual([
      ['educations.0.schoolName', '测试大学'], ['educations.1.schoolName', '示例大学'],
    ]);
  });

  it('reads a label above nested inputs without inheriting a neighbouring required marker', () => {
    document.body.innerHTML = `<form><div class="form-item">
      ${row('学历 *', input('请选择'))}${row('学习方式', input('请选择'))}
    </div></form>`;
    expect(pageAnalyzer.analyzePage(document).map(f => [f.label, f.required])).toEqual([
      ['学历 *', true], ['学习方式', false],
    ]);
  });

  it('does not let its own success badge become the label on a second scan', () => {
    document.body.innerHTML = `<form>${row('学校名称 *', input('请输入就读学校'))}</form>`;
    const before = pageAnalyzer.analyzePage(document)[0];
    decorateElement(before.element, { status: 'success', label: '出生日期', value: '2000-01-01' });
    const after = pageAnalyzer.analyzePage(document)[0];
    expect(after.label).toBe('学校名称 *');
    expect(after.contextText).not.toContain('出生日期');
  });

  it('never infers a full birth date from a bare year or month label', () => {
    document.body.innerHTML = `<form>${input('年')}${input('月')}</form>`;
    const resume = parseResumeFromText(resumeText);
    resume.basics.birthDate = '2000-01-01';
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume);
    expect(plan.items.every(i => i.action !== 'FILL')).toBe(true);
  });

  it('can reuse the highest education major in the education card after a basic summary field', () => {
    document.body.innerHTML = `<form>
      ${row('最近毕业专业', input('请输入最近毕业专业'))}
      <div class="education-card">${row('专业名称 *', input('请输入专业名称'))}</div>
    </form>`;
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), parseResumeFromText(resumeText));
    expect(plan.items.map(i => [i.semanticKey, i.targetValue])).toEqual([
      ['educations.0.major', '软件工程'], ['educations.0.major', '软件工程'],
    ]);
  });

  it('rejects partial dates and placeholders while accepting equivalent complete dates', () => {
    expect(verifier.isSemanticEquivalent('2019', '2019-09', 'date')).toBe(false);
    expect(verifier.isSemanticEquivalent('2019-09', '2019-09-06', 'date')).toBe(false);
    expect(verifier.isSemanticEquivalent('年', '2019年09月', 'date')).toBe(false);
    expect(verifier.isSemanticEquivalent('2019年9月', '2019-09', 'date')).toBe(true);
  });

  it('preserves high school education from the source document', () => {
    expect(parseResumeFromText(resumeText).educations[2]).toMatchObject({ degree: '高中', startDate: '2012-09', endDate: '2015-06' });
  });

  it('selects an SD search result through its option instead of only writing its input', async () => {
    document.body.innerHTML = `<form>${row('学校名称 *', input('请输入就读学校'))}</form>`;
    const field = pageAnalyzer.analyzePage(document)[0];
    expect(field.type).toBe('select');
    const trigger = field.element as HTMLInputElement;
    trigger.setAttribute('aria-controls', 'school-results');
    let committed = '';
    trigger.addEventListener('input', () => {
      if (document.getElementById('school-results')) return;
      const popup = document.createElement('div');
      popup.id = 'school-results';
      popup.innerHTML = '<div role="option">测试大学</div>';
      popup.firstElementChild!.addEventListener('click', () => {
        committed = '测试大学';
        trigger.value = committed;
        popup.remove();
      });
      document.body.appendChild(popup);
    });
    const plan = planGenerator.generatePlan([field], parseResumeFromText(resumeText));
    const result = await pipelineExecutor.executePlan(plan);
    expect(committed).toBe('测试大学');
    expect(result.filledCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('does not report success if SD search text has no selectable result', async () => {
    document.body.innerHTML = `<form>${row('学历 *', input('请选择'))}</form>`;
    const field = pageAnalyzer.analyzePage(document)[0];
    field.element.setAttribute('aria-controls', 'no-results');
    const result = await pipelineExecutor.executePlan(planGenerator.generatePlan([field], parseResumeFromText(resumeText)));
    expect(result.filledCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(field.element.classList.contains('openjobfill-highlight-success')).toBe(false);
    expect((field.element as HTMLInputElement).value).toBe('');
    const retried = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), parseResumeFromText(resumeText));
    expect(retried.items[0].action).toBe('FILL');
  });
});
