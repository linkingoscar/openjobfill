export interface PageJobSnapshot {
  companyName: string;
  jobTitle: string;
  salary?: string;
  city?: string;
  description?: string;
  jobUrl: string;
  fieldSources?: Partial<Record<'companyName' | 'jobTitle' | 'salary' | 'city' | 'description', 'structured_data' | 'meta' | 'dom' | 'heuristic'>>;
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

interface StructuredJobPosting {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: Array<{ address?: Record<string, unknown> }> | { address?: Record<string, unknown> };
  baseSalary?: unknown;
}

function stripMarkup(value: unknown, maxLength: number): string {
  return cleanText(String(value || '').replace(/<[^>]+>/g, ' '), maxLength);
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...flattenJsonLd(record['@graph'])];
}

function readJobPosting(doc: Document): StructuredJobPosting | null {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')).slice(0, 12);
  for (const script of scripts) {
    const raw = script.textContent?.slice(0, 80_000);
    if (!raw) continue;
    try {
      const item = flattenJsonLd(JSON.parse(raw)).find((candidate) => {
        const type = candidate['@type'];
        return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
      });
      if (item) return item as StructuredJobPosting;
    } catch {
      // Ignore malformed third-party structured data and continue with visible DOM evidence.
    }
  }
  return null;
}

function structuredLocation(posting: StructuredJobPosting | null): string {
  if (!posting?.jobLocation) return '';
  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
  for (const location of locations) {
    const address = location?.address;
    if (!address || typeof address !== 'object') continue;
    const text = cleanText([address.addressRegion, address.addressLocality].filter(Boolean).join(' '), 80);
    if (text) return text;
  }
  return '';
}

function structuredSalary(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return cleanText(String(value), 100);
  if (typeof value !== 'object') return '';
  const raw = value as Record<string, unknown>;
  const amount = raw.value && typeof raw.value === 'object' ? raw.value as Record<string, unknown> : raw;
  const min = amount.minValue;
  const max = amount.maxValue;
  const unit = cleanText(String(amount.unitText || raw.currency || ''), 20);
  return cleanText([min, max].filter((entry) => entry !== undefined).join('-') + (unit ? ` ${unit}` : ''), 100);
}

/** 从当前岗位页提取投递看板草稿；只读取公开页面文本，不读取简历表单值。 */
export function extractPageJobSnapshot(doc: Document = document, location: Location = window.location): PageJobSnapshot {
  const title = cleanText(doc.title, 160);
  const structured = readJobPosting(doc);
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
  const structuredCompany = typeof structured?.hiringOrganization === 'string'
    ? cleanText(structured.hiringOrganization, 60)
    : cleanText(structured?.hiringOrganization?.name, 60);
  const structuredTitle = cleanText(structured?.title, 80);
  const structuredDescription = stripMarkup(structured?.description, 2_000);
  const structuredCity = structuredLocation(structured);
  const structuredPay = structuredSalary(structured?.baseSalary);

  const companyName = structuredCompany || companyMeta || companyElement || inferCompanyFromTitle(title, location.hostname);
  const jobTitle = structuredTitle || jobElement || titleParts[0] || '网申岗位';
  const finalSalary = structuredPay || salaryElement || salaryMatch?.[0];
  const finalCity = structuredCity || city || undefined;
  const finalDescription = structuredDescription || description || undefined;

  return {
    companyName,
    jobTitle,
    salary: finalSalary,
    city: finalCity,
    description: finalDescription,
    jobUrl: location.href,
    fieldSources: {
      companyName: structuredCompany ? 'structured_data' : companyMeta ? 'meta' : companyElement ? 'dom' : 'heuristic',
      jobTitle: structuredTitle ? 'structured_data' : jobElement ? 'dom' : 'heuristic',
      ...(finalSalary ? { salary: structuredPay ? 'structured_data' as const : salaryElement ? 'dom' as const : 'heuristic' as const } : {}),
      ...(finalCity ? { city: structuredCity ? 'structured_data' as const : 'dom' as const } : {}),
      ...(finalDescription ? { description: structuredDescription ? 'structured_data' as const : 'dom' as const } : {}),
    },
  };
}
