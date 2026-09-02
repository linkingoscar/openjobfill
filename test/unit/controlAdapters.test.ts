import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTROL_ADAPTER_IDS,
  getControlAdapterCatalog,
  getControlAdapterMatchTrace,
  getMatchingControlAdapters,
} from '@/core/adapters/controlAdapters';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { executeMainWorldControlAction } from '@/core/adapters/mainWorldBridge';
import type { StandardResume } from '@/types/resume';

const resume: StandardResume = {
  id: 'adapter-resume',
  title: '复杂控件测试',
  isDefault: true,
  createdAt: 1,
  updatedAt: 1,
  basics: {
    name: '张三',
    phone: '+86 13900139000',
    email: '',
    idCardNumber: '',
    workingYears: 0,
  },
  educations: [],
  experiences: [],
  projects: [],
  languages: [],
  skills: [],
  certificates: [],
  familyMembers: [],
  qaBank: [],
};

describe('58 个复杂控件 Adapter Runtime', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('应完整、唯一登记生产兼容矩阵中的 58 个 Adapter', () => {
    const catalog = getControlAdapterCatalog();
    expect(catalog).toHaveLength(58);
    expect(new Set(catalog.map((adapter) => adapter.id)).size).toBe(58);
    expect(catalog.map((adapter) => adapter.id)).toEqual([...CONTROL_ADAPTER_IDS]);
    expect(catalog.filter((adapter) => adapter.world === 'MAIN').map((adapter) => adapter.id)).toEqual([
      'PhoenixInput',
      'HcSuperSelector',
      'PhoenixSelect',
      'Job51SetdayDate',
      'My97Date',
    ]);
  });

  it('Moka 搜索下拉应优先匹配站点专属 Adapter，并输出无值诊断轨迹', () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>毕业院校</label>
        <div class="mokahr-search-dropdown"><input role="combobox" name="school"></div>
      </form>`;
    const field = pageAnalyzer.analyzePage(document)[0];
    const context = { field, driverType: 'select' as const, pageUrl: 'https://app.mokahr.com/application/1' };

    expect(getMatchingControlAdapters(context)[0]?.adapter.id).toBe('MokahrSearchDropdown');
    const trace = getControlAdapterMatchTrace(context);
    expect(trace.find((adapter) => adapter.id === 'MokahrSearchDropdown')?.matched).toBe(true);
    expect(JSON.stringify(trace)).not.toContain('北京大学');
  });

  it('51Job 组合电话应拆分区号和本地号码，并通过专属回读验证', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>手机号码</label>
        <div class="job51-phone-field">
          <input name="areaCode" placeholder="国家区号">
          <input name="phone" placeholder="手机号码">
        </div>
      </form>`;

    const fields = pageAnalyzer.analyzePage(document);
    expect(fields).toHaveLength(1);
    const plan = planGenerator.generatePlan(fields, resume);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-phone',
      pageUrl: 'https://jobs.51job.com/application/1',
    });

    const inputs = document.querySelectorAll<HTMLInputElement>('input');
    expect(inputs[0].value).toBe('+86');
    expect(inputs[1].value).toBe('13900139000');
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({
      adapterId: 'Job51PhoneField',
      executionWorld: 'ISOLATED',
      outcome: 'success',
    });
  });

  it('Moka 搜索下拉应输入检索词、选择候选项并走专属验证', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>毕业院校</label>
        <div class="mokahr-search-dropdown"><input role="combobox" name="school"></div>
      </form>
      <div class="mokahr-dropdown-option">北京大学</div>`;
    let optionClicked = false;
    document.querySelector('.mokahr-dropdown-option')!.addEventListener('click', () => { optionClicked = true; });
    const withEducation: StandardResume = {
      ...resume,
      educations: [{ id: 'edu-1', schoolName: '北京大学', degree: '', major: '', startDate: '', endDate: '' }],
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withEducation);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-moka-search',
      pageUrl: 'https://app.mokahr.com/application/1',
    });

    expect(optionClicked).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({ adapterId: 'MokahrSearchDropdown', outcome: 'success' });
  });

  it('MAIN world 桥只能通过一次性授权发送固定动作与结构定位器', async () => {
    document.body.innerHTML = '<label for="phoenix-city">城市</label><div id="phoenix-city" class="phoenix-select"></div>';
    const field = pageAnalyzer.analyzePage(document)[0];
    const sendMessage = vi.fn()
      .mockResolvedValueOnce({ success: true, token: 'token-1' })
      .mockResolvedValueOnce({ success: true });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });

    await expect(executeMainWorldControlAction({
      adapterId: 'PhoenixSelect',
      action: 'SELECT_PATH',
      field,
      value: ['广东省', '深圳市'],
      runId: 'run-phoenix',
    })).resolves.toBe(true);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      type: 'AUTHORIZE_MAIN_WORLD_CONTROL',
      payload: { runId: 'run-phoenix' },
    });
    expect(sendMessage.mock.calls[1][0]).toMatchObject({
      type: 'EXECUTE_MAIN_WORLD_CONTROL',
      payload: {
        token: 'token-1',
        adapterId: 'PhoenixSelect',
        action: 'SELECT_PATH',
        selectors: expect.arrayContaining(['#phoenix-city']),
        value: ['广东省', '深圳市'],
      },
    });
  });

  it('51Job 三层联动应逐层选择地区并按最终渲染路径验证', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>现居地区</label>
        <div class="job51-three-layer"><span class="selected-value">请选择</span></div>
      </form>
      <div class="cascader-modal">
        <div class="cascader-item">广东省</div>
        <div class="cascader-item">深圳市</div>
        <div class="cascader-item">南山区</div>
      </div>`;
    const clicked: string[] = [];
    const trigger = document.querySelector<HTMLElement>('.job51-three-layer')!;
    document.querySelectorAll<HTMLElement>('.cascader-item').forEach((item) => {
      item.addEventListener('click', () => {
        clicked.push(item.textContent || '');
        if (clicked.length === 3) trigger.querySelector('.selected-value')!.textContent = clicked.join('/');
      });
    });
    const withLocation: StandardResume = {
      ...resume,
      basics: {
        ...resume.basics,
        currentLocation: { province: '广东省', city: '深圳市', district: '南山区' },
      },
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withLocation, null, [{
      id: 'region-rule', selector: '.job51-three-layer', resumeKey: 'basics.currentLocation',
    }]);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-job51-region', pageUrl: 'https://jobs.51job.com/application/1',
    });

    expect(clicked).toEqual(['广东省', '深圳市', '南山区']);
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({ adapterId: 'Job51ThreeLayerSelect', outcome: 'success' });
  });

  it('拉勾富文本应使用专属 Adapter 写入并回读 contenteditable', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>自我评价</label><div class="lagou-editor" contenteditable="true"></div>
      </form>`;
    const withEvaluation: StandardResume = {
      ...resume,
      basics: { ...resume.basics, selfEvaluation: '专注复杂前端系统与工程质量。' },
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withEvaluation);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-lagou-editor', pageUrl: 'https://www.lagou.com/resume/apply',
    });

    expect(document.querySelector<HTMLElement>('.lagou-editor')!.textContent).toBe('专注复杂前端系统与工程质量。');
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({ adapterId: 'LagouEditor', outcome: 'success' });
  });

  it('TP-Link 民族选择器应从弹层选择并回读渲染值', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>民族</label><div class="tp-ethnic-picker"><span class="selected-value">请选择</span></div>
      </form>
      <div class="tp-select-option">汉族</div>`;
    const trigger = document.querySelector<HTMLElement>('.tp-ethnic-picker')!;
    document.querySelector<HTMLElement>('.tp-select-option')!.addEventListener('click', () => {
      trigger.querySelector('.selected-value')!.textContent = '汉族';
    });
    const withEthnicity: StandardResume = {
      ...resume,
      basics: { ...resume.basics, ethnicity: '汉族' },
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withEthnicity, null, [{
      id: 'ethnicity-rule', selector: '.tp-ethnic-picker', resumeKey: 'basics.ethnicity',
    }]);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-tplink-ethnicity', pageUrl: 'https://career.tp-link.com/apply',
    });

    expect(trigger.textContent).toContain('汉族');
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({ adapterId: 'TpLinkEthnicPicker', outcome: 'success' });
  });

  it('交通银行弹层选择器应确认候选并走专属回读', async () => {
    document.body.innerHTML = `
      <form class="application-form">
        <label>政治面貌</label><div class="bankcomm-select"><span class="selected-value">请选择</span></div>
      </form>
      <div class="pop-panel"><table><tbody><tr><td>群众</td></tr></tbody></table><button>确定</button></div>`;
    const trigger = document.querySelector<HTMLElement>('.bankcomm-select')!;
    document.querySelector<HTMLElement>('.pop-panel td')!.addEventListener('click', () => {
      trigger.querySelector('.selected-value')!.textContent = '群众';
    });
    const withPoliticalStatus: StandardResume = {
      ...resume,
      basics: { ...resume.basics, politicalStatus: '群众' },
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withPoliticalStatus, null, [{
      id: 'political-rule', selector: '.bankcomm-select', resumeKey: 'basics.politicalStatus',
    }]);
    const result = await pipelineExecutor.executePlan(plan, {
      runId: 'run-bankcomm', pageUrl: 'https://job.bankcomm.com/apply',
    });

    expect(trigger.textContent).toContain('群众');
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({ adapterId: 'BankCommPopPanel', outcome: 'success' });
  });

  it('My97 日期应使用受限 MAIN-world TYPE 并通过页面值回读', async () => {
    document.body.innerHTML = '<form class="application-form"><label>出生日期</label><input class="Wdate"></form>';
    const input = document.querySelector<HTMLInputElement>('.Wdate')!;
    const sendMessage = vi.fn(async (message: { type: string; payload?: { value?: string } }) => {
      if (message.type === 'AUTHORIZE_MAIN_WORLD_CONTROL') return { success: true, token: 'my97-token' };
      if (message.type === 'EXECUTE_MAIN_WORLD_CONTROL') {
        input.value = String(message.payload?.value || '');
        return { success: true };
      }
      return { success: false };
    });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    const withBirthDate: StandardResume = {
      ...resume,
      basics: { ...resume.basics, birthDate: '2000-01-02' },
    };

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), withBirthDate, null, [{
      id: 'birth-date-rule', selector: '.Wdate', resumeKey: 'basics.birthDate',
    }]);
    const result = await pipelineExecutor.executePlan(plan, { runId: 'run-my97', pageUrl: 'https://legacy.example.com/apply' });

    expect(input.value).toBe('2000-01-02');
    expect(result.failedCount).toBe(0);
    expect(result.logs[0].attempts?.[0]).toMatchObject({
      adapterId: 'My97Date', executionWorld: 'MAIN', outcome: 'success',
    });
    expect(sendMessage.mock.calls[1][0]).toMatchObject({
      type: 'EXECUTE_MAIN_WORLD_CONTROL', payload: { adapterId: 'My97Date', action: 'TYPE' },
    });
  });

  it('普通输入不应误命中复杂控件 Adapter，仍由通用策略兜底', async () => {
    document.body.innerHTML = '<form><label>姓名</label><input name="name"></form>';
    const fields = pageAnalyzer.analyzePage(document);
    const plan = planGenerator.generatePlan(fields, resume);
    const result = await pipelineExecutor.executePlan(plan, { pageUrl: 'https://example.com/apply' });

    expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('张三');
    expect(result.logs[0].attempts?.[0].adapterId).toBeUndefined();
    expect(result.logs[0].attempts?.[0].strategy).toContain('Native Prototype Setter');
  });
});
