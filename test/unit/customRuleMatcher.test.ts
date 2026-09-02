import { beforeEach, describe, expect, it } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { resolveCustomRuleMappings } from '@/core/pipeline/customRuleMatcher';
import { EMPTY_RESUME } from '@/core/storage/defaultData';
import type { CustomFieldMapping } from '@/types/rule';

describe('自定义规则证据匹配', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('CSS class 变化后应使用 locator 证据恢复映射', () => {
    document.body.innerHTML = '<form><label for="candidate">姓名</label><input id="candidate" class="old-hook" name="candidateName"></form>';
    const original = pageAnalyzer.analyzePage(document)[0];
    const mapping: CustomFieldMapping = {
      id: 'learned-name',
      selector: '.old-hook',
      resumeKey: 'basics.name',
      fingerprint: original.fingerprint,
      locator: original.locator,
      status: 'ACTIVE',
    };

    document.body.innerHTML = '<form><label for="candidate-new">姓名</label><input id="candidate-new" class="new-hook" name="candidateName"></form>';
    const fields = pageAnalyzer.analyzePage(document);
    const resume = structuredClone(EMPTY_RESUME);
    resume.basics.name = '张三';
    const plan = planGenerator.generatePlan(fields, resume, null, [mapping]);

    expect(plan.items[0]).toMatchObject({ action: 'FILL', semanticKey: 'basics.name', source: 'user_rule' });
    expect(plan.items[0].reason).toContain('locator');
    expect(plan.diagnostics?.customRules.methodCounts.locator).toBe(1);
  });

  it('选择器被复用到另一字段且与指纹冲突时应标记 STALE 并拒绝套用', () => {
    document.body.innerHTML = `
      <form>
        <label for="name">姓名</label><input id="name" name="name">
        <label for="phone">手机</label><input id="phone" name="phone">
      </form>`;
    const originalFields = pageAnalyzer.analyzePage(document);
    const originalName = originalFields.find((field) => field.name === 'name')!;
    const mapping: CustomFieldMapping = {
      id: 'conflicted-name',
      selector: '.recycled-hook',
      resumeKey: 'basics.name',
      fingerprint: originalName.fingerprint,
      locator: originalName.locator,
      status: 'ACTIVE',
    };
    document.querySelector<HTMLInputElement>('input[name="phone"]')!.className = 'recycled-hook';

    const currentFields = pageAnalyzer.analyzePage(document);
    const resolution = resolveCustomRuleMappings(currentFields, [mapping]);
    expect(resolution.matches.size).toBe(0);
    expect(resolution.staleMappingIds).toEqual(['conflicted-name']);
  });
});
