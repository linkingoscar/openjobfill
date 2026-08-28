import type { StandardResume, EducationExperience, WorkExperience, ProjectExperience, SkillItem } from '../../types/resume';

/**
 * 智能中文简历文本结构化解析引擎
 * 基于多层启发式分块、正则表达式与关键词识别，将非结构化简历文本转换为 StandardResume 数据模型
 */
export function parseResumeFromText(rawText: string, resumeTitle = '解析导入简历'): StandardResume {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const resume: StandardResume = {
    id: 'resume-' + Date.now(),
    title: resumeTitle,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    basics: {
      name: '',
      gender: '男',
      birthDate: '',
      phone: '',
      email: '',
      idCardType: '身份证',
      idCardNumber: '',
      politicalStatus: '群众',
      ethnicity: '汉族',
      maritalStatus: '未婚',
      nativePlace: { province: '', city: '' },
      currentLocation: { province: '', city: '' },
      workingYears: 0,
      jobStatus: '应届毕业生',
      expectedRole: '',
      selfEvaluation: '',
    },
    educations: [],
    experiences: [],
    projects: [],
    skills: [],
    languages: [],
    certificates: [],
    familyMembers: [],
    qaBank: [],
  };

  // 1. 提取手机号 (1[3-9]\d{9}，支持带横杠或空格)
  const phoneMatch = text.match(/(?:\+?86[- ]?)?(1[3-9]\d{1}[- ]?\d{4}[- ]?\d{4})/);
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
  const nativeMatch = text.match(/(?:籍\s*贯|生源地|户籍地)[：:\s]*([\u4e00-\u9fa5]{2,12})/);
  if (nativeMatch) {
    const loc = nativeMatch[1];
    resume.basics.nativePlace = { province: '', city: loc };
  }

  const currentLocMatch = text.match(/(?:现居住地|现居地|目前所在地|常住城市|现居|所在地)[：:\s]*([\u4e00-\u9fa5]{2,12})/);
  if (currentLocMatch) {
    resume.basics.currentLocation = { province: '', city: currentLocMatch[1] };
  }

  // 9. 提取期望职位 / 求职意向
  const roleMatch = text.match(/(?:求职意向|期望职位|意向岗位|应聘岗位|目标职位)[：:\s]*([^\n|，,]+)/);
  if (roleMatch) {
    resume.basics.expectedRole = roleMatch[1].trim();
  }

  // 10. 提取姓名 (通常位于文档前 5 行，且为 2-4 字纯中文，排除“简历/个人信息”等噪音词)
  const namePatternMatch = text.match(/(?:姓\s*名)[：:\s]*([\u4e00-\u9fa5]{2,4})/);
  if (namePatternMatch) {
    resume.basics.name = namePatternMatch[1];
  } else {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].replace(/[^\u4e00-\u9fa5]/g, '');
      const noisyWords = ['个人简历', '求职简历', '简历', '个人信息', '基本信息', '求职意向'];
      if (line.length >= 2 && line.length <= 4 && !noisyWords.some(w => line.includes(w))) {
        resume.basics.name = line;
        break;
      }
    }
  }

  // 11. 智能分块切分 (按大标题识别，支持 Markdown ##、序号【】、符号★等)
  const sectionKeywords = [
    { type: 'education', headers: ['教育背景', '教育经历', '学习经历', '教育信息', '学历经历', '教育与培训', '学历信息', 'education'] },
    { type: 'experience', headers: ['工作经历', '工作经验', '实习经历', '实习经验', '工作与实习', '工作及实习经历', '实习工作经历', '职业经历', '从业经历', '实践经历', 'experience', 'work experience', 'internship'] },
    { type: 'projects', headers: ['项目经历', '项目经验', '重点项目', '主要项目', '个人项目', '项目实践', 'projects', 'project experience'] },
    { type: 'skills', headers: ['专业技能', '技能特长', '技能清单', 'it技能', '个人技能', '技能证书', '技术栈', '主要技能', 'skills', 'technical skills'] },
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
      resume.educations = parseEducationSection(sec.content);
    } else if (sec.type === 'experience') {
      resume.experiences = parseExperienceSection(sec.content);
    } else if (sec.type === 'projects') {
      resume.projects = parseProjectSection(sec.content);
    } else if (sec.type === 'skills') {
      const skillsStr = sec.content.join('\n');
      const skillNames = skillsStr
        .split(/[、,，;\n]/)
        .map(s => s.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter(s => s.length > 1 && s.length < 30);
      
      resume.skills = skillNames.map((name, i) => ({
        id: 'skill-' + i + '-' + Date.now(),
        name,
        level: '熟练',
      }));
    } else if (sec.type === 'summary') {
      resume.basics.selfEvaluation = sec.content.join('\n').trim();
    }
  }

  // 13. 时序自动归一化与工龄自动推导 (科研级倒序排序与工龄计算)
  if (resume.educations.length > 0) {
    resume.educations.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }
  if (resume.experiences.length > 0) {
    resume.experiences.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    
    // 自动计算工龄 (Earliest Start Date 到当前年份)
    const startYears = resume.experiences.map(e => parseInt(e.startDate?.slice(0, 4) || '0')).filter(y => y > 1990);
    if (startYears.length > 0) {
      const earliestYear = Math.min(...startYears);
      const currentYear = new Date().getFullYear();
      const years = Math.max(0, currentYear - earliestYear);
      resume.basics.workingYears = years;
      if (years > 0) {
        resume.basics.jobStatus = '在职-考虑机会';
      }
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
  const dateRegex = /(\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?)\s*(?:[-~–—至到]|to)\s*(\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?|至今|目前|现在|present)/i;
  const match = text.match(dateRegex);
  if (match) {
    return {
      startDate: normalizeDateString(match[1]),
      endDate: match[2].includes('至今') || match[2].toLowerCase().includes('present') ? '至今' : normalizeDateString(match[2]),
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

  for (const line of lines) {
    const dates = extractDateRange(line);
    const hasSchool = schoolKeywords.some(kw => line.includes(kw));

    if (dates.startDate || hasSchool) {
      if (currentEdu && (currentEdu.schoolName || currentEdu.major)) {
        educations.push(fillDefaultEdu(currentEdu));
      }
      currentEdu = {
        id: 'edu-' + Date.now() + '-' + educations.length,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };

      const cleanEduLine = line
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, '')
        .replace(/[-~–—至到]|to|至今|目前|现在|present/gi, '');
      const parts = cleanEduLine.split(/[\s|·,\t]+/).filter(Boolean);
      for (const p of parts) {
        if (schoolKeywords.some(kw => p.includes(kw))) {
          currentEdu.schoolName = p.trim();
        }
      }
    }

    if (currentEdu) {
      for (const deg of degreeKeywords) {
        if (deg.words.some(w => line.includes(w))) {
          currentEdu.degree = deg.name;
          break;
        }
      }

      const majorMatch = line.match(/(?:专业|主修)[：:\s]*([^\s|·,]+)/);
      if (majorMatch) {
        currentEdu.major = majorMatch[1];
      } else if (!currentEdu.major) {
        const majorTokens = line.split(/[\s|·,\t]+/);
        for (const token of majorTokens) {
          if (/工程|科学|技术|管理|设计|金融|自动化|经济|文学|商务|信息|软件|计算机/.test(token) &&
              !schoolKeywords.some(sk => token.includes(sk)) &&
              !degreeKeywords.some(dk => dk.words.some(w => token.includes(w)))) {
            currentEdu.major = token;
          }
        }
      }

      const gpaMatch = line.match(/GPA[：:\s]*([\d\.]+(?:\/[\d\.]+)?)/i);
      if (gpaMatch) {
        currentEdu.gpa = gpaMatch[1];
      }
    }
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
    isFullTime: true,
  };
}

/** 解析工作/实习经历分块 */
function parseExperienceSection(lines: string[]): WorkExperience[] {
  const experiences: WorkExperience[] = [];
  let currentExp: Partial<WorkExperience> | null = null;
  const descLines: string[] = [];

  for (const line of lines) {
    const dates = extractDateRange(line);
    const hasCompanySignal = /公司|科技|网络|技术|集团|实验室|有限|工作室|研发中心|Inc|Corp|Ltd/.test(line);

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
        .replace(/[-~–—至到]|to|至今|目前|现在|present/gi, '');
      const tokens = cleanExpLine.split(/[\s|·,\t]+/).filter(Boolean);
      for (const t of tokens) {
        if (hasCompanySignal && (!currentExp.company || currentExp.company.length < t.length)) {
          currentExp.company = t.trim();
        } else if (/工程师|开发|专员|助理|实习生|前端|后端|算法|产品|主管|经理|架构师|顾问/.test(t)) {
          currentExp.title = t.trim();
        }
      }
    } else if (currentExp) {
      const titleMatch = line.match(/(?:职位|岗位|职务)[：:\s]*([^\s|·,]+)/);
      if (titleMatch) {
        currentExp.title = titleMatch[1];
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
  };
}

/** 解析项目经历分块 */
function parseProjectSection(lines: string[]): ProjectExperience[] {
  const projects: ProjectExperience[] = [];
  let currentProj: Partial<ProjectExperience> | null = null;
  const descLines: string[] = [];

  for (const line of lines) {
    const dates = extractDateRange(line);
    const isProjectHeader = dates.startDate || /^(?:###|##|\*\*|【|项目名称|项目：|项目:)/.test(line.trim());

    if (isProjectHeader) {
      if (currentProj && currentProj.projectName) {
        currentProj.description = descLines.join('\n').trim();
        projects.push(fillDefaultProj(currentProj));
        descLines.length = 0;
      }

      currentProj = {
        id: 'proj-' + Date.now() + '-' + projects.length,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };

      const cleanTitleLine = line
        .replace(/^[#*`\s【】[\]\-]+/g, '')
        .replace(/[*`【】[\]]/g, '')
        .replace(/\d{4}[年\-\./]\d{1,2}(?:[月\-\./]\d{1,2})?日?月?/g, '')
        .replace(/[-~–—至到]|to|至今|目前|现在|present/gi, '');
      const tokens = cleanTitleLine.split(/[\s|·,\t]+/).filter(Boolean);
      for (const t of tokens) {
        if (!currentProj.projectName && t.length > 2 && !/^(?:项目|经历|时间|职责|业绩)/.test(t) && !/^\d+$/.test(t)) {
          currentProj.projectName = t.trim();
        }
      }
    } else if (currentProj) {
      const roleMatch = line.match(/(?:角色|担任角色|职责)[：:\s]*([^\s|·,]+)/);
      const techMatch = line.match(/(?:技术栈|技术|使用技术)[：:\s]*([^\n]+)/);
      if (roleMatch) {
        currentProj.role = roleMatch[1];
      } else if (techMatch) {
        currentProj.techStack = techMatch[1];
      } else {
        descLines.push(line);
      }
    }
  }

  if (currentProj && currentProj.projectName) {
    currentProj.description = descLines.join('\n').trim();
    projects.push(fillDefaultProj(currentProj));
  }

  return projects;
}

function fillDefaultProj(item: Partial<ProjectExperience>): ProjectExperience {
  return {
    id: item.id || 'proj-' + Math.random().toString(36).slice(2, 8),
    projectName: item.projectName || '未命名项目',
    role: item.role || '核心成员',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    description: item.description || '',
    responsibility: '负责核心功能模块设计与开发实现',
    techStack: item.techStack || '',
  };
}
