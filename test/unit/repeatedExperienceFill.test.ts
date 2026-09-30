import { beforeEach, describe, expect, it } from 'vitest';
import { formFillerEngine } from '@/core/engine/filler';
import { sectionEngine } from '@/core/engine/sectionEngine';
import { ensureSectionRows } from '@/core/engine/repeater';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { EMPTY_RESUME } from '@/core/storage/defaultData';

function resume() {
  const value = structuredClone(EMPTY_RESUME);
  value.educations = Array.from({ length: 3 }, (_, i) => ({ id: `edu-${i}`, schoolName: `学校${i + 1}`, degree: '本科' as const, major: `专业${i + 1}`, startDate: '', endDate: '' }));
  value.experiences = Array.from({ length: 2 }, (_, i) => ({ id: `exp-${i}`, company: `公司${i + 1}`, title: `岗位${i + 1}`, startDate: '', endDate: '' }));
  value.projects = Array.from({ length: 7 }, (_, i) => ({ id: `project-${i}`, projectName: `项目${i + 1}`, role: `角色${i + 1}`, startDate: '', endDate: '' }));
  value.awards = Array.from({ length: 8 }, (_, i) => ({ id: `award-${i}`, name: `奖项${i + 1}`, issueDate: `2025-${String(i + 1).padStart(2, '0')}` }));
  return value;
}

const specs = {
  education: ['教育经历', '学校名称', '专业名称'],
  experience: ['实习经历', '公司名称', '职位名称'],
  project: ['项目经历', '项目名称', '项目角色'],
  award: ['获奖经历', '奖项名称', '获奖时间'],
};

// Class names intentionally carry no record semantics, as in CSS-module ATS
// pages. Adding replaces the whole section, including its button.
function mount(key: keyof typeof specs, initial = 1, limit = 100, delay = 0) {
  let count = initial;
  let clicks = 0;
  const render = () => {
    const root = document.createElement('div');
    root.id = key;
    const [title, first, second] = specs[key];
    root.innerHTML = `<div class="heading-X"><h2>${title}</h2><a role="button"><span>＋</span> 添加</a></div>
      <div class="entries-X">${Array.from({ length: count }, () => `<div class="entry-X"><span>删除本条</span>
        <label>${first}<input placeholder="${first}"></label>
        <label>${second}<input ${key === 'award' ? 'type="month"' : ''} placeholder="${second}"></label>
      </div>`).join('')}</div>`;
    root.querySelector('a')!.addEventListener('click', () => {
      clicks++;
      if (count >= limit) return;
      const add = () => { count++; render(); };
      if (delay) setTimeout(add, delay); else add();
    });
    const previous = document.getElementById(key);
    if (previous) previous.replaceWith(root); else document.querySelector('form')!.appendChild(root);
  };
  render();
  return { clicks: () => clicks, count: () => count };
}

describe('automatic add and fill for repeated experiences', () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = '<form></form>'; });

  it('previews, fills two records per section and remains idempotent (large batches covered in Chromium)', async () => {
    const records = resume();
    records.educations = records.educations.slice(0, 2);
    records.projects = records.projects.slice(0, 2);
    records.awards = records.awards!.slice(0, 2);
    const sections = Object.fromEntries(Object.keys(specs).map(key => [key, mount(key as keyof typeof specs)]));
    const analyzed = await formFillerEngine.analyze(records);
    expect(analyzed.sectionPreparation?.actions.map(action => [action.groupKey, action.initialCount, action.desiredCount])).toEqual([
      ['education', 1, 2], ['experience', 1, 2], ['project', 1, 2], ['award', 1, 2],
    ]);
    expect(Object.values(sections).every(section => section.clicks() === 0)).toBe(true);
    const result = await formFillerEngine.executePlan(analyzed);
    expect(result.failedCount).toBe(0);
    const values = (key: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`#${key} .entry-X input:first-of-type`)).map(input => input.value);
    expect(values('education')).toEqual(records.educations.flatMap(item => [item.schoolName, item.major]));
    expect(values('experience')).toEqual(records.experiences.flatMap(item => [item.company, item.title]));
    expect(values('project')).toEqual(records.projects.flatMap(item => [item.projectName, item.role]));
    expect(values('award')).toEqual(records.awards!.flatMap(item => [item.name, item.issueDate]));
    expect(Object.values(sections).map(section => section.clicks())).toEqual([1, 1, 1, 1]);
    await formFillerEngine.fill(records);
    expect(Object.values(sections).map(section => section.clicks())).toEqual([1, 1, 1, 1]);
  }, 20000);

  it('starts at zero and waits for asynchronously rendered cards', async () => {
    document.querySelector('form')!.innerHTML = '<section id="empty"><h2>获奖经历</h2><button type="button">添加</button><div class="rows"></div></section>';
    let clicks = 0;
    document.querySelector('button')!.addEventListener('click', () => {
      clicks++;
      setTimeout(() => document.querySelector('.rows')!.insertAdjacentHTML('beforeend', '<div class="card"><label>奖项名称<input></label></div>'), 30);
    });
    const records = resume(); records.educations = []; records.experiences = []; records.projects = []; records.awards = records.awards!.slice(0, 2);
    expect(await sectionEngine.ensureSectionCapacity(records)).toBe(true);
    expect(clicks).toBe(2);
    expect(pageAnalyzer.analyzePage(document).map(field => field.section)).toEqual([
      { type: 'award', index: 0, rawTitle: '获奖经历' }, { type: 'award', index: 1, rawTitle: '获奖经历' },
    ]);
  });

  it('stops after a button makes no progress and reports the exact missing record count', async () => {
    const section = mount('award', 1, 3);
    const records = resume(); records.educations = []; records.experiences = []; records.projects = [];
    const result = await formFillerEngine.fill(records);
    expect(section.count()).toBe(3);
    expect(section.clicks()).toBe(3);
    expect(result.remainingTasks?.some(task => task.reason.includes('仍缺 5 条'))).toBe(true);
    expect(result.failedCount).toBeGreaterThan(0);
  }, 10000);

  it('never uses a neighbouring section button or a submit button', async () => {
    document.querySelector('form')!.innerHTML = '<section><h2>教育经历</h2><div class="card"><input></div><button type="submit">添加</button></section>';
    const awards = mount('award');
    let submissions = 0;
    document.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); submissions++; });
    const records = resume(); records.awards = []; records.projects = []; records.experiences = [];
    await sectionEngine.ensureSectionCapacity(records);
    expect(awards.clicks()).toBe(0);
    expect(submissions).toBe(0);
    expect(sectionEngine.getLastDiagnostics().find(item => item.groupKey === 'education')?.status).toBe('failed');
  });

  it('refreshes configured roots too and removes the old five-click cap', async () => {
    mount('award');
    const items = await ensureSectionRows({ containerSelector: '#award', itemSelector: '.entry-X', addButtonSelector: 'a', itemFields: {} }, 8);
    expect(items).toHaveLength(8);
    expect(items.every(item => item.isConnected)).toBe(true);
  });
});
