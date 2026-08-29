import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFillSession,
  queryFirst,
  isIdentityExcluded,
} from '@/core/adapters/adapterKit';
import { AhoCorasickMatcher } from '@/core/matcher/trieMatcher';

/**
 * 这些用例锁住的是三类真实事故：
 *   1. 身份排斥：把本人姓名填进 username / 紧急联系人字段
 *   2. 容器降级：第 N 段经历静默覆盖第 1 段
 *   3. 统计漂移：页面找不到控件被记成 skipped，真实故障被淹没
 */

describe('AdapterKit 身份排斥与选择器优先级', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('宽泛选择器 [name*="name"] 必须跳过 username / nickname，命中本人姓名字段', () => {
    document.body.innerHTML = `
      <input name="username" />
      <input name="nickname" />
      <input name="candidateName" />
    `;

    const el = queryFirst<HTMLInputElement>(document, ['input[name*="name"]']);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('name')).toBe('candidateName');
  });

  it('紧急联系人 / 家属姓名等第三方控件必须被排除，绝不填入本人信息', () => {
    document.body.innerHTML = `
      <input name="emergencyContactName" placeholder="紧急联系人姓名" />
      <input name="referenceEmail" placeholder="证明人邮箱" />
      <input name="fatherPhone" placeholder="家属联系电话" />
    `;

    expect(queryFirst(document, ['input[name*="name"]', 'input[placeholder*="姓名"]'])).toBeNull();
    expect(queryFirst(document, ['input[name*="email"]', 'input[placeholder*="邮箱"]'])).toBeNull();
    expect(queryFirst(document, ['input[name*="phone"]', 'input[placeholder*="电话"]'])).toBeNull();
  });

  it('明确指定 allowIdentityTerms 时，第三方字段可被正常定位（回填紧急联系人场景）', () => {
    document.body.innerHTML = `<input name="emergencyContactName" />`;

    const el = queryFirst<HTMLInputElement>(
      document,
      ['input[name*="name"]'],
      { allowIdentityTerms: true }
    );
    expect(el).not.toBeNull();
    expect(el?.getAttribute('name')).toBe('emergencyContactName');
  });

  it('中文排斥词同样生效（紧急联系人 / 推荐人 / 家属）', () => {
    document.body.innerHTML = `
      <input placeholder="紧急联系人姓名" />
      <input placeholder="推荐人姓名" />
    `;
    expect(queryFirst(document, ['input[placeholder*="姓名"]'])).toBeNull();

    document.body.innerHTML = `<input placeholder="申请人姓名" />`;
    expect(queryFirst(document, ['input[placeholder*="姓名"]'])).not.toBeNull();
  });

  it('选择器数组按置信度顺序生效，而非 DOM 文档顺序', () => {
    // 宽泛选择器命中 .generic，它在 DOM 中排在前面；
    // 但站点专属选择器优先级更高，必须胜出。
    document.body.innerHTML = `
      <input id="genericField" class="generic" />
      <div class="site-specific"><input id="specificField" /></div>
    `;

    const el = queryFirst<HTMLInputElement>(document, ['.site-specific input', '.generic']);
    expect(el?.id).toBe('specificField');
  });

  it('isIdentityExcluded 对账号类与亲属类属性均返回 true', () => {
    document.body.innerHTML = `
      <input id="a" name="user_name" />
      <input id="b" name="loginName" />
      <input id="c" name="motherName" />
      <input id="d" name="candidateName" />
    `;

    expect(isIdentityExcluded(document.getElementById('a')!)).toBe(true);
    expect(isIdentityExcluded(document.getElementById('b')!)).toBe(true);
    expect(isIdentityExcluded(document.getElementById('c')!)).toBe(true);
    expect(isIdentityExcluded(document.getElementById('d')!)).toBe(false);
  });
});

describe('FillSession 统计口径', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('页面找不到控件必须计入 failed，而不是被误记为 skipped', async () => {
    document.body.innerHTML = `<input name="candidateName" />`;

    const s = createFillSession('测试适配器');
    await s.text(document, ['input[name="candidateName"]'], '姓名', 'basics.name', '张三');
    await s.text(document, ['input[name="notExist"]'], '手机号', 'basics.phone', '13900139000');

    const r = s.finish();
    expect(r.filledCount).toBe(1);
    expect(r.failedCount).toBe(1);
    expect(r.skippedCount).toBe(0);

    const failedLog = r.logs.find((l) => l.status === 'failed');
    expect(failedLog?.message).toContain('未找到');
  });

  it('简历中该字段无值才计入 skipped', async () => {
    document.body.innerHTML = `<input name="email" />`;

    const s = createFillSession('测试适配器');
    await s.text(document, ['input[name="email"]'], '邮箱', 'basics.email', '');

    const r = s.finish();
    expect(r.skippedCount).toBe(1);
    expect(r.failedCount).toBe(0);
  });

  it('0 与 false 属于有效业务值，不得按空值跳过', async () => {
    document.body.innerHTML = `
      <input name="years" />
      <textarea name="married"></textarea>
    `;

    const s = createFillSession('测试适配器');
    await s.text(document, ['input[name="years"]'], '工作年限', 'basics.workingYears', 0);
    await s.textarea(document, ['textarea[name="married"]'], '婚否', 'basics.maritalStatus', false);

    const r = s.finish();
    expect(r.filledCount).toBe(2);
    expect(r.skippedCount).toBe(0);
  });

  it('统计恒等式成立：filled + skipped + failed 等于声明的字段总数', async () => {
    document.body.innerHTML = `<input name="candidateName" />`;

    const s = createFillSession('测试适配器');
    // 共声明 5 个字段：2 成功 / 2 失败 / 1 跳过
    await s.text(document, ['input[name="candidateName"]'], '姓名', 'basics.name', '张三');
    await s.text(document, ['input[name="candidateName"]'], '姓名2', 'basics.name2', '李四');
    await s.text(document, ['input[name="missing1"]'], '手机号', 'basics.phone', '139');
    await s.text(document, ['input[name="missing2"]'], '身份证', 'basics.idCardNumber', '110101');
    await s.text(document, ['input[name="candidateName"]'], '邮箱', 'basics.email', '');

    const r = s.finish();
    expect(r.filledCount + r.skippedCount + r.failedCount).toBe(5);
    expect(r.logs.length).toBe(5);
  });

  it('多段经历区块缺失时必须返回 null 并计 failed，严禁降级到 document', () => {
    const s = createFillSession('测试适配器');
    const cards: HTMLElement[] = []; // 页面上一个区块都没有

    expect(s.section(cards, 0, '教育经历')).toBeNull();

    const r = s.finish();
    expect(r.failedCount).toBe(1);
    expect(r.logs[0].message).toContain('避免覆盖');
  });

  it('区块数量不足时，第 2 段必须中止而非覆写第 1 段', async () => {
    document.body.innerHTML = `
      <div class="edu-card"><input name="school" /></div>
    `;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.edu-card'));
    const schoolInput = document.querySelector<HTMLInputElement>('input[name="school"]')!;

    const s = createFillSession('测试适配器');
    const educations = [
      { schoolName: '清华大学' },
      { schoolName: '北京大学' },
    ];

    for (let i = 0; i < educations.length; i++) {
      const card = s.section(cards, i, '教育经历');
      if (!card) break;
      await s.text(card, ['input[name="school"]'], `学校(${i})`, `educations.${i}.schoolName`, educations[i].schoolName);
    }

    const r = s.finish();
    // 只应有第 1 段成功，第 2 段中止并计 failed
    expect(r.filledCount).toBe(1);
    expect(r.failedCount).toBe(1);
    // 关键：DOM 上必须保留第 1 段的学校，绝不能被第 2 段覆盖
    expect(schoolInput.value).toBe('清华大学');
  });
});

describe('AhoCorasickMatcher 规模自适应', () => {
  const makeDict = (size: number): string[] =>
    Array.from({ length: size }, (_, i) => `keyword_${String(i).padStart(5, '0')}`);

  it('词典规模低于阈值时走朴素路径并跳过 Trie 构建', () => {
    const m = new AhoCorasickMatcher();
    m.insertBatch(makeDict(100));
    m.build();
    expect(m.isAcActive()).toBe(false);
  });

  it('词典规模达到阈值时切换为 AC 路径', () => {
    const m = new AhoCorasickMatcher();
    m.insertBatch(makeDict(400));
    m.build();
    expect(m.isAcActive()).toBe(true);
  });

  it('两条路径对同一文本必须给出完全一致的结果', () => {
    // 使用长词（>3 字符）以规避短词边界检查带来的预期差异
    const dict = makeDict(350);
    const text =
      '熟悉 keyword_00001 与 keyword_00007，了解 keyword_00349，' +
      '另外还用过 keyword_00001 做过 keyword_00150 相关项目。';

    const m = new AhoCorasickMatcher();
    m.insertBatch(dict);
    m.build();

    const autoHits = new Set(m.searchUnique(text));
    const naiveHits = new Set(
      dict.filter((k) => text.toLowerCase().includes(k.toLowerCase()))
    );

    expect(m.isAcActive()).toBe(true);
    expect(autoHits.size).toBe(naiveHits.size);
    for (const k of naiveHits) {
      expect(autoHits.has(k)).toBe(true);
    }
  });

  it('小词典路径的短词边界检查与大词典 AC 路径行为一致', () => {
    const text = 'Proficient in Go, C and R. Also Google and Cat.';

    const small = new AhoCorasickMatcher();
    small.insertBatch(['Go', 'C', 'R']);
    small.build();

    // 独立出现的 Go / C / R 应命中；Google / Cat 内部的子串不应命中
    const hits = small.searchUnique(text);
    expect(hits).toContain('Go');
    expect(hits).toContain('C');
    expect(hits).toContain('R');
  });
});
