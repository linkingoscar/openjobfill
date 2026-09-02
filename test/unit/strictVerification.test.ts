import { describe, expect, it } from 'vitest';
import { verifyTypedValue } from '../../src/core/pipeline/strictVerification';

describe('strict verification', () => {
  it('rejects substring false positives for numbers and short text', () => {
    expect(verifyTypedValue('10', '1', 'NUMBER').status).toBe('MISMATCH');
    expect(verifyTypedValue('女', '男', 'TEXT').status).toBe('MISMATCH');
    expect(verifyTypedValue('中共预备党员', '中共党员', 'TEXT').status).toBe('MISMATCH');
  });

  it('normalizes phone, email and id before exact comparison', () => {
    expect(verifyTypedValue('+86 138-0013-8000', '13800138000', 'PHONE').status).toBe('VERIFIED');
    expect(verifyTypedValue('USER@EXAMPLE.COM ', 'user@example.com', 'EMAIL').status).toBe('VERIFIED');
    expect(verifyTypedValue('ab 123', 'AB123', 'ID').status).toBe('VERIFIED');
  });

  it('marks reduced date precision as partial instead of success', () => {
    expect(verifyTypedValue('2026-09', '2026-09-03', 'DATE').status).toBe('PARTIALLY_VERIFIED');
    expect(verifyTypedValue('2026-08', '2026-09', 'DATE').status).toBe('MISMATCH');
  });

  it('verifies both ends of a date range', () => {
    expect(verifyTypedValue(
      { startDate: '2025-01', endDate: '至今' },
      { startDate: '2025-01', endDate: '至今' },
      'DATE_RANGE',
    ).status).toBe('VERIFIED');

    expect(verifyTypedValue(
      { startDate: '2025-01', endDate: '2026-01' },
      { startDate: '2025-01', endDate: '至今' },
      'DATE_RANGE',
    ).status).toBe('MISMATCH');
  });

  it('never reports unreadable state as verified', () => {
    expect(verifyTypedValue(undefined, 'value', 'TEXT').status).toBe('UNREADABLE');
  });
});
