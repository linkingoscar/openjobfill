import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseMappingResponse,
  buildMappingPrompt,
  buildResumeKeyOptions,
} from '@/core/ai/fieldMapper';
import {
  tryAIFallback,
  describeUnmatchedField,
  isFillableElement,
  hasFieldHint,
  applyAIFallbackToPlan,
} from '@/core/ai/aiFallback';
import type { FillPlan, FieldDescriptor } from '@/types/pipeline';
import { saveAISettings } from '@/core/storage/aiSettingsStorage';
import type { StandardResume } from '@/types/resume';

const MOCK_RESUME: StandardResume = {
  id: 'ai-test-1',
  title: 'AI 兜底测试简历',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  basics: {
    name: '张伟',
    gender: '男',
    birthDate: '1998-01-15',
    phone: '13800138000',
    email: 'zhangwei@example.com',
    idCardNumber: '110101199801151234',
    nativePlace: { province: '山东省', city: '青岛市' },
    currentLocation: { province: '北京市', city: '海淀区' },
    workingYears: 3,
    expectedRole: '后端工程师',
  },
  educations: [
    {
      id: 'edu-1',
      schoolName: '山东大学',
      degree: '本科',
      major: '计算机科学与技术',
      startDate: '2016-09',
      endDate: '2020-06',
    },
  ],
  experiences: [],
  projects: [],
  skills: [],
  languages: [],
  certificates: [],
  familyMembers: [
    { id: 'fm-1', relation: '父亲', name: '张父', phone: '13900139000' },
  ],
  qaBank: [],
};

/** 模拟 background 的 AI 映射响应 */
function stubAIResponse(mapping: Record<number, string>) {
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn().mockResolvedValue({ success: true, mapping }),
    },
  });
}

function stubAIError(message: string) {
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn().mockResolvedValue({ success: false, error: message }),
    },
  });
}

describe('fieldMapper: prompt 与响应解析', () => {
  it('解析纯 JSON 映射', () => {
    expect(parseMappingResponse('{"0":"basics.name","2":null}')).toEqual({ 0: 'basics.name' });
  });

  it('解析 markdown 代码块包裹的映射', () => {
    const raw = '```json\n{"1":"educations.0.schoolName"}\n```';
    expect(parseMappingResponse(raw)).toEqual({ 1: 'educations.0.schoolName' });
  });

  it('解析带前后文解释的映射', () => {
    const raw = '好的，映射结果如下：{"0":"basics.phone"}\n希望对你有帮助。';
    expect(parseMappingResponse(raw)).toEqual({ 0: 'basics.phone' });
  });

  it('非法 JSON 返回空映射而非抛错', () => {
    expect(parseMappingResponse('无法理解这些字段')).toEqual({});
    expect(parseMappingResponse('')).toEqual({});
    expect(parseMappingResponse('{invalid}')).toEqual({});
  });

  it('prompt 必须包含字段清单与简历候选，且带第三方字段警示', () => {
    const prompt = buildMappingPrompt(
      [{ index: 0, label: '期望工作城市', placeholder: '', name: 'city', ariaLabel: '', inputType: 'text' }],
      [{ resumeKey: 'basics.currentLocation.city', label: '现居城市' }]
    );
    expect(prompt).toContain('期望工作城市');
    expect(prompt).toContain('basics.currentLocation.city');
    expect(prompt).toContain('familyMembers');
    expect(prompt).toContain('绝不能映射到 basics.name');
  });

  it('buildResumeKeyOptions 必须包含家属字段，以承接第三方联系人字段', () => {
    const opts = buildResumeKeyOptions(MOCK_RESUME);
    const keys = opts.map((o) => o.resumeKey);
    expect(keys).toContain('familyMembers.0.name');
    expect(keys).toContain('familyMembers.0.relation');
    expect(keys).toContain('familyMembers.0.phone');
    expect(keys).toContain('basics.name');
  });
});

describe('aiFallback: 元素判定', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('排除按钮、隐藏域、密码框，保留文本与下拉', () => {
    document.body.innerHTML = `
      <input id="t" type="text" />
      <input id="h" type="hidden" />
      <input id="p" type="password" />
      <input id="s" type="submit" />
      <textarea id="ta"></textarea>
    `;
    expect(isFillableElement(document.getElementById('t')!)).toBe(true);
    expect(isFillableElement(document.getElementById('h')!)).toBe(false);
    expect(isFillableElement(document.getElementById('p')!)).toBe(false);
    expect(isFillableElement(document.getElementById('s')!)).toBe(false);
    expect(isFillableElement(document.getElementById('ta')!)).toBe(true);
  });

  it('搜索框与验证码不应交给 AI', () => {
    document.body.innerHTML = `
      <input id="search" placeholder="搜索职位" />
      <input id="captcha" placeholder="请输入验证码" />
      <input id="real" placeholder="期望工作城市" />
    `;
    expect(hasFieldHint(document.getElementById('search')!)).toBe(false);
    expect(hasFieldHint(document.getElementById('captcha')!)).toBe(false);
    expect(hasFieldHint(document.getElementById('real')!)).toBe(true);
  });
});

describe('tryAIFallback: 端到端', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    await saveAISettings({
      enabled: true,
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AI 未启用时返回 null，不发起任何调用', async () => {
    await saveAISettings({ enabled: false, provider: 'ollama', baseUrl: '', model: '' });
    stubAIResponse({ 0: 'basics.name' });

    const result = await tryAIFallback([], MOCK_RESUME);
    expect(result).toBeNull();
  });

  it('正常映射并填充字段，标记为 AI 匹配', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>期望工作城市</label><input name="expectedCity" placeholder="城市" /></div>
    `;
    const el = document.querySelector<HTMLInputElement>('input')!;
    stubAIResponse({ 0: 'basics.currentLocation.city' });

    const outcome = await tryAIFallback(
      [{ element: el, descriptor: describeUnmatchedField(el, 0) }],
      MOCK_RESUME
    );

    expect(outcome).not.toBeNull();
    expect(outcome!.filledCount).toBe(1);
    expect(el.value).toBe('海淀区');
    expect(outcome!.logs[0].message).toContain('AI 匹配');
  });

  it('AI 把紧急联系人字段映射到本人姓名时，必须被安全策略拦截且不写入', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>紧急联系人姓名</label><input name="emergencyContactName" /></div>
    `;
    const el = document.querySelector<HTMLInputElement>('input')!;
    // 模型犯了一个典型错误：把"紧急联系人姓名"映射到本人姓名
    stubAIResponse({ 0: 'basics.name' });

    const outcome = await tryAIFallback(
      [{ element: el, descriptor: describeUnmatchedField(el, 0) }],
      MOCK_RESUME
    );

    expect(outcome!.filledCount).toBe(0);
    expect(outcome!.failedCount).toBe(1);
    expect(el.value).toBe(''); // 关键：绝不能被填成本人姓名
    expect(outcome!.logs[0].message).toContain('拦截');
  });

  it('AI 把紧急联系人字段映射到家属字段时，正常填充', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>紧急联系人姓名</label><input name="emergencyContactName" /></div>
    `;
    const el = document.querySelector<HTMLInputElement>('input')!;
    stubAIResponse({ 0: 'familyMembers.0.name' });

    const outcome = await tryAIFallback(
      [{ element: el, descriptor: describeUnmatchedField(el, 0) }],
      MOCK_RESUME
    );

    expect(outcome!.filledCount).toBe(1);
    expect(el.value).toBe('张父');
  });

  it('简历中对应字段为空时记 skipped 而非硬填', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>个人主页</label><input name="homepage" /></div>
    `;
    const el = document.querySelector<HTMLInputElement>('input')!;
    stubAIResponse({ 0: 'basics.githubUrl' }); // 简历里 githubUrl 为空

    const outcome = await tryAIFallback(
      [{ element: el, descriptor: describeUnmatchedField(el, 0) }],
      MOCK_RESUME
    );

    expect(outcome!.filledCount).toBe(0);
    expect(outcome!.skippedCount).toBe(1);
    expect(el.value).toBe('');
  });

  it('AI 调用失败时返回 null，静默回退，不抛出异常', async () => {
    document.body.innerHTML = `<div class="form-item"><label>期望城市</label><input name="city" /></div>`;
    const el = document.querySelector<HTMLInputElement>('input')!;
    stubAIError('Ollama 请求失败 (HTTP 500)');

    const outcome = await tryAIFallback(
      [{ element: el, descriptor: describeUnmatchedField(el, 0) }],
      MOCK_RESUME
    );

    expect(outcome).toBeNull();
    expect(el.value).toBe('');
  });
});

/** 构造一个最小的 FieldDescriptor */
function makeField(el: HTMLElement, label: string, type: FieldDescriptor['type'] = 'text'): FieldDescriptor {
  return {
    id: `f-${label}`,
    element: el,
    type,
    label,
    placeholder: (el as HTMLInputElement).placeholder || '',
    name: el.getAttribute('name') || '',
    ariaLabel: '',
    required: true,
    disabled: false,
    readOnly: false,
    currentValue: '',
    contextText: label,
  };
}

function makeNeedsUserPlan(fields: Array<{ el: HTMLElement; label: string }>): FillPlan {
  return {
    items: fields.map(({ el, label }) => ({
      id: `p-${label}`,
      field: makeField(el, label),
      confidence: 0,
      action: 'NEEDS_USER' as const,
      driverType: 'input' as const,
    })),
    highConfidenceCount: 0,
    needsUserCount: fields.length,
    skipCount: 0,
    totalFieldsCount: fields.length,
  };
}

describe('applyAIFallbackToPlan: pipeline 运行路径', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    await saveAISettings({
      enabled: true,
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AI 未启用时不改动 plan', async () => {
    await saveAISettings({ enabled: false, provider: 'ollama', baseUrl: '', model: '' });
    document.body.innerHTML = `<div class="form-item"><label>期望工作城市</label><input name="city" /></div>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '期望工作城市' }]);

    const { appliedCount } = await applyAIFallbackToPlan(plan, MOCK_RESUME);

    expect(appliedCount).toBe(0);
    expect(plan.items[0].action).toBe('NEEDS_USER');
  });

  it('AI 映射成功的 NEEDS_USER 字段被就地提升为 FILL 并补 targetValue', async () => {
    document.body.innerHTML = `<div class="form-item"><label>期望工作城市</label><input name="expectedCity" placeholder="城市" /></div>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '期望工作城市' }]);
    stubAIResponse({ 0: 'basics.currentLocation.city' });

    const { appliedCount } = await applyAIFallbackToPlan(plan, MOCK_RESUME);

    expect(appliedCount).toBe(1);
    expect(plan.items[0].action).toBe('FILL');
    expect(plan.items[0].targetValue).toBe('海淀区');
    expect(plan.items[0].reason).toBe('AI 匹配');
    expect(plan.aiFeedback).toContain('新增 1 项');
    expect(plan.aiFeedback).toContain('仍需核对');
    expect(plan.highConfidenceCount).toBe(1);
    expect(plan.needsUserCount).toBe(0);
  });

  it('AI 调用失败时保留本地计划并告知继续操作方式', async () => {
    document.body.innerHTML = `<label>期望城市<input name="city" placeholder="城市" /></label>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '期望城市' }]);
    stubAIError('服务暂不可用');
    expect(await applyAIFallbackToPlan(plan, MOCK_RESUME)).toEqual({ appliedCount: 0 });
    expect(plan.items[0].action).toBe('NEEDS_USER');
    expect(plan.aiFeedback).toContain('本地识别结果已保留');
    expect(plan.aiFeedback).toContain('剪贴板或手动绑定');
  });

  it('AI 把紧急联系人映射到本人姓名时被安全拦截，保持 NEEDS_USER', async () => {
    document.body.innerHTML = `<div class="form-item"><label>紧急联系人姓名</label><input name="emergencyContactName" /></div>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '紧急联系人姓名' }]);
    stubAIResponse({ 0: 'basics.name' });

    const { appliedCount } = await applyAIFallbackToPlan(plan, MOCK_RESUME);

    expect(appliedCount).toBe(0);
    expect(plan.items[0].action).toBe('NEEDS_USER');
  });

  it('AI 映射到家属字段时正常提升', async () => {
    document.body.innerHTML = `<div class="form-item"><label>紧急联系人姓名</label><input name="emergencyContactName" /></div>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '紧急联系人姓名' }]);
    stubAIResponse({ 0: 'familyMembers.0.name' });

    const { appliedCount } = await applyAIFallbackToPlan(plan, MOCK_RESUME);

    expect(appliedCount).toBe(1);
    expect(plan.items[0].action).toBe('FILL');
    expect(plan.items[0].targetValue).toBe('张父');
  });

  it('简历对应字段为空时保持 NEEDS_USER，不硬提升', async () => {
    document.body.innerHTML = `<div class="form-item"><label>个人主页</label><input name="homepage" /></div>`;
    const el = document.querySelector<HTMLElement>('input')!;
    const plan = makeNeedsUserPlan([{ el, label: '个人主页' }]);
    stubAIResponse({ 0: 'basics.githubUrl' }); // 简历里为空

    const { appliedCount } = await applyAIFallbackToPlan(plan, MOCK_RESUME);

    expect(appliedCount).toBe(0);
    expect(plan.items[0].action).toBe('NEEDS_USER');
  });
});
