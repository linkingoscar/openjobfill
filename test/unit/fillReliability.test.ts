import { getMatchingControlAdapters, isControlAdapterValueEquivalent } from '@/core/adapters/controlAdapters';
import { beforeEach, describe, expect, it } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { verifier } from '@/core/pipeline/verifier';
import { mappingSafetyReason } from '@/core/pipeline/mappingSafety';
import { getEnhancerForUrl } from '@/core/adapters/enhancers';
import { parseResumeFromText } from '@/core/parser/resumeParser';
import { buildFillableFields } from '@/core/engine/manualFill';
import { selectCustomOption } from '@/core/engine/selector';

const resume = () => {
  const r = parseResumeFromText('教育经历\n硕士-测试大学-2024.09-2027.06-软件工程-统招全日制');
  Object.assign(r.basics, { name: '虚构候选人', phone: '13900000001', email: 'fictional@example.com', emergencyContactPhone: '13900000002' });
  r.experiences = [{ id: 'exp', company: '虚构公司', title: '实习生', startDate: '2025-01', endDate: '2025-06', description: '' }];
  return r;
};
beforeEach(() => { document.body.innerHTML = ''; });
describe('Shared mapping gates', () => {
  it.each([
    ['https://app.mokahr.com/campus_apply/example/1', '<input type="tel">'],
    ['https://example.italent.cn/apply', '<input id="Mobile">'],
    ['https://example.wintalent.cn/apply', '<input name="mobile">'],
    ['https://nio.jobs.feishu.cn/campus/apply', '<input placeholder="请输入手机号">'],
  ])('routes %s safely with label-only other-person evidence', async (url, markup) => {
    document.body.innerHTML = `<form><div class="form-item"><label>紧急联系人电话</label>${markup}</div></form>`;
    const r = resume(); delete r.basics.emergencyContactPhone;
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), r, getEnhancerForUrl(url, document));
    await pipelineExecutor.executePlan(plan, { pageUrl: url });
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('');
  });
  it('auto-maps separately supplied emergency contact instead of candidate phone', async () => {
    document.body.innerHTML = '<form><div class="form-item"><label>紧急联系人电话</label><input type="tel"></div></form>';
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume(), getEnhancerForUrl('https://app.mokahr.com/apply', document));
    expect(plan.items[0].semanticKey).toBe('basics.emergencyContactPhone');
    expect((await pipelineExecutor.executePlan(plan)).verifiedCount).toBe(1);
    expect(document.querySelector('input')!.value).toBe('13900000002');
  });
  it('retains explicit emergency-contact data and manual menu choice' , async () => {
    document.body.innerHTML = '<form><label>紧急联系人电话<input id="contact"></label></form>';
    const r = resume();
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), r, null, [{ id:'safe', selector:'#contact', resumeKey:'basics.emergencyContactPhone' }]);
    const result = await pipelineExecutor.executePlan(plan);
    expect(result.verifiedCount).toBe(1);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('13900000002');
    expect(buildFillableFields(r).some(f => f.resumeKey === 'basics.emergencyContactPhone')).toBe(true);
  });
  it('does not blanket-ban ordinary candidate contact information', async () => {
    document.body.innerHTML = '<form><div class="form-item"><label>本人联系电话</label><input type="tel" name="contactPhone"></div></form>';
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume(), getEnhancerForUrl('https://app.mokahr.com/apply',document));
    expect((await pipelineExecutor.executePlan(plan)).verifiedCount).toBe(1);
  });
  it('keeps school and company mappings after narrowing Beisen name precedence', async () => {
    document.body.innerHTML = '<form><div class="form-item"><label>毕业院校</label><input id="schoolName"></div><div class="form-item"><label>公司名称</label><input id="companyName"></div></form>';
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume(), getEnhancerForUrl('https://example.italent.cn/apply',document));
    expect(plan.items.map(i => i.targetValue)).toEqual(['测试大学', '虚构公司']);
    expect((await pipelineExecutor.executePlan(plan)).verifiedCount).toBe(2);
  });
  it('blocks unsafe learned mappings and reevaluates live labels at execution', async () => {
    document.body.innerHTML = '<form><label id="caption">姓名<input id="candidate"></label></form>';
    const fields = pageAnalyzer.analyzePage(document);
    const plan = planGenerator.generatePlan(fields, resume());
    document.querySelector('#caption')!.firstChild!.textContent = '紧急联系人姓名';
    expect((await pipelineExecutor.executePlan(plan)).verifiedCount).toBe(0);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('');
    const retried = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume(), null, [{id:'bad', selector:'#candidate', resumeKey:'basics.name'}]);
    expect(retried.items.some(i=>i.semanticKey==='basics.name'&&i.action==='FILL')).toBe(false);
  });
  it('allows separately supplied family mapping', () => {
    document.body.innerHTML = '<label>父亲姓名<input></label>';
    expect(mappingSafetyReason(document.querySelector('input')!, 'familyMembers.0.name')).toBeNull();
    expect(mappingSafetyReason(document.querySelector('input')!, 'basics.name')).not.toBeNull();
  });
});
describe('Full typed verification', () => {
  it('phone adapter cannot override verification with a suffix or non-phone text', () => {
    document.body.innerHTML = '<form><label>手机号</label><div class="job51-phone-field"><input name="phone"></div></form>';
    const field = pageAnalyzer.analyzePage(document)[0];
    const match = getMatchingControlAdapters({field, driverType:'input', pageUrl:'https://jobs.51job.com/application/1'}).find(m=>m.adapter.id==='Job51PhoneField')!;
    expect(match).toBeDefined();
    expect(isControlAdapterValueEquivalent(match, '+86 13900000001', '13900000001')).toBe(true);
    expect(isControlAdapterValueEquivalent(match, '00000001', '13900000001')).toBe(false);
    expect(isControlAdapterValueEquivalent(match, 'error13900000001', '13900000001')).toBe(false);
  });
  it.each([
    ['+86 139-0000-0001', '13900000001', 'input', 'basics.phone', true],
    ['00000001', '13900000001', 'input', 'basics.phone', false],
    ['fictional+tag@example.com', 'fictional@example.com', 'input', 'basics.email', false],
    [' Fictional@EXAMPLE.COM ', 'fictional@example.com', 'input', 'basics.email', true],
    ['陈', '陈小明', 'input', 'basics.name', false],
    ['A-B', 'AB', 'input', 'basics.name', false],
    ['北京市', '北京', 'input', 'basics.currentLocation.city', true],
    ['广东省/深圳市/南山区', '广东省-深圳市-南山区', 'cascader', 'basics.currentLocation', true],
    ['广东省/深圳市/福田区', '广东省-深圳市-南山区', 'cascader', 'basics.currentLocation', false],
    ['大学本科', '本科', 'select', 'educations.0.degree', true],
    ['本科及以上', '本科', 'select', 'educations.0.degree', false],
    ['清华大学', '清华', 'select', 'educations.0.schoolName', true],
    ['东南大学', '东大', 'select', 'educations.0.schoolName', false],
    ['清华大学', '清华大学（深圳校区）', 'select', 'educations.0.schoolName', false],
    ['测试大学独立学院', '测试大学', 'select', 'educations.0.schoolName', false],
    ['不确定', true, 'checkbox', 'educations.0.isFullTime', false],
  ] as const)('compares %s against %s', (a,e,driver,key,expected) => {
    expect(verifier.isSemanticEquivalent(a,e,driver,key)).toBe(expected);
  });
  it('chooses exact entity instead of earlier prefix match', async () => {
    document.body.innerHTML = '<label>学校名称<select><option value="">请选择</option><option value="bad">测试大学独立学院</option><option value="good">测试大学</option></select></label>';
    const el = document.querySelector('select')!;
    expect(await selectCustomOption(el, '测试大学')).toBe(true);
    expect(el.value).toBe('good');
  });
  it('refuses ambiguous aliases and preserves campus qualifiers before selecting', async () => {
    document.body.innerHTML = '<label>学校名称<select><option value="">请选择</option><option value="bad">东南大学</option><option value="bad2">清华大学</option></select></label>';
    const el = document.querySelector('select')!;
    expect(await selectCustomOption(el, '东大')).toBe(false);
    expect(await selectCustomOption(el, '清华大学（深圳校区）')).toBe(false);
    expect(el.value).toBe('');
    expect(await selectCustomOption(el, '清华')).toBe(true);
    expect(el.value).toBe('bad2');
  });
  it('does not click a custom dropdown entity prefix', async () => {
    document.body.innerHTML = '<label>学校名称<input role="combobox" aria-controls="schools"></label><div id="schools"><div role="option">测试大学独立学院</div></div>';
    let clicked = false;
    document.querySelector('[role="option"]')!.addEventListener('click', () => { clicked=true; });
    expect(await selectCustomOption(document.querySelector('input')!, '测试大学')).toBe(false);
    expect(clicked).toBe(false);
    expect(document.querySelector('input')!.value).toBe('');
  });
});

describe('Split date group fallback boundaries', () => {
  it('does not inherit another field required marker or fill an unlabelled year', () => {
    document.body.innerHTML = '<form><div class="form-item"><label>学校名称 *</label><input placeholder="请输入学校"><div><input placeholder="年"><input placeholder="月"></div></div></form>';
    const dates = pageAnalyzer.analyzePage(document).filter(f => f.placeholder==='年'||f.placeholder==='月');
    expect(dates.every(f => !f.unresolvedDateGroup)).toBe(true);
  });
  it('exposes all missing required date parts as remaining work after execution', async () => {
    document.body.innerHTML = '<form><div><div class="field-title">就读时间 *</div><div><input placeholder="年"><input placeholder="月"><input placeholder="年"><input placeholder="月"></div></div></form>';
    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume());
    expect(plan.items.every(i=>i.action==='NEEDS_USER' && i.field.required)).toBe(true);
    const result = await pipelineExecutor.executePlan(plan);
    expect(result.remainingTasks).toHaveLength(4);
    expect(result.verifiedCount).toBe(0);
    expect(Array.from(document.querySelectorAll('input')).every(el=>el.value==='')).toBe(true);
  });
});
