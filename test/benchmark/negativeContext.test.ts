import { describe, it, expect, beforeEach } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { DEMO_RESUME } from '@/core/storage/defaultData';

describe('Negative Context Anti-Collision (负样本上下文消歧对抗评测)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const ADVERSARIAL_NEGATIVE_CASES = [
    {
      desc: '紧急联系人姓名 (严禁填入本人姓名)',
      html: `
        <div class="form-item">
          <label>紧急联系人姓名</label>
          <input type="text" name="emergency_contact_name" />
        </div>
      `,
      prohibitedKey: 'basics.name',
    },
    {
      desc: '紧急联系人联系电话 (严禁填入本人手机号)',
      html: `
        <div class="form-item">
          <label>紧急联系人电话 *</label>
          <input type="tel" name="emergency_phone" />
        </div>
      `,
      prohibitedKey: 'basics.phone',
    },
    {
      desc: '推荐人 / 证明人姓名 (严禁填入本人姓名)',
      html: `
        <div class="form-group">
          <label>推荐人姓名 / Reference Name</label>
          <input type="text" name="ref_name" />
        </div>
      `,
      prohibitedKey: 'basics.name',
    },
    {
      desc: '证明人电子邮箱 (严禁填入本人邮箱)',
      html: `
        <div class="form-group">
          <label>证明人邮箱</label>
          <input type="email" name="reference_email" />
        </div>
      `,
      prohibitedKey: 'basics.email',
    },
    {
      desc: '父亲 / 母亲姓名 (严禁填入本人姓名)',
      html: `
        <div class="family-item">
          <label>父亲姓名</label>
          <input type="text" name="father_name" />
        </div>
      `,
      prohibitedKey: 'basics.name',
    },
    {
      desc: '家属联系方式 (严禁填入本人手机号)',
      html: `
        <div class="form-item">
          <label>家属联系电话</label>
          <input type="tel" name="family_phone" />
        </div>
      `,
      prohibitedKey: 'basics.phone',
    },
  ];

  it('current planner blocks every prohibited candidate mapping in the six negative fixtures', () => {
    for (const testCase of ADVERSARIAL_NEGATIVE_CASES) {
      document.body.innerHTML = testCase.html;
      const fields = pageAnalyzer.analyzePage(document);
      expect(fields, testCase.desc).toHaveLength(1);
      const plan = planGenerator.generatePlan(fields, DEMO_RESUME);
      expect(plan.items.some(item => item.action === 'FILL' && item.semanticKey === testCase.prohibitedKey), testCase.desc).toBe(false);
    }
  });
});
