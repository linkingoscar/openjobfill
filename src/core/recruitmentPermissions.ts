/**
 * Built-in origins that may run the lightweight recruitment detector without a
 * per-site prompt. Unknown sites are intentionally excluded: they use activeTab
 * after a user gesture or an explicitly granted custom-domain permission.
 */
export const BUILTIN_RECRUITMENT_HOSTS = [
  'mokahr.com', 'moka.com', 'beisen.com', 'italent.cn', 'dayee.com', 'wintalent.cn', 'nowcoder.com',
  'join.qq.com', 'careers.tencent.com', 'talent.alibaba.com', 'talent.taotao.com', 'job.alibaba.com', 'campus.alibaba.com',
  'zhaopin.meituan.com', 'jobs.bytedance.com', 'jobs.feishu.cn', 'hire.feishu.cn', 'career.huawei.com', 'campus.163.com',
  'hr.163.com', 'campus.jd.com', 'zhiye.baidu.com', 'talent.baidu.com', 'careers.pinduoduo.com', 'campus.didi.com',
  'careers.ctrip.com', 'hr.xiaomi.com', 'campus.bilibili.com', 'jobs.douyin.com',
  'zhaopin.com', 'liepin.com', '51job.com', 'lagou.com', 'zhipin.com', 'shixiseng.com',
  'myworkdayjobs.com', 'workday.com', 'greenhouse.io', 'lever.co', 'icims.com', 'smartrecruiters.com',
  'successfactors.com', 'taleo.net', 'linkedin.com', 'indeed.com', 'glassdoor.com',
  'hotjob.cn', 'chinahr.com', 'yonyou.com', 'iguopin.com', '24365.cn', 'ncss.cn', 'sgcc.com.cn',
  'zhaopin.sgcc.com.cn', 'cmbchina.com', 'icbc.com.cn', 'abchina.com', 'boc.cn', 'ccb.com', 'bankcomm.com',
  'psbc.com', 'job.10086.cn', 'chinatelecom.com.cn', 'chinaunicom.com',
] as const;

export const BUILTIN_RECRUITMENT_MATCHES: string[] = [
  // Localhost is retained for deterministic extension smoke tests and local fixtures.
  'http://localhost/*',
  'http://127.0.0.1/*',
  ...Array.from(new Set(BUILTIN_RECRUITMENT_HOSTS.map((host) => `*://*.${host}/*`))),
];

export function normalizeCustomDomain(value: string): string {
  return value.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

export function customDomainPermissionPattern(value: string): string | null {
  const domain = normalizeCustomDomain(value);
  if (!domain || !/^[a-z0-9.-]+(?::\d+)?$/.test(domain) || domain.includes('..')) return null;
  // Chrome match patterns do not allow a wildcard subdomain together with a port.
  if (domain.includes(':')) return `*://${domain}/*`;
  return `*://*.${domain}/*`;
}

export function permissionPatternForBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}
