import { describe, it, expect, beforeEach } from 'vitest';
import { matchElementToResumeField, calculateTextMatchScore } from '@/core/matcher/heuristic';
import type { CustomQABankItem } from '@/types/resume';

describe('Heuristic Matcher (启发式智能表单与多段经历探测引擎)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('calculateTextMatchScore (文本匹配加权打分)', () => {
    it('完全相同或去标点后相同应为 1.0', () => {
      expect(calculateTextMatchScore('真实姓名 *', ['姓名', '真实姓名'])).toBe(1.0);
      expect(calculateTextMatchScore('【手机号码】:', ['手机号码'])).toBe(1.0);
    });

    it('前缀/后缀匹配应为 0.9', () => {
      expect(calculateTextMatchScore('请输入电子邮箱', ['电子邮箱'])).toBe(0.9);
      expect(calculateTextMatchScore('身份证号码(18位)', ['身份证号码'])).toBe(0.9);
    });

    it('包含关系应为 0.75', () => {
      expect(calculateTextMatchScore('您的常用手机联系方式', ['手机'])).toBe(0.75);
    });
  });

  describe('matchElementToResumeField (表单元素字段嗅探)', () => {
    it('应该能基于 label 关联精准识别基础字段', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="form-row">
          <label for="name_input">申请人真实姓名 *</label>
          <input id="name_input" type="text" />
        </div>
      `;
      document.body.appendChild(container);

      const input = container.querySelector('input')!;
      const match = matchElementToResumeField(input);

      expect(match).not.toBeNull();
      expect(match?.resumeKey).toBe('basics.name');
      expect(match?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('已填入内容的非空输入框应该被跳过 (避免覆盖已有内容)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="form-row">
          <label>手机号码</label>
          <input type="text" value="13800138000" />
        </div>
      `;
      document.body.appendChild(container);

      const input = container.querySelector('input')!;
      const match = matchElementToResumeField(input);

      expect(match).toBeNull();
    });

    it('多段经历卡片应能正确感知 Index 序号并映射为 educations.1.* 等', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div id="education-container">
          <div class="section-card education-item" data-section="education">
            <label>就读大学 (第1段)</label>
            <input id="edu_0" type="text" />
          </div>
          <div class="section-card education-item" data-section="education">
            <label>就读大学 (第2段)</label>
            <input id="edu_1" type="text" />
          </div>
        </div>
      `;
      document.body.appendChild(container);

      const input0 = container.querySelector('#edu_0') as HTMLInputElement;
      const input1 = container.querySelector('#edu_1') as HTMLInputElement;

      const match0 = matchElementToResumeField(input0);
      const match1 = matchElementToResumeField(input1);

      expect(match0).not.toBeNull();
      expect(match0?.resumeKey).toBe('educations.0.schoolName');

      expect(match1).not.toBeNull();
      expect(match1?.resumeKey).toBe('educations.1.schoolName');
    });

    it('问答库 (Q&A Bank) 应该在 textarea 开放问题中享有最高优先级', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="form-item">
          <label>谈谈您对未来 3-5 年的职业规划与技术抱负？</label>
          <textarea id="qa_textarea"></textarea>
        </div>
      `;
      document.body.appendChild(container);

      const qaBank: CustomQABankItem[] = [
        {
          id: 'qa-101',
          keyword: '职业规划, 未来规划, 职业目标',
          answer: '短期深耕前端工程化与性能优化，中长期成长为全栈与架构专家。',
        },
      ];

      const textarea = container.querySelector('#qa_textarea') as HTMLTextAreaElement;
      const match = matchElementToResumeField(textarea, new Set(), qaBank);

      expect(match).not.toBeNull();
      expect(match?.resumeKey).toBe('qaBank.qa-101');
      expect(match?.qaAnswer).toBe('短期深耕前端工程化与性能优化，中长期成长为全栈与架构专家。');
    });
  });
});
