/**
 * 招聘页面智能识别系统 (三层保底)
 *
 * 第一层：已知域名白名单 (快速命中)
 * 第二层：URL 路径特征 + 页面内容智能分析 (覆盖未知站点)
 * 第三层：用户自定义白名单 (用户完全可控)
 */

// ==========================================
// 第一层：已知招聘域名关键词
// ==========================================
const KNOWN_DOMAINS: string[] = [
  // 国内 ATS
  'mokahr.com', 'moka.com', 'beisen.com', 'italent.cn',
  'dayee.com', 'wintalent.cn', 'nowcoder.com',
  // 国内大厂
  'join.qq.com', 'careers.tencent.com',
  'talent.alibaba.com', 'talent.taotao.com', 'job.alibaba.com', 'campus.alibaba.com',
  'zhaopin.meituan.com',
  'jobs.bytedance.com', 'jobs.feishu.cn', 'hire.feishu.cn',
  'career.huawei.com', 'campus.163.com', 'hr.163.com',
  'campus.jd.com', 'zhiye.baidu.com', 'talent.baidu.com',
  'careers.pinduoduo.com', 'campus.didi.com', 'careers.ctrip.com',
  'hr.xiaomi.com', 'campus.bilibili.com',
  'jobs.douyin.com',
  // 综合招聘平台
  'zhaopin.com', 'liepin.com', '51job.com', 'lagou.com',
  'zhipin.com', 'shixiseng.com',
  // 海外 ATS
  'myworkdayjobs.com', 'workday.com', 'greenhouse.io', 'lever.co',
  'icims.com', 'smartrecruiters.com', 'successfactors.com', 'taleo.net',
  'linkedin.com/jobs', 'indeed.com', 'glassdoor.com',
  // 国企 / 银行 / 官方求职平台
  'hotjob.cn', 'chinahr.com', 'yonyou.com', 'iguopin.com', '24365.cn', 'ncss.cn',
  'sgcc.com.cn', 'zhaopin.sgcc.com.cn',
  'cmbchina.com', 'icbc.com.cn', 'abchina.com', 'boc.cn', 'ccb.com', 'bankcomm.com', 'psbc.com',
  'job.10086.cn', 'chinatelecom.com.cn', 'chinaunicom.com',
];

const IGNORED_DOMAINS: string[] = [
  'chatgpt.com', 'openai.com', 'claude.ai', 'deepseek.com',
  'google.com', 'baidu.com', 'bing.com',
  'github.com', 'gitlab.com', 'gitee.com',
  'youtube.com', 'zhihu.com',
  'taobao.com', 'tmall.com',
  'weibo.com', 'twitter.com', 'x.com', 'facebook.com',
  'stackoverflow.com', 'csdn.net', 'juejin.cn', 'cnblogs.com'
];

/**
 * 快速排除常见非求职通用网站 (如 ChatGPT, 搜索引擎, 社区等)，杜绝侵入非求职页面
 */
export function isIgnoredDomain(url: string = window.location.href): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // 如果属于已知企业招聘子域名 (如 campus.jd.com, talent.baidu.com 等)，则不排除
  for (const kd of KNOWN_DOMAINS) {
    if (hostname.includes(kd) || lowerUrl.includes(kd)) {
      return false;
    }
  }

  for (const ign of IGNORED_DOMAINS) {
    if (hostname === ign || hostname.endsWith('.' + ign)) {
      return true;
    }
  }

  return false;
}

// ==========================================
// 第二层：URL 路径特征
// ==========================================
const PATH_SIGNALS: string[] = [
  '/career', '/careers', '/jobs', '/job/', '/recruit', '/campus',
  '/apply', '/application', '/hire', '/hiring', '/talent',
  '/zhaopin', '/resume', '/join',
];

// ==========================================
// 第二层增强：页面内容智能分析
// ==========================================

/**
 * 分析页面 DOM 内容，判断是否为招聘 / 网申表单页面
 * 核心逻辑：表单密度 + 招聘关键词共现
 */
function analyzePageContent(): boolean {
  // 1. 检查表单元素数量 (招聘网申页通常有 5+ 个输入框)
  const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  const visibleInputs = Array.from(inputs).filter((el) => {
    const style = window.getComputedStyle(el as HTMLElement);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  if (visibleInputs.length < 3) return false; // 输入框太少，不太像网申页

  // 2. 检查页面文本是否包含招聘相关关键词 (需要多个共现才认定)
  const bodyText = (document.body?.innerText || '').toLowerCase();
  const recruitKeywords = [
    '简历', '求职', '应聘', '投递', '网申', '校招', '社招',
    '岗位', '职位', '学历', '专业', '毕业', '学校', '院校',
    '工作经历', '实习经历', '项目经历', '教育经历', '教育背景',
    '姓名', '手机号', '身份证', '政治面貌', '期望薪资', '自我评价',
    'resume', 'apply', 'application', 'position', 'career',
    'education', 'experience', 'qualification', 'candidate',
  ];

  let hitCount = 0;
  for (const kw of recruitKeywords) {
    if (bodyText.includes(kw)) {
      hitCount++;
    }
  }

  // 3. 同时满足：页面有较多输入框 + 招聘关键词命中 3 个以上 => 大概率是网申页
  return hitCount >= 3;
}

/**
 * 检查已知的 ATS 组件库 DOM 特征
 */
function hasATSComponentSignals(): boolean {
  const selectors = [
    '.moka-application-form', '[class*="moka-"]',
    '[class*="beisen"]', '.italent-form', '#resumeFrame',
    '[class*="dayee"]',
    '.semi-form', '[class*="semi-"]',
    '#application_form', '.application-form', '#lever-form',
    '[data-automation-id]', // Workday
    '.nc-form', '.job-apply-box',
  ];

  for (const sel of selectors) {
    try {
      if (document.querySelector(sel)) return true;
    } catch (e) {}
  }

  return false;
}

// ==========================================
// 第三层：用户自定义白名单 (存储在 chrome.storage.local)
// ==========================================
const STORAGE_KEY_CUSTOM_DOMAINS = 'openjobfill_custom_domains';

async function getCustomDomains(): Promise<string[]> {
  if (typeof chrome !== 'undefined' && !!chrome.runtime?.id && chrome.storage?.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STORAGE_KEY_CUSTOM_DOMAINS], (result) => {
          if (chrome.runtime?.lastError) {
            resolve([]);
            return;
          }
          resolve(result?.[STORAGE_KEY_CUSTOM_DOMAINS] || []);
        });
      } catch {
        resolve([]);
      }
    });
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY_CUSTOM_DOMAINS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCustomDomains(domains: string[]): Promise<void> {
  if (typeof chrome !== 'undefined' && !!chrome.runtime?.id && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      try {
        chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_DOMAINS]: domains }, () => resolve());
      } catch {
        localStorage.setItem(STORAGE_KEY_CUSTOM_DOMAINS, JSON.stringify(domains));
        resolve();
      }
    });
  } else {
    localStorage.setItem(STORAGE_KEY_CUSTOM_DOMAINS, JSON.stringify(domains));
  }
}

// ==========================================
// 综合判断入口 (带 URL 短路缓存优化)
// ==========================================

let lastEvaluatedUrl = '';
let lastEvaluatedResult = false;
let isPermanentDomainMatch = false;

/**
 * 判断当前页面是否为招聘/网申相关页面 (三层保底 + 智能缓存)
 */
export async function isRecruitmentPage(url: string = window.location.href): Promise<boolean> {
  const lowerUrl = url.toLowerCase();

  // 如果 URL 未变且已经命中强规则 (已知域名或自定义域名)，直接返回命中缓存
  if (url === lastEvaluatedUrl && isPermanentDomainMatch) {
    return true;
  }

  // 第一层：已知域名
  for (const domain of KNOWN_DOMAINS) {
    if (lowerUrl.includes(domain.toLowerCase())) {
      lastEvaluatedUrl = url;
      lastEvaluatedResult = true;
      isPermanentDomainMatch = true;
      return true;
    }
  }

  // 第一层补充：用户自定义域名
  try {
    const customDomains = await getCustomDomains();
    for (const domain of customDomains) {
      if (domain && lowerUrl.includes(domain.toLowerCase())) {
        lastEvaluatedUrl = url;
        lastEvaluatedResult = true;
        isPermanentDomainMatch = true;
        return true;
      }
    }
  } catch {}

  // 第二层：URL 路径特征
  for (const signal of PATH_SIGNALS) {
    if (lowerUrl.includes(signal)) {
      lastEvaluatedUrl = url;
      lastEvaluatedResult = true;
      isPermanentDomainMatch = false;
      return true;
    }
  }

  // 第二层增强：ATS 组件 DOM 特征
  if (hasATSComponentSignals()) {
    lastEvaluatedUrl = url;
    lastEvaluatedResult = true;
    isPermanentDomainMatch = false;
    return true;
  }

  // 第二层增强：页面内容智能分析 (表单密度 + 关键词)
  if (analyzePageContent()) {
    lastEvaluatedUrl = url;
    lastEvaluatedResult = true;
    isPermanentDomainMatch = false;
    return true;
  }

  lastEvaluatedUrl = url;
  lastEvaluatedResult = false;
  isPermanentDomainMatch = false;
  return false;
}

/**
 * 周期性观测页面变化 (带热重载自毁机制，彻底杜绝 context invalidated 报错)
 */
export function observeRecruitmentPage(
  onDetected: () => void,
  onLeft?: () => void,
  intervalMs = 2500
): () => void {
  let wasRecruiting = false;
  let timer: any = null;

  const check = async () => {
    // 扩展上下文失效检测：如果扩展在管理页被重新加载，立即自毁当前标签页的旧定时器
    if (typeof chrome !== 'undefined' && !chrome.runtime?.id) {
      if (timer) clearInterval(timer);
      return;
    }

    try {
      const isRecruiting = await isRecruitmentPage();
      if (isRecruiting && !wasRecruiting) {
        onDetected();
      } else if (!isRecruiting && wasRecruiting && onLeft) {
        onLeft();
      }
      wasRecruiting = isRecruiting;
    } catch {
      if (timer) clearInterval(timer);
    }
  };

  timer = setInterval(check, intervalMs);
  check();

  return () => {
    if (timer) clearInterval(timer);
  };
}
