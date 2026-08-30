import { beforeEach, describe, expect, it } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { dateEngine } from '@/core/resolvers/dateEngine';
import { selectCustomOption } from '@/core/engine/selector';
import { sectionEngine } from '@/core/engine/sectionEngine';
import { setCustomCheckboxChecked, setRadioGroupValue } from '@/core/engine/dispatcher';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pipelineExecutor } from '@/core/pipeline/executor';
import type { PlatformEnhancer } from '@/types/pipeline';
import type { StandardResume } from '@/types/resume';

const resume: StandardResume = {
  id: 'controls', title: '控件兼容测试', isDefault: true, createdAt: 1, updatedAt: 1,
  basics: { name: '张三', birthDate: '2001-05-18', phone: '13800138000', email: 'a@example.com', idCardNumber: '', workingYears: 0 },
  educations: [
    { id: 'e1', schoolName: '甲大学', degree: '本科', major: '计算机', startDate: '2019-09', endDate: '2023-06' },
    { id: 'e2', schoolName: '乙大学', degree: '硕士', major: '软件工程', startDate: '2023-09', endDate: '2026-06' },
  ],
  experiences: [], projects: [], languages: [], skills: [], certificates: [], familyMembers: [], qaBank: [],
};

describe('复杂网申控件兼容层', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('应识别 Semi、ARIA 选择控件、日期弹层与年月组合', () => {
    document.body.innerHTML = `
      <div class="form-item"><label>学历层次</label><div class="semi-select"><span>请选择</span></div></div>
      <div class="form-item"><label>出生日期</label><div class="ant-picker"><input readonly placeholder="请选择日期"></div></div>
      <div class="form-item date-range"><label>入学年月</label><select><option>2019</option></select><select><option>9</option></select></div>
      <div role="radiogroup"><div role="radio" aria-checked="false">男</div><div role="radio" aria-checked="false">女</div></div>
      <div role="checkbox" aria-checked="false">接受调剂</div>
    `;

    const types = pageAnalyzer.analyzePage(document).map((field) => field.type);
    expect(types).toContain('select');
    expect(types.filter((type) => type === 'date')).toHaveLength(2);
    expect(types).toContain('radio');
    expect(types).toContain('checkbox');
  });

  it('应扫描 open ShadowRoot 中的字段', () => {
    const host = document.createElement('job-application');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<label for="shadow-name">姓名</label><input id="shadow-name" name="candidateName">';

    const fields = pageAnalyzer.analyzePage(document);
    expect(fields.some((field) => field.name === 'candidateName')).toBe(true);
  });

  it('ARIA radio、checkbox 和分段按钮应按目标状态操作', () => {
    document.body.innerHTML = `
      <div role="radiogroup"><button role="radio" aria-checked="true">男</button><button role="radio" aria-checked="false">女</button></div>
      <button id="agree" role="checkbox" aria-checked="false">接受调剂</button>
    `;
    const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios.forEach((radio) => radio.addEventListener('click', () => {
      radios.forEach((item) => item.setAttribute('aria-checked', String(item === radio)));
    }));
    const checkbox = document.querySelector<HTMLElement>('#agree')!;
    checkbox.addEventListener('click', () => checkbox.setAttribute('aria-checked', String(checkbox.getAttribute('aria-checked') !== 'true')));

    expect(setRadioGroupValue(radios[0], '女')).toBe(true);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(setCustomCheckboxChecked(checkbox, true)).toBe(true);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });

  it('受控日期直接写值失败后应点击弹层中的精确日期', async () => {
    document.body.innerHTML = `
      <div class="ant-picker"><input readonly placeholder="请选择日期"></div>
      <div class="ant-picker-dropdown"><button data-date="2001-05-18">18</button></div>
    `;
    const wrapper = document.querySelector<HTMLElement>('.ant-picker')!;
    const input = wrapper.querySelector<HTMLInputElement>('input')!;
    input.addEventListener('input', () => { input.value = ''; });
    document.querySelector('[data-date]')!.addEventListener('click', () => { input.value = '2001-05-18'; });

    expect(await dateEngine.injectSemanticDate(wrapper, '2001-05-18')).toBe(true);
    expect(input.value).toBe('2001-05-18');
  });

  it('Ant 风格日期弹层应跨年份分页并选择目标年月日', async () => {
    document.body.innerHTML = `
      <div class="ant-picker"><input readonly placeholder="请选择日期"></div>
      <div class="ant-picker-dropdown">
        <div class="ant-picker-header">
          <button class="ant-picker-header-super-prev-btn">上一年代</button>
          <button class="ant-picker-year-btn">2026</button>
          <button class="ant-picker-month-btn">8月</button>
        </div>
        <div class="calendar-body"></div>
      </div>
    `;
    const wrapper = document.querySelector<HTMLElement>('.ant-picker')!;
    const input = wrapper.querySelector<HTMLInputElement>('input')!;
    const popup = document.querySelector<HTMLElement>('.ant-picker-dropdown')!;
    const body = popup.querySelector<HTMLElement>('.calendar-body')!;
    const yearButton = popup.querySelector<HTMLElement>('.ant-picker-year-btn')!;
    const monthButton = popup.querySelector<HTMLElement>('.ant-picker-month-btn')!;
    let decadeStart = 2020;

    input.addEventListener('input', () => { input.value = ''; });
    const renderYears = () => {
      body.innerHTML = Array.from({ length: 10 }, (_, index) =>
        `<button class="ant-picker-cell">${decadeStart + index}</button>`
      ).join('');
      body.querySelectorAll<HTMLElement>('.ant-picker-cell').forEach((cell) => {
        cell.addEventListener('click', () => {
          yearButton.textContent = cell.textContent;
          body.innerHTML = Array.from({ length: 12 }, (_, index) =>
            `<button class="ant-picker-cell" title="${cell.textContent}-${String(index + 1).padStart(2, '0')}">${index + 1}月</button>`
          ).join('');
        });
      });
    };
    yearButton.addEventListener('click', renderYears);
    popup.querySelector('.ant-picker-header-super-prev-btn')!.addEventListener('click', () => {
      decadeStart -= 10;
      renderYears();
    });
    monthButton.addEventListener('click', () => {});
    body.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.getAttribute('title') === '2001-05') {
        monthButton.textContent = '5月';
        body.innerHTML = '<button class="ant-picker-cell" title="2001-05-18">18</button>';
        body.querySelector('button')!.addEventListener('click', () => { input.value = '2001-05-18'; });
      }
    });

    expect(await dateEngine.injectSemanticDate(wrapper, '2001-05-18')).toBe(true);
    expect(input.value).toBe('2001-05-18');
  });

  it('“至今”文字位于 label 时应读取内部 checkbox 的真实状态', async () => {
    document.body.innerHTML = `
      <div class="form-item"><div class="ant-picker"><input placeholder="结束日期"></div>
        <label>至今<input type="checkbox"></label>
      </div>
    `;
    const picker = document.querySelector<HTMLElement>('.ant-picker')!;
    expect(await dateEngine.injectSemanticDate(picker, '至今')).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
  });

  it('Semi Portal 下拉应能选择并读到目标项', async () => {
    document.body.innerHTML = `
      <div class="semi-select"><span class="semi-select-selection-text">请选择</span></div>
      <div class="semi-select-portal"><div class="semi-select-option">本科</div><div class="semi-select-option">硕士</div></div>
    `;
    const trigger = document.querySelector<HTMLElement>('.semi-select')!;
    document.querySelectorAll<HTMLElement>('.semi-select-option').forEach((option) => {
      option.addEventListener('click', () => { trigger.querySelector('span')!.textContent = option.textContent; });
    });

    expect(await selectCustomOption(trigger, '本科')).toBe(true);
    expect(trigger.textContent).toContain('本科');
  });

  it('虚拟下拉未命中首屏时应滚动并继续查找选项', async () => {
    document.body.innerHTML = `
      <div class="ant-select" aria-controls="virtual-list"><span class="ant-select-selection-item">请选择</span></div>
      <div id="virtual-list" role="listbox"><div class="rc-virtual-list-holder"><div role="option">北京大学</div></div></div>
    `;
    const trigger = document.querySelector<HTMLElement>('.ant-select')!;
    const holder = document.querySelector<HTMLElement>('.rc-virtual-list-holder')!;
    Object.defineProperty(holder, 'clientHeight', { value: 200 });
    Object.defineProperty(holder, 'scrollHeight', { value: 1000 });
    holder.addEventListener('scroll', () => {
      holder.innerHTML = '<div role="option">清华大学</div>';
      holder.querySelector('[role="option"]')!.addEventListener('click', () => {
        trigger.querySelector('span')!.textContent = '清华大学';
      });
    });

    expect(await selectCustomOption(trigger, '清华大学')).toBe(true);
    expect(trigger.textContent).toContain('清华大学');
  });

  it('平台专属 addButton 应优先用于增补教育经历', async () => {
    document.body.innerHTML = `
      <section id="education"><div class="edu-row"><input></div><button id="icon-add" aria-label="添加一条">＋</button></section>
    `;
    const section = document.querySelector('#education')!;
    document.querySelector('#icon-add')!.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'edu-row';
      row.innerHTML = '<input>';
      section.insertBefore(row, document.querySelector('#icon-add'));
    });
    const enhancer: PlatformEnhancer = {
      id: 'fixture', name: 'fixture', priority: 1, matches: () => true,
      repeaterConfigs: {
        education: { sectionRoot: '#education', itemSelector: '.edu-row', addButton: '#icon-add' },
      },
    };

    expect(await sectionEngine.ensureSectionCapacity(resume, enhancer)).toBe(true);
    expect(document.querySelectorAll('.edu-row')).toHaveLength(2);
  });

  it('复杂日期、Semi 下拉和年月组合应通过完整 Pipeline 写回验证', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>出生日期</label><div class="ant-picker"><input readonly placeholder="请选择日期"></div></div>
      <div class="ant-picker-dropdown"><button data-date="2001-05-18">18</button></div>
      <div class="form-item"><label>学历层次</label><div class="semi-select"><span class="semi-select-selection-text">请选择</span></div></div>
      <div class="semi-select-portal"><div class="semi-select-option">本科</div><div class="semi-select-option">硕士</div></div>
      <div class="form-item date-range"><label>入学年月</label>
        <select><option value="">年</option><option value="2019">2019</option></select>
        <select><option value="">月</option><option value="09">9</option></select>
      </div>
    `;
    const birthInput = document.querySelector<HTMLInputElement>('.ant-picker input')!;
    birthInput.addEventListener('input', () => { birthInput.value = ''; });
    document.querySelector('[data-date]')!.addEventListener('click', () => { birthInput.value = '2001-05-18'; });
    const degree = document.querySelector<HTMLElement>('.semi-select')!;
    document.querySelectorAll<HTMLElement>('.semi-select-option').forEach((option) => {
      option.addEventListener('click', () => { degree.querySelector('span')!.textContent = option.textContent; });
    });

    const plan = planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume);
    const result = await pipelineExecutor.executePlan(plan);

    expect(result.failedCount).toBe(0);
    expect(birthInput.value).toBe('2001-05-18');
    expect(degree.textContent).toContain('本科');
    const dateParts = document.querySelectorAll<HTMLSelectElement>('.date-range select');
    expect(dateParts[0].value).toBe('2019');
    expect(dateParts[1].value).toBe('09');
  });

  it('日期范围字段应把同一段经历的开始和结束日期成对写入', async () => {
    document.body.innerHTML = `
      <div class="form-item"><label>教育起止时间</label>
        <div class="ant-picker ant-picker-range"><input type="date"><input type="date"></div>
      </div>
    `;
    const fields = pageAnalyzer.analyzePage(document);
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe('date-range');
    const plan = planGenerator.generatePlan(fields, resume, null, [
      { selector: '.ant-picker-range', resumeKey: 'educations.0.startDate' },
    ]);

    const result = await pipelineExecutor.executePlan(plan);
    const inputs = document.querySelectorAll<HTMLInputElement>('input');
    expect(result.failedCount).toBe(0);
    expect(inputs[0].value).toBe('2019-09-01');
    expect(inputs[1].value).toBe('2023-06-01');
  });
});
