import { describe, expect, it } from 'vitest';
import { scrubSensitiveData, scrubSensitiveText } from '../../src/core/privacy/privacyScrubber';

describe('privacyScrubber', () => {
  it('清洗自由文本且保留周围标点', () => {
    const result = scrubSensitiveText('电话：13800138000，邮箱：demo@example.com。');
    expect(result).toBe('电话：[PHONE_REDACTED]，邮箱：[EMAIL_REDACTED]。');
  });

  it('递归清洗敏感键、数组与长文本', () => {
    const source = {
      basics: { phone: '13800138000', email: 'demo@example.com', name: '张三' },
      notes: ['身份证 11010519900101123X', { apiKey: 'secret-key' }],
    };

    const result = scrubSensitiveData(source);
    expect(result.basics.phone).toBe('[PHONE_REDACTED]');
    expect(result.basics.email).toBe('[EMAIL_REDACTED]');
    expect(result.basics.name).toBe('张三');
    expect(result.notes[0]).toBe('身份证 [ID_REDACTED]');
    expect(result.notes[1].apiKey).toBe('[REDACTED]');
    expect(source.basics.phone).toBe('13800138000');
  });
});
