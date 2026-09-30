import { describe, it, expect, beforeEach } from 'vitest';
import { calculateTextMatchScore } from '@/core/matcher/heuristic';
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

});
