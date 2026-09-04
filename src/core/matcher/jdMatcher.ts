import type { StandardResume } from '../../types/resume';

export interface JDAnalysisResult {
  jobTitle: string;
  pageUrl: string;
  matchScore: number | null; // 关键词覆盖率；null 表示没有可用依据
  matchedKeywords: string[];
  missingKeywords: string[];
  allDetectedJDKeywords: string[];
  diagnosticTips: string[];
}

// 常见技术栈与岗位核心关键词词典
const TECH_KEYWORD_DICTIONARY = [
  // 前端与全栈
  'Vue', 'Vue 3', 'Vue 2', 'React', 'React Native', 'Angular', 'TypeScript', 'JavaScript', 'ES6', 
  'HTML5', 'CSS3', 'Tailwind', 'TailwindCSS', 'Sass', 'Less', 'Webpack', 'Vite', 'Rollup', 
  'Node.js', 'Next.js', 'Nuxt.js', 'Electron', 'Uni-app', 'Taro', '微信小程序', '小程序', 
  'Canvas', 'WebGL', 'Three.js', 'WebAssembly', '微前端', 'qiankun', '性能优化', '前端工程化',
  
  // 后端与分布式
  'Java', 'Spring', 'Spring Boot', 'Spring Cloud', 'MyBatis', 'Go', 'Golang', 'Gin', 'gRPC', 
  'Python', 'Django', 'Flask', 'FastAPI', 'C++', 'C#', '.NET', 'Rust', 'PHP', 
  'MySQL', 'PostgreSQL', 'Oracle', 'Redis', 'MongoDB', 'Elasticsearch', 'Kafka', 
  'RabbitMQ', 'RocketMQ', '微服务', '分布式', '高并发', '高可用', 'JVM', '多线程',
  
  // 云原生与运维
  'Linux', 'Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Jenkins', 'Nginx', 'Git', 'GitHub',
  
  // AI、大数据与算法
  '机器学习', '深度学习', 'PyTorch', 'TensorFlow', 'LLM', '大模型', 'Prompt', 'RAG', 
  'LangChain', 'NLP', '计算机视觉', 'OpenCV', 'Pandas', 'NumPy', 'Spark', 'Flink', 'Hadoop',
  
  // 综合素养与证书
  '英语六级', 'CET-6', '英语四级', 'CET-4', '雅思', '托福', '软考', '沟通能力', '团队协作', '敏捷开发'
];

/**
 * 从网页提取职位标题和岗位描述文本
 */
export function extractJDFromPage(): { jobTitle: string; jdText: string } {
  // 1. 尝试提取岗位标题
  const titleSelectors = [
    'h1',
    '.job-name',
    '.position-name',
    '.job-title',
    '.position-title',
    '[class*="job-title"]',
    '[class*="position-title"]',
    '[class*="jobName"]',
    '[class*="positionName"]',
    'h2',
    'title'
  ];

  let jobTitle = '';
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && text.length > 2 && text.length < 50 && !text.includes('登录') && !text.includes('注册')) {
      jobTitle = text.replace(/[-_|].*$/, '').trim();
      break;
    }
  }
  if (!jobTitle) {
    jobTitle = document.title.replace(/[-_|].*$/, '').trim() || '当前招聘岗位';
  }

  // 2. 尝试提取岗位描述主体
  const descSelectors = [
    '.job-detail',
    '.job-description',
    '.position-desc',
    '.job-duty',
    '.job-sec',
    '[class*="job-desc"]',
    '[class*="job-detail"]',
    '[class*="duty"]',
    '[class*="requirement"]',
    '.content',
    'main',
    'article'
  ];

  let jdText = '';
  for (const selector of descSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && el.textContent.length > 80) {
      jdText += ' ' + el.textContent;
    }
  }

  if (jdText.length < 80) {
    // 降级直接获取 body 可见文本
    jdText = document.body?.innerText || '';
  }

  return { jobTitle, jdText };
}

// 引入科研级 AC 自动机多模式匹配引擎
import { AhoCorasickMatcher } from './trieMatcher';

const acMatcher = new AhoCorasickMatcher();
acMatcher.insertBatch(TECH_KEYWORD_DICTIONARY);
acMatcher.build();

/**
 * 提取文本中命中的技术与业务关键词 (O(N) 线性时间 AC 自动机)
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  return acMatcher.searchUnique(text);
}

/**
 * 将求职者简历扁平化为纯文本以供比对
 */
function extractResumeText(resume: StandardResume): string {
  const parts: string[] = [
    resume.basics.selfEvaluation || '',
    resume.basics.expectedRole || '',
  ];

  resume.skills?.forEach(s => parts.push(s.name || ''));
  resume.educations?.forEach(e => {
    parts.push(e.schoolName || '', e.major || '', e.degree || '', e.courses || '');
  });
  resume.experiences?.forEach(e => {
    parts.push(e.company || '', e.title || '', e.description || '');
  });
  resume.projects?.forEach(p => {
    parts.push(p.projectName || '', p.role || '', p.techStack || '', p.description || '');
  });
  resume.certificates?.forEach(c => parts.push(c.name || ''));
  resume.qaBank?.forEach(q => parts.push(q.keyword || '', q.answer || ''));

  return parts.join(' ');
}

/**
 * 分析当前页面 JD 与简历的匹配度
 */
export function analyzeJDMatch(resume: StandardResume): JDAnalysisResult {
  const { jobTitle, jdText } = extractJDFromPage();
  const jdKeywords = extractKeywords(jdText);
  const resumeText = extractResumeText(resume);
  const resumeKeywords = extractKeywords(resumeText);

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of jdKeywords) {
    const kwLower = kw.toLowerCase();
    if (resumeKeywords.some(rk => rk.toLowerCase() === kwLower) || resumeText.toLowerCase().includes(kwLower)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const matchScore = jdKeywords.length > 0
    ? Math.round(matchedKeywords.length / jdKeywords.length * 100)
    : null;

  // 生成诊断优化建议
  const diagnosticTips: string[] = [];
  if (missingKeywords.length > 0) {
    diagnosticTips.push(`页面提及【${missingKeywords.slice(0, 4).join('、')}】，简历中未找到对应关键词；仅在你确实具备相关经历时补充。`);
  }
  if (matchScore === null) diagnosticTips.push('无法评估：当前页面未识别到可用关键词，请打开完整岗位描述后重新分析。非技术岗位可能不在当前词典范围内。');
  else diagnosticTips.push(`简历覆盖了页面识别关键词中的 ${matchedKeywords.length}/${jdKeywords.length} 项。此结果仅作文字核对，不代表岗位适合程度或录用概率。`);

  return {
    jobTitle,
    pageUrl: window.location.href,
    matchScore,
    matchedKeywords,
    missingKeywords,
    allDetectedJDKeywords: jdKeywords,
    diagnosticTips
  };
}

const HIGHLIGHT_STYLE_ID = 'openjobfill-jd-highlight-styles';

function ensureHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    mark.openjobfill-kw-matched {
      background: rgba(16, 185, 129, 0.25) !important;
      color: #065f46 !important;
      font-weight: bold !important;
      border-radius: 4px !important;
      padding: 1px 4px !important;
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.4) !important;
    }
    mark.openjobfill-kw-missing {
      background: rgba(245, 158, 11, 0.25) !important;
      color: #92400e !important;
      font-weight: bold !important;
      border-radius: 4px !important;
      padding: 1px 4px !important;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4) !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    mark.openjobfill-kw-missing:hover {
      background: rgba(245, 158, 11, 0.45) !important;
      transform: scale(1.05) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 在当前招聘网页 DOM 文本节点上实时高亮已命中与缺失的技能关键词
 */
export function highlightJDOnWebpage(resume: StandardResume): { matchedCount: number; missingCount: number } {
  clearJDHighlights();
  ensureHighlightStyles();

  const analysis = analyzeJDMatch(resume);
  const matchedSet = new Set(analysis.matchedKeywords.map(k => k.toLowerCase()));
  const missingSet = new Set(analysis.missingKeywords.map(k => k.toLowerCase()));

  if (matchedSet.size === 0 && missingSet.size === 0) {
    return { matchedCount: 0, missingCount: 0 };
  }

  let matchedCount = 0;
  let missingCount = 0;

  // 遍历页面主体文本节点 (排除 script, style, openjobfill 节点)
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('#openjobfill-extension-host') || parent.closest('.openjobfill-field-badge')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  let curr = walker.nextNode();
  while (curr) {
    if (curr.textContent && curr.textContent.trim().length > 1) {
      textNodes.push(curr as Text);
    }
    curr = walker.nextNode();
  }

  // 构造替换正则
  const allKws = [...analysis.matchedKeywords, ...analysis.missingKeywords].sort((a, b) => b.length - a.length);
  if (allKws.length === 0) return { matchedCount: 0, missingCount: 0 };

  const regexPattern = allKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${regexPattern})`, 'gi');

  for (const node of textNodes) {
    const text = node.textContent;
    if (!text || !regex.test(text)) continue;
    regex.lastIndex = 0;

    const span = document.createElement('span');
    span.className = 'openjobfill-highlighted-container';

    // 用 DOM 节点拼接而不是 innerHTML：岗位描述来自外部网页，文本里即使
    // 出现 <...> 也只能作为文本展示，不能在页面中被重新解释成 HTML。
    let lastIndex = 0;
    text.replace(regex, (match, _group, offset: number) => {
      if (offset > lastIndex) {
        span.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      }

      const matchLower = match.toLowerCase();
      const mark = document.createElement('mark');
      if (matchedSet.has(matchLower)) {
        matchedCount++;
        mark.className = 'openjobfill-kw-matched';
        mark.title = `[简历已覆盖] ${match}`;
      } else if (missingSet.has(matchLower)) {
        missingCount++;
        mark.className = 'openjobfill-kw-missing';
        mark.title = `[岗位提及但简历缺失] 点击复制【${match}】`;
      } else {
        span.appendChild(document.createTextNode(match));
        lastIndex = offset + match.length;
        return match;
      }

      mark.textContent = match;
      span.appendChild(mark);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      span.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(span, node);
  }

  return { matchedCount, missingCount };
}

/**
 * 清除网页上的所有荧光笔标记
 */
export function clearJDHighlights(): void {
  const containers = document.querySelectorAll('.openjobfill-highlighted-container');
  containers.forEach(container => {
    const parent = container.parentNode;
    if (parent) {
      const textNode = document.createTextNode(container.textContent || '');
      parent.replaceChild(textNode, container);
    }
  });

  const marks = document.querySelectorAll('mark.openjobfill-kw-matched, mark.openjobfill-kw-missing');
  marks.forEach(m => {
    const parent = m.parentNode;
    if (parent) {
      const textNode = document.createTextNode(m.textContent || '');
      parent.replaceChild(textNode, m);
    }
  });
}

