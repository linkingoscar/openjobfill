export interface PageJobSnapshot {
  companyName: string;
  jobTitle: string;
  salary?: string;
  city?: string;
  description?: string;
  jobUrl: string;
}

const APPLICATION_SUCCESS_PATTERNS = [
  /投递成功/,
  /申请成功/,
  /提交成功/,
  /简历已(?:成功)?投递/,
  /感谢您(?:的)?申请/,
  /thank\s+you\s+for\s+applying/i,
  /application\s+(?:has\s+been\s+)?submitted/i,
  /your\s+application\s+was\s+received/i,
];

/** 只依据可见成功文案或明确的结果页路径判断申请是否已经提交。 */
export function isApplicationSuccessPage(
  doc: Document = document,
  location: Location = window.location,
): boolean {
  const route = `${location.pathname} ${location.hash}`;
  if (/(?:application|apply|candidate|job)[-_/]?(?:success|submitted|complete|confirmation)/i.test(route)) return true;
  if (!doc?.body) return false;
  const visibleText = cleanText((doc.body as HTMLElement | null)?.innerText || doc.body?.textContent, 12000);
  return APPLICATION_SUCCESS_PATTERNS.some((pattern) => pattern.test(visibleText));
}

function cleanText(value: string | null | undefined, maxLength: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function firstText(doc: Document, selectors: string, maxLength: number): string {
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>(selectors))) {
    const text = cleanText(element.textContent, maxLength);
    if (text.length >= 2 && text.length <= maxLength) return text;
  }
  return '';
}

function inferCompanyFromTitle(title: string, hostname: string): string {
  const knownHosts: Array<[RegExp, string]> = [
    [/bytedance|zijie/i, '字节跳动'],
    [/meituan/i, '美团'],
    [/tencent|join\.qq/i, '腾讯'],
    [/alibaba|taotian|aliyun/i, '阿里巴巴'],
  ];
  const known = knownHosts.find(([pattern]) => pattern.test(hostname));
  if (known) return known[1];

  const parts = title.split(/[-_—|–]/).map((part) => cleanText(part, 40)).filter(Boolean);
  const company = parts.find((part, index) => index > 0 && !/招聘|岗位|职位|job|career/i.test(part));
  return company || hostname.replace(/^www\./, '') || '目标企业';
}

/** 从当前岗位页提取投递看板草稿；只读取公开页面文本，不读取简历表单值。 */
export function extractPageJobSnapshot(doc: Document = document, location: Location = window.location): PageJobSnapshot {
  const title = cleanText(doc.title, 160);
  const companyMeta = cleanText(
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
      || doc.querySelector('meta[name="author"]')?.getAttribute('content'),
    60,
  );
  const companyElement = firstText(doc, '.company-name, .comp-name, .corp-name, [class*="company-title"], [class*="company_name"]', 60);
  const jobElement = firstText(doc, 'h1, .job-title, .job-name, .position-name, .position-title, [class*="job-name"], [class*="job_name"]', 80);
  const salaryElement = firstText(doc, '.salary, .job-salary, .pay-detail, [class*="salary"], [class*="wage"]', 40);
  const city = firstText(doc, '.job-city, .work-city, .location, [class*="job-location"], [class*="work-city"]', 40);
  const description = firstText(doc, '.job-detail, .job-description, .job-duty, .post-description, [class*="job-detail"], [class*="job-description"]', 2000);
  const bodyText = cleanText((doc.body as HTMLElement | null)?.innerText || doc.body?.textContent, 4000);
  const salaryMatch = bodyText.match(/(?:\d{1,3}(?:\.\d+)?\s*[kK千]-\d{1,3}(?:\.\d+)?\s*[kK千](?:[·x×]\s*\d{1,2}薪)?|\d{4,6}\s*[-~至]\s*\d{4,6}\s*元)/);
  const titleParts = title.split(/[-_—|–]/).map((part) => cleanText(part, 80)).filter(Boolean);

  return {
    companyName: companyMeta || companyElement || inferCompanyFromTitle(title, location.hostname),
    jobTitle: jobElement || titleParts[0] || '网申岗位',
    salary: salaryElement || salaryMatch?.[0],
    city: city || undefined,
    description: description || undefined,
    jobUrl: location.href,
  };
}
