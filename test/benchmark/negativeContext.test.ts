import { describe, it, expect, beforeEach } from 'vitest';
import { matchElementToResumeField } from '@/core/matcher/heuristic';

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

  it('在所有排斥上下文与负样本场景中，误填率 (False Positive Rate) 应严格为 0%', () => {
    let totalNegativeTests = ADVERSARIAL_NEGATIVE_CASES.length;
    let falsePositiveCount = 0;

    for (const testCase of ADVERSARIAL_NEGATIVE_CASES) {
      const container = document.createElement('div');
      container.innerHTML = testCase.html;
      document.body.appendChild(container);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();

      const match = matchElementToResumeField(input);

      if (match && match.resumeKey === testCase.prohibitedKey) {
        falsePositiveCount++;
        console.error(`🚨 [对抗测试失败] ${testCase.desc} 被错误识别为 ${match.resumeKey}`);
      }

      document.body.removeChild(container);
    }

    const falsePositiveRate = falsePositiveCount / totalNegativeTests;
    console.log(`\n🛡️ 负样本上下文拦截测试结果: 误填率 ${(falsePositiveRate * 100).toFixed(2)}% (预期 0%)`);

    expect(falsePositiveCount).toBe(0);
    expect(falsePositiveRate).toBe(0);
  });
});
