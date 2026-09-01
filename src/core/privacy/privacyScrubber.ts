/**
 * 递归隐私清洗器。
 *
 * 用于任何可能被导出、持久化为诊断数据或发送给可选 AI 服务的结构。
 * 保留对象形状，但隐藏手机号、邮箱、身份证、银行卡及明确的敏感键值。
 */

const SENSITIVE_KEYS = new Set([
  'idcardnumber',
  'phone',
  'mobile',
  'email',
  'emergencycontactphone',
  'emergencycontactname',
  'witnessphone',
  'witnessname',
  'bankaccount',
  'bankcard',
  'apikey',
  'authorization',
]);

export function scrubSensitiveText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d(?:[- ]?\d){8}(?!\d)/g, '[PHONE_REDACTED]')
    .replace(/(?<!\d)[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, '[ID_REDACTED]')
    .replace(/(?<!\d)(?:\d{4}[ -]?){3}\d{4}(?!\d)/g, '[BANK_CARD_REDACTED]');
}

function maskKnownSensitiveValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value;
  const normalizedKey = key.replace(/[_-]/g, '').toLowerCase();
  if (!SENSITIVE_KEYS.has(normalizedKey)) return undefined;

  if (typeof value !== 'string') return '[REDACTED]';
  if (normalizedKey.includes('email') || normalizedKey.includes('phone') || normalizedKey === 'mobile' || normalizedKey === 'idcardnumber') {
    const scrubbed = scrubSensitiveText(value);
    return scrubbed === value ? '[REDACTED]' : scrubbed;
  }
  return '[REDACTED]';
}

/** 深拷贝并递归清洗数据；循环引用会被替换为 `[CIRCULAR]`。 */
export function scrubSensitiveData<T>(data: T): T {
  const seen = new WeakSet<object>();

  const visit = (value: unknown, key = ''): unknown => {
    const masked = maskKnownSensitiveValue(key, value);
    if (masked !== undefined) return masked;
    if (typeof value === 'string') return scrubSensitiveText(value);
    if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => visit(item));
    }

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = visit(entryValue, entryKey);
    }
    return result;
  };

  return visit(data) as T;
}
