import type {
  StandardResume,
  EducationExperience,
  WorkExperience,
  ProjectExperience,
  AwardItem,
  AcademicAchievement,
  CampusExperience,
} from '../../types/resume';

/** 将 Mammoth 生成的 Markdown 转义还原为适合字段解析的稳定纯文本。 */
export function normalizeResumeText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1')
    .replace(/\[([^\]]+)]\((?:mailto:)?[^)]+\)/g, '$1')
    .replace(/__([^\n]+?)__/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[\uF06C\uF0B7\uF097]/g, '•')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 智能中文简历文本结构化解析引擎
 * 基于多层启发式分块、正则表达式与关键词识别，将非结构化简历文本转换为 StandardResume 数据模型
 */
export function parseResumeFromText(rawText: string, resumeTitle = '解析导入简历'): StandardResume {
  const text = normalizeResumeText(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const resume: StandardResume = {
    id: 'resume-' + Date.now(),
    title: resumeTitle,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schemaVersion: 4,
    basics: {
      name: '',
      gender: '',
      birthDate: '',
      phone: '',
      email: '',
      idCardType: '',
      idCardNumber: '',
      politicalStatus: '',
      ethnicity: '',
      maritalStatus: '',
      nativePlace: { province: '', city: '' },
      birthPlace: { province: '', city: '' },
      currentLocation: { province: '', city: '' },
      workingYears: 0,
      jobStatus: '',
      expectedRole: '',
      selfEvaluation: '',
      hobbies: '',
    },
    educations: [],
    experiences: [],
    projects: [],
    skills: [],
    languages: [],
    certificates: [],
    familyMembers: [],
    awards: [],
    academicAchievements: [],
    campusExperiences: [],
    qaBank: [],
  };

  // 1. 提取手机号 (1[3-9]\d{9}，支持带横杠或空格)
  const phoneMatch = text.match(/(?:^|\n)(?:本人)?(?:手机(?:号码)?|联系电话|电话|联系方式)[：: \t]*(?:\+?86[- ]?)?(1[3-9]\d{1}[- ]?\d{4}[- ]?\d{4})/m)
    || text.match(/(?:\+?86[- ]?)?(1[3-9]\d{1}[- ]?\d{4}[- ]?\d{4})/);
  if (phoneMatch) {
    resume.basics.phone = phoneMatch[1].replace(/[- ]/g, '');
  }

  // 2. 提取邮箱
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    resume.basics.email = emailMatch[1];
  }

  // 3. 提取身份证
  const idCardMatch = text.match(/([1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])/);
  if (idCardMatch) {
    resume.basics.idCardNumber = idCardMatch[1].toUpperCase();
    resume.basics.idCardType = '身份证';
  }

  // 4. 提取性别
  if (/性别[：:\s]*女|[^\u4e00-\u9fa5]女[^\u4e00-\u9fa5]|女\s*\|/.test(text)) {
    resume.basics.gender = '女';
  } else if (/性别[：:\s]*男|[^\u4e00-\u9fa5]男[^\u4e00-\u9fa5]|男\s*\|/.test(text)) {
    resume.basics.gender = '男';
  }

  // 5. 提取政治面貌
  if (/中共党员|预备党员/.test(text)) {
    resume.basics.politicalStatus = text.includes('预备') ? '中共预备党员' : '中共党员';
  } else if (/共青团员/.test(text)) {
    resume.basics.politicalStatus = '共青团员';
  }

  // 6. 提取出生日期 (YYYY-MM-DD 或 YYYY.MM 或 YYYY年MM月)
  const birthMatch = text.match(/(?:出生[年日]?[月期]?|生日|出生日期)[：:\s]*(\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?)/);
  if (birthMatch) {
    resume.basics.birthDate = normalizeDateString(birthMatch[1]);
  }

  // 7. 提取民族
  const ethnicityMatch = text.match(/(?:民\s*族)[：:\s]*([\u4e00-\u9fa5]{1,10}族?)/);
  if (ethnicityMatch) {
    resume.basics.ethnicity = ethnicityMatch[1].endsWith('族') ? ethnicityMatch[1] : ethnicityMatch[1] + '族';
  }

  // 8. 提取籍贯与所在地 (省/市)
  const nativeMatch = text.match(/(?:籍\s*贯|生源地)[：: \t]*([^\s|，,]{2,20})/);
  if (nativeMatch) {
    const loc = nativeMatch[1].trim();
    resume.basics.nativePlace = { province: '', city: loc, detail: loc };
  }

  const birthPlaceMatch = text.match(/出生地[：: \t]*([^\s|，,]{2,20})/);
  if (birthPlaceMatch) {
    const loc = birthPlaceMatch[1].trim();
    resume.basics.birthPlace = { province: '', city: loc, detail: loc };
  }

  const currentLocMatch = text.match(/(?:现居住地|现居地|目前所在地|常住城市|现居)[：: \t]*([^\s|，,]{2,20})/);
  if (currentLocMatch) {
    const loc = currentLocMatch[1].trim();
    resume.basics.currentLocation = { province: '', city: loc, detail: loc };
  }

  // 9. 提取期望职位 / 求职意向
  // 标签后的冒号是必要条件，因此可以安全支持联系方式同一行中的“意向岗位：…”而不会命中正文里的“求职意向及匹配情况”。
  const roleMatch = text.match(/(?:求职意向|期望职位|意向岗位|应聘岗位|目标职位)[：: \t]+([^\n|，,]+)/m);
  if (roleMatch) {
    resume.basics.expectedRole = roleMatch[1].trim();
  }

  // 10. 提取姓名 (支持中英文姓名与文档首部提取)
  const namePatternMatch = text.match(/(?:^|\n)(?:姓\s*名|Name|Full[ \t]*Name)[：: \t]*([a-zA-Z\u4e00-\u9fa5· ]{2,25})(?=\n|$)/im);
  if (namePatternMatch) {
    resume.basics.name = namePatternMatch[1].trim();
  } else {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const rawLine = lines[i].trim();
      const noisyWords = ['个人简历', '求职简历', '简历', '个人信息', '基本信息', '求职意向', 'resume', 'curriculum vitae', 'cv'];
      if (noisyWords.some(w => rawLine.toLowerCase().includes(w))) {
        continue;
      }
      
      // 纯中文 2-4 字姓名
      const chineseOnly = rawLine.replace(/[^\u4e00-\u9fa5]/g, '');
      if (chineseOnly.length >= 2 && chineseOnly.length <= 4 && chineseOnly === rawLine) {
        resume.basics.name = chineseOnly;
        break;
      }

      // 英文姓名 (如 "Johnathan Smith" 或 "Alex Ferguson")
      if (/^[A-Za-z]+(?:\s+[A-Za-z]+){1,2}$/.test(rawLine) && rawLine.length <= 30) {
        resume.basics.name = rawLine;
        break;
      }
    }
  }

  // 10.1 智能中英文姓名拆分 (firstName / lastName)
  if (resume.basics.name) {
    const rawName = resume.basics.name.trim();
    if (/\s+/.test(rawName)) {
      const parts = rawName.split(/\s+/);
      resume.basics.firstName = parts[0];
      resume.basics.lastName = parts.slice(1).join(' ');
    } else if (/^[\u4e00-\u9fa5]{2,4}$/.test(rawName)) {
      const compoundSurnames = ['欧阳', '诸葛', '司马', '上官', '东方', '独孤', '南宫', '皇甫', '公孙', '令狐', '钟离', '慕容', '夏侯', '尉迟'];
      const matchedCompound = compoundSurnames.find(s => rawName.startsWith(s));
      if (matchedCompound) {
        resume.basics.lastName = matchedCompound;
        resume.basics.firstName = rawName.slice(matchedCompound.length);
      } else {
        resume.basics.lastName = rawName.slice(0, 1);
        resume.basics.firstName = rawName.slice(1);
      }
    }
  }

  // 11. 智能分块切分 (按大标题识别，支持 Markdown ##、序号【】、符号★等)
  const sectionKeywords = [
    { type: 'family', headers: ['家庭成员及主要社会关系', '家庭成员', '主要社会关系', '亲属信息', 'family members'] },
    { type: 'contact', headers: ['联系方式', '联系信息', 'contact'] },
    { type: 'education', headers: ['教育背景', '教育经历', '学习经历', '教育信息', '学历经历', '教育与培训', '学历信息', 'education'] },
    { type: 'experience', headers: ['工作经历', '工作经验', '实习经历', '实习经验', '工作与实习', '工作及实习经历', '实习工作经历', '职业经历', '从业经历', '实践经历', 'experience', 'work experience', 'internship'] },
    { type: 'projects', headers: ['项目经历', '科研项目经历', '科研经历', '课题经历', '社会实践经历', '项目经验', '重点项目', '主要项目', '个人项目', '项目实践', 'projects', 'project experience'] },
    { type: 'academic', headers: ['学术成果', '科研成果', '论文成果', '论文发表', 'publication', 'publications'] },
    { type: 'awards', headers: ['获奖情况', '荣誉奖项', '奖项荣誉', '奖学金', 'awards', 'honors'] },
    { type: 'campus', headers: ['学生干部经历', '校园经历', '学生工作', '校内实践', 'campus experience'] },
    { type: 'skills', headers: ['专业技能', '证书及专业技能', '证书与专业技能', '专业证书及技能', '技能特长', '技能清单', 'it技能', '个人技能', '技能证书', '技术栈', '主要技能', 'skills', 'technical skills'] },
    { type: 'summary', headers: ['自我评价', '个人总结', '个人优势', '关于我', '个人评价', '综合素养', 'summary', 'about me', 'self evaluation'] },
  ];

  interface TextSection {
    type: string;
    content: string[];
  }

  const sections: TextSection[] = [];
  let currentSection: TextSection = { type: 'header', content: [] };

  for (const line of lines) {
    let matchedHeaderType: string | null = null;
    const cleanLine = line
      .toLowerCase()
      .replace(/^[#\s*•·◆■➢★\-\d.、一二三四五六七八九十()（）[\]【】]+/g, '')
      .replace(/[:：\s_\-#*\[\]【】()（）]/g, '')
      .trim();

    for (const sk of sectionKeywords) {
      if (sk.headers.some(h => cleanLine === h || (cleanLine.startsWith(h) && cleanLine.length <= h.length + 3))) {
        matchedHeaderType = sk.type;
        break;
      }
    }

    if (matchedHeaderType) {
      sections.push(currentSection);
      currentSection = { type: matchedHeaderType, content: [] };
    } else {
      currentSection.content.push(line);
    }
  }
  sections.push(currentSection);

  // 12. 解析各分块数据
  for (const sec of sections) {
    if (sec.type === 'education') {
      resume.educations.push(...parseEducationSection(sec.content));
    } else if (sec.type === 'experience') {
      resume.experiences.push(...parseExperienceSection(sec.content));
    } else if (sec.type === 'projects') {
      resume.projects.push(...parseProjectSection(sec.content));
    } else if (sec.type === 'family') {
      resume.familyMembers.push(...parseFamilySection(sec.content));
    } else if (sec.type === 'academic') {
      resume.academicAchievements!.push(...parseAcademicSection(sec.content));
    } else if (sec.type === 'awards') {
      resume.awards!.push(...parseAwardSection(sec.content));
    } else if (sec.type === 'campus') {
      resume.campusExperiences!.push(...parseCampusSection(sec.content));
    } else if (sec.type === 'skills') {
      const parsedSkills = parseSkillsSection(sec.content);
      resume.skills.push(...parsedSkills.skills);
      resume.certificates.push(...parsedSkills.certificates);
      if (parsedSkills.hobbies) resume.basics.hobbies = parsedSkills.hobbies;
    } else if (sec.type === 'summary') {
      resume.basics.selfEvaluation = sec.content.join('\n').trim();
    }
  }

  // 13. 时序自动归一化与工龄自动推导 (科研级倒序排序与工龄计算)
  if (resume.educations.length > 0) {
    resume.educations.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const gpaMatch = text.match(/(?:硕士|本科|平均)?(?:绩点|GPA)[：: \t]*([\d.]+(?:\/[\d.]+)?)/i);
    if (gpaMatch && !resume.educations[0].gpa) resume.educations[0].gpa = gpaMatch[1];
  }

  resume.languages = parseLanguageScores(text);
  const globalSkillLines = lines.filter(line => /^(?:证书技能|技能|专业技能)[：:]|精通|熟练使用|熟悉使用/.test(line));
  if (globalSkillLines.length > 0) {
    const globalSkills = parseSkillsSection(globalSkillLines);
    const existingSkillNames = new Set(resume.skills.map(skill => skill.name.toLowerCase()));
    globalSkills.skills.forEach((skill) => {
      if (!existingSkillNames.has(skill.name.toLowerCase())) resume.skills.push(skill);
    });
    const existingCertificates = new Set(resume.certificates.map(certificate => certificate.name));
    globalSkills.certificates.forEach((certificate) => {
      if (!existingCertificates.has(certificate.name)) resume.certificates.push(certificate);
    });
    if (!resume.basics.hobbies && globalSkills.hobbies) resume.basics.hobbies = globalSkills.hobbies;
  }
  if (resume.experiences.length > 0) {
    resume.experiences.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    
    // 计算全职工作年限 (仅针对明确识别为“全职”的经历，绝不盲推)
    const fulltimeExp = resume.experiences.filter(e => e.jobType === '全职');
    const startYears = fulltimeExp.map(e => parseInt(e.startDate?.slice(0, 4) || '0')).filter(y => y > 1990);
    if (startYears.length > 0) {
      const earliestYear = Math.min(...startYears);
      const currentYear = new Date().getFullYear();
      resume.basics.workingYears = Math.max(0, currentYear - earliestYear);
    }
  }
  if (resume.projects.length > 0) {
    resume.projects.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }

  // 如果没有单独提取出自我评价，且问答库为空，补充默认问答
  if (resume.basics.selfEvaluation) {
    resume.qaBank.push({
      id: 'qa-' + Date.now(),
      keyword: '自我评价',
      answer: resume.basics.selfEvaluation,
    });
  }

  return resume;
}

/** 规范化日期字符串为 YYYY-MM 或 YYYY-MM-DD */
function normalizeDateString(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/[年月\./日]/g, '-').split('-').filter(Boolean);
  if (digits.length >= 3) {
    return `${digits[0].padStart(4, '20')}-${digits[1].padStart(2, '0')}-${digits[2].padStart(2, '0')}`;
  } else if (digits.length === 2) {
    return `${digits[0].padStart(4, '20')}-${digits[1].padStart(2, '0')}`;
  } else if (digits.length === 1 && digits[0].length === 4) {
    return digits[0];
  }
  return raw.trim();
}

/** 提取日期起止范围 (如 "2020.09 - 2024.06" 或 "2020-09 至 至今") */
function extractDateRange(text: string): { startDate: string; endDate: string } {
  const dateRegex = /(\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?)\s*(?:[-~–—至到]|to)\s*(\d{4}年内|\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?|至今|目前|现在|present)/i;
  const match = text.match(dateRegex);
  if (match) {
    const endDate = match[2].includes('至今') || match[2].toLowerCase().includes('present')
      ? '至今'
      : match[2].includes('年内')
        ? match[2].slice(0, 4)
        : normalizeDateString(match[2]);
    return {
      startDate: normalizeDateString(match[1]),
      endDate,
    };
  }
  return { startDate: '', endDate: '' };
}

/** 解析教育背景分块 */
function parseEducationSection(lines: string[]): EducationExperience[] {
  const educations: EducationExperience[] = [];
  const schoolKeywords = ['大学', '学院', '学校', 'University', 'College', 'Institute'];
  const degreeKeywords: { name: '专科' | '本科' | '硕士' | '博士'; words: string[] }[] = [
    { name: '博士', words: ['博士', 'PhD', 'Doctor'] },
    { name: '硕士', words: ['硕士', '研究生', 'Master'] },
    { name: '本科', words: ['本科', '学士', 'Bachelor'] },
    { name: '专科', words: ['大专', '专科', 'Associate'] },
  ];

  let currentEdu: Partial<EducationExperience> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\d{1,2}[.、]\s*(?!\d)/, '').trim();
    const inline = line.match(
      /^(博士|硕士|研究生|本科|学士|专科|大专|高中)\s*[-|]\s*(.+?)\s*[-|]\s*(\d{4}[.\-/年]\d{1,2})\s*[-~–—至到]\s*(\d{4}[.\-/年]\d{1,2}|至今|目前|现在|present)\s*[-|]\s*(.+?)(?:\s*[-|]\s*(统招全日制|全日制|非全日制))?$/i
    );

    if (inline) {
      if (currentEdu && (currentEdu.schoolName || currentEdu.major)) educations.push(fillDefaultEdu(currentEdu));
      const degreeText = inline[1];
      currentEdu = {
        id: `edu-${Date.now()}-${educations.length}`,
        degree: /博士/.test(degreeText) ? '博士'
          : /硕士|研究生/.test(degreeText) ? '硕士'
            : /本科|学士/.test(degreeText) ? '本科'
              : /专科|大专/.test(degreeText) ? '专科' : '其他',
        schoolName: inline[2].trim(),
        startDate: normalizeDateString(inline[3]),
        endDate: /至今|目前|现在|present/i.test(inline[4]) ? '至今' : normalizeDateString(inline[4]),
        major: inline[5].trim(),
        isFullTime: !/非全日制/.test(inline[6] || ''),
      };
      continue;
    }

    const dates = extractDateRange(line);
    const hasSchool = schoolKeywords.some(kw => line.includes(kw));
    if ((dates.startDate || hasSchool) && !/^主要课程/.test(line)) {
      if (currentEdu && (currentEdu.schoolName || currentEdu.major)) educations.push(fillDefaultEdu(currentEdu));
      currentEdu = {
        id: `edu-${Date.now()}-${educations.length}`,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
      const withoutDates = line
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, ' ')
        .replace(/至今|目前|现在|present|to|[-~–—至到]/gi, ' ');
      const tokens = withoutDates.split(/[\s|·,\t]+/).map((part) => part.trim()).filter(Boolean);
      const schoolIndex = tokens.findIndex((part) => schoolKeywords.some((kw) => part.includes(kw)));
      currentEdu.schoolName = schoolIndex >= 0 ? tokens[schoolIndex] : '';
      const majorCandidate = tokens.slice(schoolIndex + 1).find((token) =>
        !degreeKeywords.some((degree) => degree.words.some((word) => token.toLowerCase() === word.toLowerCase())) &&
        !/^(?:GPA|绩点|全日制|统招)/i.test(token)
      );
      if (majorCandidate) {
        currentEdu.major = majorCandidate
          .replace(/[|｜]/g, '/')
          .replace(/(?:博士|硕士|研究生|本科|学士|专科|大专)$/i, '')
          .trim();
      }
    }

    if (!currentEdu) continue;
    for (const deg of degreeKeywords) {
      if (deg.words.some(w => line.includes(w))) {
        currentEdu.degree = deg.name;
        break;
      }
    }
    const coursesMatch = line.match(/(?:主要|主修|核心)?课程[：: \t]*(.+)$/);
    if (coursesMatch) currentEdu.courses = coursesMatch[1].trim();
    const majorMatch = line.match(/(?:所学专业|专业名称|主修专业|主修)[：: \t]*([^|,，]+)/);
    if (majorMatch && !coursesMatch) currentEdu.major = majorMatch[1].trim();
    const gpaMatch = line.match(/(?:GPA|绩点|平均成绩)[：: \t]*([\d.]+(?:\/[\d.]+)?)/i);
    if (gpaMatch) currentEdu.gpa = gpaMatch[1];
    if (/统招|全日制/.test(line)) currentEdu.isFullTime = !/非全日制/.test(line);
  }

  if (currentEdu && (currentEdu.schoolName || currentEdu.major)) {
    educations.push(fillDefaultEdu(currentEdu));
  }

  return educations;
}

function fillDefaultEdu(item: Partial<EducationExperience>): EducationExperience {
  return {
    id: item.id || 'edu-' + Math.random().toString(36).slice(2, 8),
    schoolName: item.schoolName || '',
    degree: item.degree || '本科',
    major: item.major || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    gpa: item.gpa || '',
    isFullTime: item.isFullTime ?? true,
    courses: item.courses || '',
  };
}

/** 解析工作/实习经历分块 */
function parseExperienceSection(lines: string[]): WorkExperience[] {
  const experiences: WorkExperience[] = [];
  const structuredDateIndexes = lines
    .map((line, index) => {
      const dates = extractDateRange(line);
      // 独占一行的日期只应包含数字、日期标点和“至今”等状态词；避免复杂替换误吞第二个年份。
      const dateOnlyText = line.replace(/至今|目前|现在|present|年内/gi, '');
      const isDateOnly = Boolean(dates.startDate) && !/[A-Za-z\u4e00-\u9fa5]/.test(dateOnlyText);
      return { index, dates, isDateOnly };
    })
    .filter(({ index, dates, isDateOnly }) => dates.startDate && isDateOnly && index >= 2 && lines[index - 1].length < 80 && lines[index - 2].length < 100);

  if (structuredDateIndexes.length > 0) {
    for (let position = 0; position < structuredDateIndexes.length; position++) {
      const { index, dates } = structuredDateIndexes[position];
      const nextIndex = structuredDateIndexes[position + 1]?.index ?? lines.length + 2;
      const company = lines[index - 2].replace(/^\d{1,2}[.、]\s*(?!\d)/, '').trim();
      const title = lines[index - 1].trim();
      if (/^(?:工作|实习|实践)经历$/.test(company) || /^\d{1,2}[.、]\s*(?!\d)/.test(title)) continue;
      const descriptionEnd = Math.max(index + 1, nextIndex - 2);
      const description = lines.slice(index + 1, descriptionEnd).join('\n').trim();
      experiences.push(fillDefaultExp({
        id: `exp-${Date.now()}-${experiences.length}`,
        company,
        title,
        startDate: dates.startDate,
        endDate: dates.endDate,
        description,
        jobType: /实习|见习/i.test(title) ? '实习' : undefined,
      }));
    }
    if (experiences.length > 0) return experiences;
  }

  let currentExp: Partial<WorkExperience> | null = null;
  const descLines: string[] = [];

  for (const line of lines) {
    const dates = extractDateRange(line);
    const hasCompanySignal = /公司|科技|网络|技术|集团|实验室|有限|工作室|研发中心|政府|银行|事务所|研究院|Inc|Corp|Ltd/.test(line);

    if (dates.startDate || (hasCompanySignal && !currentExp)) {
      if (currentExp && (currentExp.company || currentExp.title)) {
        currentExp.description = descLines.join('\n').trim();
        experiences.push(fillDefaultExp(currentExp));
        descLines.length = 0;
      }

      currentExp = {
        id: 'exp-' + Date.now() + '-' + experiences.length,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };

      const cleanExpLine = line
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, '')
        .replace(/至今|目前|现在|present|to|[-~–—至到]/gi, '');
      const compactRow = cleanExpLine.replace(/\s+/g, ' ').trim();
      const inlineRole = compactRow.match(/^(.+?)\s+([^ ]*(?:实习生|见习|工程师|开发|专员|助理|主管|经理|架构师|顾问|分析师|管培生))$/i);
      if (inlineRole) {
        currentExp.company = inlineRole[1].trim();
        currentExp.title = inlineRole[2].trim();
      } else {
        const tokens = compactRow.split(/[\s|·,\t]+/).filter(Boolean);
        for (const t of tokens) {
          if (hasCompanySignal && !currentExp.company) {
            currentExp.company = t.trim();
          } else if (/工程师|开发|专员|助理|实习生|见习|前端|后端|算法|产品|主管|经理|架构师|顾问|分析师|管培生/.test(t)) {
            currentExp.title = t.trim();
          }
        }
      }

      if (/实习|见习|intern/i.test(line) || /实习生|见习|intern/i.test(currentExp.title || '')) {
        currentExp.jobType = '实习';
      } else if (/全职|社招|full-?time/i.test(line)) {
        currentExp.jobType = '全职';
      }
    } else if (currentExp) {
      const titleMatch = line.match(/^(?:职位|岗位|职务)[：:\s]*([^\s|·,]+)/);
      if (titleMatch) {
        currentExp.title = titleMatch[1];
        if (/实习/i.test(titleMatch[1])) {
          currentExp.jobType = '实习';
        }
      } else {
        descLines.push(line);
      }
    }
  }

  if (currentExp && (currentExp.company || currentExp.title)) {
    currentExp.description = descLines.join('\n').trim();
    experiences.push(fillDefaultExp(currentExp));
  }

  return experiences;
}

function fillDefaultExp(item: Partial<WorkExperience>): WorkExperience {
  return {
    id: item.id || 'exp-' + Math.random().toString(36).slice(2, 8),
    company: item.company || '',
    title: item.title || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    description: item.description || '',
    techStack: item.techStack || '',
    jobType: item.jobType || undefined,
  };
}

/** 解析项目经历分块 */
function parseProjectSection(lines: string[]): ProjectExperience[] {
  const projects: ProjectExperience[] = [];
  let currentProj: Partial<ProjectExperience> | null = null;
  const descriptionLines: string[] = [];
  let parallelProjects: Partial<ProjectExperience>[] = [];
  let parallelProjectIndex = 0;
  let skippingEmbeddedCampusBlock = false;

  const finishCurrent = () => {
    if (!currentProj?.projectName) return;
    if (!currentProj.description) currentProj.description = descriptionLines.join('\n').trim();
    projects.push(fillDefaultProj(currentProj));
    currentProj = null;
    descriptionLines.length = 0;
  };

  const finishParallelProjects = () => {
    parallelProjects.forEach(project => projects.push(fillDefaultProj(project)));
    parallelProjects = [];
    parallelProjectIndex = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // 只接受常见的一到两位项目序号，避免把 2024.10—2025.06 日期误认成“第 2024 个项目”。
    const numberedTitle = line.match(/^\d{1,2}[.、]\s*(?!\d)(.+)$/);
    const explicitTitle = line.match(/^(?:项目名称|项目)[：: \t]+(.+)$/);
    if (numberedTitle || explicitTitle) {
      const projectName = (numberedTitle?.[1] || explicitTitle?.[1] || '').trim();
      finishCurrent();
      finishParallelProjects();
      // 部分 Word 简历把校园组织经历混排在项目章节中；这类“组织 + 职务”应留给校园经历解析。
      if (/大学|学院|研究生会|党委|团委|学生会/.test(projectName) && /\t|\s{2,}|部长|助理|负责人|主席|委员/.test(projectName)) {
        skippingEmbeddedCampusBlock = true;
        continue;
      }
      skippingEmbeddedCampusBlock = false;
      currentProj = {
        id: `proj-${Date.now()}-${projects.length}`,
        projectName,
      };
      continue;
    }

    if (/\t/.test(line) && /大学|学院|研究生会|党委|团委|学生会/.test(line)) {
      skippingEmbeddedCampusBlock = true;
      continue;
    }
    if (skippingEmbeddedCampusBlock) continue;

    const dates = extractDateRange(line);
    if (/^项目(?:起止)?时间[：:]/.test(line) && currentProj) {
      currentProj.startDate = dates.startDate;
      currentProj.endDate = dates.endDate;
      continue;
    }
    if (dates.startDate && !currentProj) {
      let projectName = line
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, ' ')
        .replace(/至今|目前|现在|present|to|[-~–—至到]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const inlineRole = projectName.match(/\s+(项目成员|项目负责人|负责人|核心成员|组长)$/);
      const role = inlineRole?.[1] || '';
      if (inlineRole) projectName = projectName.slice(0, inlineRole.index).trim();
      const parallelNames = projectName.split(/[|｜]/).map(name => name.trim()).filter(Boolean);
      if (parallelNames.length > 1) {
        finishParallelProjects();
        parallelProjects = parallelNames.map((name, index) => ({
          id: `proj-${Date.now()}-${projects.length + index}`,
          projectName: name,
          role,
          startDate: dates.startDate,
          endDate: dates.endDate,
          description: '',
        }));
        parallelProjectIndex = 0;
        continue;
      }
      currentProj = {
        id: `proj-${Date.now()}-${projects.length}`,
        projectName: parallelNames[0] || projectName,
        role,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
      continue;
    }
    if (parallelProjects.length > 0) {
      const startsBullet = /^•/.test(line);
      if (startsBullet && parallelProjects[parallelProjectIndex]?.description) {
        parallelProjectIndex = Math.min(parallelProjectIndex + 1, parallelProjects.length - 1);
      }
      const project = parallelProjects[parallelProjectIndex];
      const cleanDescription = line.replace(/^•\s*/, '').trim();
      project.description = [project.description, cleanDescription].filter(Boolean).join('\n');
      continue;
    }
    if (!currentProj) continue;

    const roleMatch = line.match(/^项目角色[：: \t]*(.+)$/);
    const descriptionMatch = line.match(/^项目(?:描述|简介)[：: \t]*(.+)$/);
    const responsibilityMatch = line.match(/^(?:主要职责|个人职责|职责)[：: \t]*(.+)$/);
    const techMatch = line.match(/^(?:技术栈|使用技术|技术)[：: \t]*(.+)$/);
    if (roleMatch) currentProj.role = roleMatch[1].trim();
    else if (descriptionMatch) currentProj.description = descriptionMatch[1].trim();
    else if (responsibilityMatch) currentProj.responsibility = responsibilityMatch[1].trim();
    else if (techMatch) currentProj.techStack = techMatch[1].trim();
    else descriptionLines.push(line);
  }

  finishCurrent();
  finishParallelProjects();

  return projects;
}

function fillDefaultProj(item: Partial<ProjectExperience>): ProjectExperience {
  return {
    id: item.id || 'proj-' + Math.random().toString(36).slice(2, 8),
    projectName: item.projectName || '未命名项目',
    role: item.role || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    description: item.description || '',
    responsibility: item.responsibility || '',
    techStack: item.techStack || '',
  };
}

function normalizeFamilyRelation(value: string): string {
  const relation = value.trim();
  if (/父/.test(relation)) return '父亲';
  if (/母/.test(relation)) return '母亲';
  if (/姐/.test(relation)) return '姐姐';
  if (/妹/.test(relation)) return '妹妹';
  if (/兄|哥/.test(relation)) return '哥哥';
  if (/弟/.test(relation)) return '弟弟';
  return relation;
}

function parseFamilySection(lines: string[]): StandardResume['familyMembers'] {
  const headerLabels = new Set(['姓名', '与本人关系', '关系', '工作单位及职务', '工作单位', '户籍所在地', '电话', '联系电话']);
  const values = lines.map((line) => line.trim()).filter((line) => line && !headerLabels.has(line));
  const members: StandardResume['familyMembers'] = [];

  for (let index = 0; index < values.length;) {
    const name = values[index];
    const relation = values[index + 1];
    const company = values[index + 2];
    const hukouLocation = values[index + 3];
    if (!name || !relation || !company || !hukouLocation) break;
    const maybePhone = values[index + 4] || '';
    const hasPhone = /^1[3-9]\d{9}$/.test(maybePhone.replace(/[- ]/g, ''));
    members.push({
      id: `family-${Date.now()}-${members.length}`,
      name,
      relation: normalizeFamilyRelation(relation),
      company,
      jobTitle: '',
      hukouLocation,
      phone: hasPhone ? maybePhone.replace(/[- ]/g, '') : '',
    });
    index += hasPhone ? 5 : 4;
  }
  return members;
}

function parseLanguageScores(text: string): StandardResume['languages'] {
  const languages: StandardResume['languages'] = [];
  const patterns = [
    { certificateName: 'CET-4', regex: /(?:CET\s*-?\s*4|英语四级|四级)(?:成绩)?[：: \t]*([\d.]+)/i },
    { certificateName: 'CET-6', regex: /(?:CET\s*-?\s*6|英语六级|六级)(?:成绩)?[：: \t]*([\d.]+)/i },
    { certificateName: 'IELTS', regex: /(?:IELTS|雅思)(?:成绩)?[：: \t]*([\d.]+)/i },
    { certificateName: 'TOEFL', regex: /(?:TOEFL|托福)(?:成绩)?[：: \t]*([\d.]+)/i },
  ];
  for (const item of patterns) {
    const match = text.match(item.regex);
    if (!match) continue;
    languages.push({
      id: `language-${item.certificateName.toLowerCase()}-${Date.now()}`,
      language: '英语',
      certificateName: item.certificateName,
      score: match[1],
    });
  }
  return languages;
}

function parseSkillsSection(lines: string[]): {
  skills: StandardResume['skills'];
  certificates: StandardResume['certificates'];
  hobbies: string;
} {
  const certificates: StandardResume['certificates'] = [];
  const skillNames = new Map<string, string>();
  let hobbies = '';

  const addSkill = (rawName: string) => {
    const value = rawName.trim();
    if (!value) return;
    const name = value.replace(/[(（]?(?:精通|熟练|熟悉|了解|proficient|familiar|basic)[)）]?/i, '').trim();
    const key = name.toLowerCase();
    if (!key) return;
    const existing = skillNames.get(key);
    const hasLevel = /精通|熟练|熟悉|了解|proficient|familiar|basic/i.test(value);
    if (!existing || hasLevel) skillNames.set(key, value);
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\d{1,2}[.、]\s*(?!\d)/, '').replace(/[；;]+$/, '').trim();
    if (!line || /^(?:专业证书|专业技能[\/／]兴趣爱好)$/.test(line)) continue;

    const hobbyMatch = line.match(/(?:兴趣爱好|爱好|热爱)[：: \t]*([^，。；;]+)/);
    if (hobbyMatch) {
      hobbies = hobbyMatch[1].trim();
      if (/^(?:兴趣爱好|爱好|热爱)[：:]/.test(line)) continue;
    }

    const certificateMatch = line.match(/^(?:证书技能|证书|专业证书|资格证书)[：: \t]*(.+)$/);
    if (certificateMatch) {
      certificateMatch[1].split(/[、,，；;]/).map(item => item.trim()).filter(Boolean).forEach((name) => {
        certificates.push({ id: `certificate-${Date.now()}-${certificates.length}`, name });
      });
      continue;
    }
    if (line.length < 80 && /驾驶证|普通话.*级|计算机.*级|咨询师证/.test(line)) {
      certificates.push({ id: `certificate-${Date.now()}-${certificates.length}`, name: line });
      continue;
    }

    const skillSource = line.replace(/^(?:技能|专业技能)[：: \t]*/, '');
    const tokens = skillSource.split(/[、,，；;\n]/).map(item => item.trim()).filter(Boolean);
    const looksLikeSkillList = /^(?:技能|专业技能)[：:]/.test(line)
      || (line.length < 120 && !/[。！？]|具备|能够|具有|经验|能力|注重|关注/.test(line));
    if (looksLikeSkillList) {
      tokens.filter((item) => item.length > 1 && item.length < 35 && !/兴趣爱好|爱好|热爱/.test(item)).forEach(addSkill);
    } else {
      const explicitTools = line.match(/\b(?:Office|Excel|PowerPoint|Word|SPSS|Stata|Python|Java|TypeScript|JavaScript|Vue\d*|React|Node\.js|C\+\+)\b/gi) || [];
      explicitTools.forEach((tool) => {
        const levelMatch = line.match(new RegExp(`(精通|熟练|熟悉|了解)(?:使用|运用)?\\s*${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
        addSkill(levelMatch ? `${tool}(${levelMatch[1]})` : tool);
      });
    }
  }

  return {
    certificates,
    hobbies,
    skills: [...skillNames.values()].map((rawName, index) => {
      const level = /精通/i.test(rawName) ? '精通'
        : /熟练|proficient/i.test(rawName) ? '熟练'
          : /熟悉|familiar/i.test(rawName) ? '熟悉'
            : /了解|basic/i.test(rawName) ? '了解' : undefined;
      const name = rawName.replace(/[(（]?(?:精通|熟练|熟悉|了解|proficient|familiar|basic)[)）]?/i, '').trim();
      return { id: `skill-${Date.now()}-${index}`, name: name || rawName, level };
    }),
  };
}

function parseAcademicSection(lines: string[]): AcademicAchievement[] {
  const result: AcademicAchievement[] = [];
  let current: Partial<AcademicAchievement> = {};
  for (const line of lines) {
    const venue = line.match(/^(?:会议名称|会议\/期刊|期刊)[：: \t]*(.+)$/);
    const title = line.match(/^(?:论文|成果)(?:名称|题目)[：: \t]*(.+)$/);
    const authorOrder = line.match(/^作者(?:排序|顺序)[：: \t]*(.+)$/);
    const url = line.match(/^(?:论文|成果)?链接[：: \t]*(.+)$/);
    const abstract = line.match(/^(?:论文)?摘要[：: \t]*(.+)$/);
    if (venue) current.venue = venue[1].trim();
    else if (title) current.title = title[1].trim();
    else if (authorOrder) current.authorOrder = authorOrder[1].trim();
    else if (url) current.url = url[1].trim();
    else if (abstract) current.abstract = abstract[1].trim();
  }
  if (current.title) result.push({ id: `academic-${Date.now()}`, title: current.title, ...current });
  return result;
}

function parseAwardSection(lines: string[]): AwardItem[] {
  const awards: AwardItem[] = [];
  let current: Partial<AwardItem> | null = null;
  const finish = () => {
    if (current?.name) awards.push({ id: `award-${Date.now()}-${awards.length}`, name: current.name, ...current });
    current = null;
  };
  for (const line of lines) {
    const title = line.match(/^\d{1,2}[.、]\s*(?!\d)(.+)$/);
    if (title) {
      finish();
      current = { name: title[1].trim() };
      continue;
    }
    if (!current) continue;
    const value = line.replace(/^[^：:]+[：: \t]*/, '').trim();
    if (/^获奖时间[：:]/.test(line)) {
      current.issueDate = (value.match(/\d{4}/g)?.length || 0) > 1 ? value : normalizeDateString(value);
    }
    else if (/^(?:授奖|奖项)级别[：:]/.test(line)) current.level = value;
    else if (/^获奖等级[：:]/.test(line)) current.grade = value;
    else if (/^项目角色[：:]/.test(line)) current.role = value;
    else if (/^获奖说明[：:]/.test(line)) current.description = value;
  }
  finish();
  const detailedAwards = awards.filter((award) => award.issueDate || award.level || award.grade || award.role || award.description);
  if (detailedAwards.length > 0) return detailedAwards;
  if (awards.length > 0) return awards;

  // 单页 PDF 常把全部荣誉压缩成以分号分隔的连续文本，不再使用编号和明细标签。
  const compactAwards = lines
    .filter(line => !/^(?:证书技能|证书|专业技能|技能)[：:]/.test(line) && !/熟练使用|精通|熟悉使用/.test(line))
    .join(' ')
    .replace(/^.*?荣誉奖项[：:]\s*/, '')
    .split(/[；;]/)
    .map(name => name.replace(/^[，,。\s]+|[，,。\s]+$/g, '').trim())
    .filter(name => name.length > 2 && /奖|荣誉|团员|金奖|银奖|铜奖/.test(name));
  return compactAwards.map((name, index) => ({ id: `award-${Date.now()}-${index}`, name }));
}

function parseCampusSection(lines: string[]): CampusExperience[] {
  const items: CampusExperience[] = [];
  let current: Partial<CampusExperience> | null = null;
  const finish = () => {
    if (current?.organization) {
      items.push({
        id: `campus-${Date.now()}-${items.length}`,
        organization: current.organization,
        title: current.title || '',
        startDate: current.startDate || '',
        endDate: current.endDate || '',
        description: current.description || '',
        responsibility: current.responsibility || '',
      });
    }
    current = null;
  };
  for (const line of lines) {
    const dates = extractDateRange(line);
    if (dates.startDate) {
      const compactRow = line
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, '')
        .replace(/至今|目前|现在|present|to|[-~–—至到]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (compactRow) {
        finish();
        const roleMatch = compactRow.match(/^(.+?)\s+(.+(?:部长|助理|负责人|主席|委员|班长|宣讲员|干事|部员))$/);
        current = {
          organization: (roleMatch?.[1] || compactRow).trim(),
          title: roleMatch?.[2]?.trim() || '',
          startDate: dates.startDate,
          endDate: dates.endDate,
        };
        continue;
      }
    }
    const heading = line.match(/^\d{1,2}[.、]\s*(?!\d)(.+)$/);
    if (heading) {
      finish();
      current = { organization: heading[1].trim() };
      continue;
    }
    if (!current && /大学|学院|研究生会|学生会|党委|团委|班$|社团|协会/.test(line) && !dates.startDate) {
      current = { organization: line.trim() };
      continue;
    }
    if (!current) continue;
    if (/^(?:起止|任职)时间[：:]/.test(line)) {
      current.startDate = dates.startDate;
      current.endDate = dates.endDate;
    } else if (dates.startDate) {
      current.startDate = dates.startDate;
      current.endDate = dates.endDate;
    } else if (/^(?:担任职务|职务|职位)[：:]/.test(line)) {
      current.title = line.replace(/^[^：:]+[：: \t]*/, '').trim();
    } else if (!current.title && line.length < 50) {
      current.title = line.trim();
    } else if (/^经历描述[：:]/.test(line)) {
      current.description = line.replace(/^[^：:]+[：: \t]*/, '').trim();
    } else if (/^主要职责[：:]/.test(line)) {
      current.responsibility = line.replace(/^[^：:]+[：: \t]*/, '').trim();
    } else {
      const descriptionLine = line.replace(/^•\s*/, '').trim();
      current.description = [current.description, descriptionLine].filter(Boolean).join('\n');
    }
  }
  finish();
  return items;
}
