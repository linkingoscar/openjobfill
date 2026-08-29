/**
 * 标准简历数据模型 (Standard Resume Schema)
 * 适配中国国内校园招聘、社招 ATS (Moka, 北森, 飞书招聘, 用友大易等) 及国际通用招聘表单
 */

export interface LocationInfo {
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
}

export interface EducationExperience {
  id: string;
  schoolName: string;
  degree: '专科' | '本科' | '硕士' | '博士' | '其他';
  degreeEn?: 'Associate' | 'Bachelor' | 'Master' | 'Doctorate' | 'Other';
  major: string;
  majorCategory?: string; // 如：工学、理学、经济学等
  college?: string; // 院系/学院
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM
  gpa?: string; // 如：3.8/4.0
  ranking?: string; // 如：前 5%
  isFullTime?: boolean; // 是否全日制
  isHighest?: boolean; // 是否最高学历
  is985_211?: boolean;
  courses?: string; // 主修课程
  awards?: string; // 在校荣誉
}

export interface WorkExperience {
  id: string;
  company: string;
  department?: string;
  title: string;
  jobType?: '全职' | '实习' | '兼职' | '外包';
  city?: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM 或 '至今'
  isCurrent?: boolean;
  description: string; // 工作内容
  achievements?: string; // 主要成果 / 绩效
  techStack?: string; // 所用技术栈
  witnessName?: string; // 证明人姓名
  witnessPhone?: string; // 证明人电话
}

export interface ProjectExperience {
  id: string;
  projectName: string;
  role: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM 或 '至今'
  projectUrl?: string;
  description: string; // 项目简介
  responsibility: string; // 个人职责
  techStack?: string; // 技术栈
  achievements?: string; // 项目产出
}

export interface LanguageProficiency {
  id: string;
  language: string; // 英语, 日语, 德语 等
  proficiency?: '一般' | '良好' | '熟练' | '精通' | '母语' | '';
  certificateName?: string; // CET-4, CET-6, IELTS, TOEFL
  score?: string; // 如 600, 7.5
}

export interface SkillItem {
  id: string;
  name: string;
  level?: '了解' | '熟悉' | '熟练' | '精通';
}

export interface CertificateItem {
  id: string;
  name: string;
  issueDate?: string;
  authority?: string;
}

export interface FamilyMember {
  id: string;
  relation: string; // 父亲, 母亲, 配偶, 兄弟姐妹
  name: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  politicalStatus?: string;
  hukouLocation?: string; // 户籍所在地 / 常住地
}

/** 校招网申中常见的奖项、奖学金与荣誉称号。 */
export interface AwardItem {
  id: string;
  name: string;
  issueDate?: string;
  level?: string; // 国家级 / 省级 / 校级等
  grade?: string; // 一等奖 / 铜奖 / 荣誉称号等
  role?: string;
  description?: string;
}

/** 论文、会议报告及其他学术成果。 */
export interface AcademicAchievement {
  id: string;
  title: string;
  venue?: string;
  authorOrder?: string;
  url?: string;
  date?: string;
  abstract?: string;
}

/** 学生干部、学生组织及校内任职经历。 */
export interface CampusExperience {
  id: string;
  organization: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  responsibility?: string;
}

export interface CustomQABankItem {
  id: string;
  keyword: string; // 如 "自我评价", "为什么加入我们", "最成功的事", "优缺点"
  answer: string;
  scope?: 'global' | 'domain'; // 作用域：通用 vs 域名专属
  domain?: string; // 专属域名，如 "jobs.bytedance.com"
}

export interface ResumeBasics {
  name: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  preferredName?: string;
  gender?: '男' | '女' | '其他' | '';
  birthDate: string; // YYYY-MM-DD
  age?: number;
  phone: string;
  email: string;
  avatarUrl?: string;
  idCardType?: '身份证' | '护照' | '港澳台通行证' | '其他' | '';
  idCardNumber: string;
  politicalStatus?: '中共党员' | '中共预备党员' | '共青团员' | '群众' | '民主党派' | '其他' | '';
  ethnicity?: string; // 汉族, 满族, 回族 等
  maritalStatus?: '未婚' | '已婚' | '保密' | '';
  height?: string; // 身高 cm
  weight?: string; // 体重 kg
  healthStatus?: '健康' | '良好' | '一般' | '';
  
  // 地理位置
  country?: string; // 国家/地区代码或名称，如 "China", "United States", "CN", "US"
  state?: string; // 州 / 省
  postalCode?: string; // 邮政编码 / Zip Code
  addressLine1?: string; // 街道地址第一行
  addressLine2?: string; // 街道地址第二行
  nativePlace?: LocationInfo; // 籍贯 (省-市-区)
  birthPlace?: LocationInfo; // 出生地
  currentLocation?: LocationInfo; // 现居住地 (省-市-区)
  hukouLocation?: LocationInfo; // 户口所在地
  
  // 国际网申与合规属性 (Workday / Taleo / Greenhouse)
  workAuthorization?: 'US_CITIZEN' | 'PERMANENT_RESIDENT' | 'NEED_SPONSORSHIP' | 'OPT_STEM' | 'OTHER' | string;
  visaSponsorship?: boolean; // 是否需要签证赞助 (Will you require sponsorship?)
  veteranStatus?: string; // 退伍军人状态
  disabilityStatus?: string; // 残障状态
  
  // 求职意向
  workingYears: number; // 工作年限 (0 为应届生)
  jobStatus?: '在职-考虑机会' | '离职-随时到岗' | '应届毕业生' | '在校生找实习' | '';
  expectedRole?: string; // 期望岗位
  expectedCity?: string; // 期望城市
  expectedSalaryMin?: number; // 期望最低薪资 (k)
  expectedSalaryMax?: number; // 期望最高薪资 (k)
  availableTime?: '随时' | '1周内' | '1个月内'; // 到岗时间
  
  // 个人社交 & 作品链接
  githubUrl?: string;
  linkedinUrl?: string;
  blogUrl?: string;
  portfolioUrl?: string;
  
  // 自我评价
  selfEvaluation?: string;
  hobbies?: string; // 兴趣爱好 / 个人特长
}

export interface StandardResume {
  id: string;
  title: string; // 简历标题，如 "前端开发-校招专用", "通用社招简历"
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion?: number; // 架构版本号，当前为 4
  
  basics: ResumeBasics;
  educations: EducationExperience[];
  experiences: WorkExperience[];
  projects: ProjectExperience[];
  languages: LanguageProficiency[];
  skills: SkillItem[];
  certificates: CertificateItem[];
  familyMembers: FamilyMember[];
  awards?: AwardItem[];
  academicAchievements?: AcademicAchievement[];
  campusExperiences?: CampusExperience[];
  qaBank: CustomQABankItem[];
}
