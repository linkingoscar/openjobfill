/**
 * 语义相似度与混合自然语言距离计算引擎
 * 融合 Levenshtein 动态规划空间压缩算法、字符级 N-gram Jaccard 与权重词频模型
 */

/**
 * 计算两个字符串的 Levenshtein 编辑距离 (O(min(N, M)) 空间优化算法)
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;

  const a = s1.length < s2.length ? s1 : s2;
  const b = s1.length < s2.length ? s2 : s1;

  let prevRow = new Array(a.length + 1);
  let currRow = new Array(a.length + 1);

  for (let j = 0; j <= a.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    currRow[0] = i;
    const charB = b[i - 1];

    for (let j = 1; j <= a.length; j++) {
      const charA = a[j - 1];
      const cost = charA === charB ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // 删除
        currRow[j - 1] + 1,  // 插入
        prevRow[j - 1] + cost // 替换
      );
    }

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[a.length];
}

/**
 * 归一化编辑距离相似度 (0.0 ~ 1.0)
 */
export function levenshteinSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * 字符级 2-Gram Jaccard 集合重合度
 */
export function jaccardBigramSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const clean1 = s1.toLowerCase().replace(/[\s:：_\-—*]/g, '');
  const clean2 = s2.toLowerCase().replace(/[\s:：_\-—*]/g, '');

  if (!clean1 || !clean2) return 0.0;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.92;

  const getBigrams = (str: string): Set<string> => {
    const set = new Set<string>();
    if (str.length < 2) {
      set.add(str);
      return set;
    }
    for (let i = 0; i < str.length - 1; i++) {
      set.add(str.slice(i, i + 2));
    }
    return set;
  };

  const set1 = getBigrams(clean1);
  const set2 = getBigrams(clean2);

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * 常见中文表单生僻/复合字段同义词知识库
 */
export const FORM_FIELD_SYNONYM_GRAPH: Record<string, string[]> = {
  'basics.name': ['姓名', '中文姓名', '真实姓名', '申请人姓名', '您的姓名', '应聘者姓名', 'name', 'applicant name', 'full name'],
  'basics.phone': ['手机号码', '联系电话', '手机', '电话', '移动电话', '联系方式', '常用手机号', 'phone', 'mobile', 'cellphone'],
  'basics.email': ['电子邮箱', '邮箱地址', 'email', 'e-mail', 'mail', '个人邮箱', '常用邮箱'],
  'basics.idCardNumber': ['身份证号', '证件号码', '身份证号码', '大陆身份证', '证件号', 'id number', 'id card', 'id card no'],
  'basics.birthDate': ['出生日期', '出生年月', '生日', '生于', 'birth date', 'birthday', 'dob'],
  'basics.gender': ['性别', '生理性别', '男/女', 'gender', 'sex'],
  'basics.politicalStatus': ['政治面貌', '政治面貌(中共党员/预备党员/共青团员/群众)', '党派', 'political status', 'party affiliation'],
  'basics.ethnicity': ['民族', '国籍民族', '族别', 'ethnicity', 'nationality'],
  'basics.maritalStatus': ['婚姻状况', '婚否', '已婚/未婚', 'marital status'],
  'basics.nativePlace.city': ['籍贯', '生源地', '户籍所在地', '祖籍', '户口所在地', '出生地', 'native place', 'origin'],
  'basics.currentLocation.city': ['现居城市', '目前所在地', '现居住地', '常住城市', '常住地址', '居住城市', 'current location', 'city'],
  'basics.expectedRole': ['期望职位', '求职意向', '意向岗位', '目标职位', '申请职位', '应聘岗位', 'target role', 'expected position'],
  'basics.expectedSalaryMin': ['期望薪资', '期望薪酬', '薪酬诉求', '期望月薪', '税前期望薪资', '期望待遇', 'expected salary', 'salary expectation'],
  'basics.selfEvaluation': ['自我评价', '个人优势', '关于我', '个人总结', '亮点介绍', '优势自述', 'self evaluation', 'personal summary'],
  'educations.0.schoolName': ['毕业院校', '最高学历学校', '就读大学', '毕业学校', '学校全称', '大学名称', 'school', 'university', 'college'],
  'educations.0.major': ['所学专业', '专业名称', '主修专业', '专业', 'major', 'discipline'],
  'educations.0.degree': ['学历层次', '最高学历', '学位', '学历', '文化程度', 'degree', 'education level'],
  'educations.0.gpa': ['gpa', '平均绩点', '成绩排名', '绩点', '专业排名', 'grade point average'],
  'experiences.0.company': ['公司名称', '就职单位', '实习单位', '工作单位', '雇主名称', '企业名称', 'company', 'employer', 'organization'],
  'experiences.0.title': ['职位名称', '担任职务', '岗位名称', '工作岗位', 'job title', 'position', 'role'],
  'projects.0.projectName': ['项目名称', '主要项目', '核心项目', '项目标题', 'project name', 'project title'],
};

/**
 * 综合语义相似度打分器 (综合编辑距离 + 2-Gram + 同义词词图)
 * @returns 0.0 ~ 1.0 的语义匹配置信度
 */
export function calculateSemanticSimilarity(inputLabel: string, resumeKey: string): number {
  if (!inputLabel || !resumeKey) return 0.0;

  const synonyms = FORM_FIELD_SYNONYM_GRAPH[resumeKey] || [];
  const cleanInput = inputLabel.toLowerCase().replace(/[:：*_\-\s]/g, '');

  let maxScore = 0.0;

  // 1. 直接全词或包含匹配 (权重最高)
  for (const syn of synonyms) {
    const cleanSyn = syn.toLowerCase().replace(/[:：*_\-\s]/g, '');
    if (cleanInput === cleanSyn) return 1.0;
    if (cleanInput.includes(cleanSyn) || cleanSyn.includes(cleanInput)) {
      maxScore = Math.max(maxScore, 0.95);
    }
  }

  // 2. 混合计算 Bigram Jaccard + Levenshtein 相似度
  for (const syn of synonyms) {
    const jaccard = jaccardBigramSimilarity(cleanInput, syn);
    const lev = levenshteinSimilarity(cleanInput, syn);
    const hybrid = jaccard * 0.6 + lev * 0.4;
    maxScore = Math.max(maxScore, hybrid);
  }

  return maxScore;
}
