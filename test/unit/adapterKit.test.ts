import { describe, it, expect, beforeEach } from 'vitest';
import { isIdentityExcluded } from '@/core/adapters/adapterKit';
import { AhoCorasickMatcher } from '@/core/matcher/trieMatcher';
describe('Identity exclusion used by AI mapping', () => {
 beforeEach(() => { document.body.innerHTML = ''; });
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
describe('AhoCorasickMatcher 规模自适应', () => {
  const makeDict = (size: number): string[] =>
    Array.from({ length: size }, (_, i) => `keyword_${String(i).padStart(5, '0')}`);

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

    expect(autoHits.size).toBe(naiveHits.size);
    for (const k of naiveHits) {
      expect(autoHits.has(k)).toBe(true);
    }
  });

  it('small and large dictionaries reject embedded short words and retain standalone hits', () => {
    for (const padding of [0, 350]) {
      const matcher = new AhoCorasickMatcher();
      matcher.insertBatch(['Go', 'C', 'R', ...makeDict(padding)]);
      expect(matcher.searchUnique('Google engineer visited Cat Car today.')).toEqual([]);
      expect(new Set(matcher.searchUnique('Go, C and R. Google Cat.'))).toEqual(new Set(['Go', 'C', 'R']));
    }
  });
});
