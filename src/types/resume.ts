/**
 * 标准简历数据模型 (Standard Resume Schema)
 * 适配中国国内校园招聘、社招 ATS 及国际通用招聘表单。
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
  majorCategory?: string;
  college?: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  ranking?: string;
  isFullTime?: boolean;
  isHighest?: boolean;
  is985_211?: boolean;
  courses?: string;
  awards?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  department?: string;
  title: string;
  jobType?: '全职' | '实习' | '兼职' | '外包';
  city?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  description: string;
  achievements?: string;
  techStack?: string;
  witnessName?: string;
  witnessPhone?: string;
}

export interface ProjectExperience {
  id: string;
  projectName: string;
  role: string;
  startDate: string;
  endDate: string;
  projectUrl?: string;
  description: string;
  responsibility: string;
  techStack?: string;
  achievements?: string;
}

export interface LanguageProficiency {
  id: string;
  language: string;
  proficiency?: '一般' | '良好' | '熟练' | '精通' | '母语' | '';
  certificateName?: string;
  score?: string;
}

export interface SkillItem { id: string; name: string; level?: '了解' | '熟悉' | '熟练' | '精通'; }
export interface CertificateItem { id: string; name: string; issueDate?: string; authority?: string; }

export interface FamilyMember {
  id: string;
  relation: string;
  name: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  politicalStatus?: string;
  hukouLocation?: string;
}

export interface AwardItem {
  id: string;
  name: string;
  issueDate?: string;
  level?: string;
  grade?: string;
  role?: string;
  description?: string;
}

export interface AcademicAchievement {
  id: string;
  title: string;
  venue?: string;
  authorOrder?: string;
  url?: string;
  date?: string;
  abstract?: string;
}

export interface CampusExperience {
  id: string;
  organization: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  responsibility?: string;
}

export type QAScope = 'global' | 'job-family' | 'company-domain' | 'job-posting' | 'domain';

export interface QABankAnswerVersion {
  id: string;
  answer: string;
  /** Optional target length. Typical versions are 100/200/500 chars. */
  maxChars?: number;
  createdAt: number;
  lastUsedAt?: number;
  /** Origin only or sanitized page URL; never used as a source of facts. */
  lastUsedUrl?: string;
  confirmedByUser: boolean;
  source: 'manual' | 'ai-confirmed';
}

export interface CustomQABankItem {
  id: string;
  /** Legacy keyword field remains the primary editable question/keyword surface. */
  keyword: string;
  /** Legacy canonical answer; kept for backward compatibility and original-answer display. */
  answer: string;
  question?: string;
  scope?: QAScope;
  /** Legacy domain alias; normalized to companyDomain in v5. */
  domain?: string;
  jobFamily?: string;
  companyDomain?: string;
  jobPostingId?: string;
  versions?: QABankAnswerVersion[];
}

export interface ResumeBasics {
  name: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  preferredName?: string;
  gender?: '男' | '女' | '其他' | '';
  birthDate: string;
  age?: number;
  phone: string;
  email: string;
  avatarUrl?: string;
  idCardType?: '身份证' | '护照' | '港澳台通行证' | '其他' | '';
  idCardNumber: string;
  politicalStatus?: '中共党员' | '中共预备党员' | '共青团员' | '群众' | '民主党派' | '其他' | '';
  ethnicity?: string;
  maritalStatus?: '未婚' | '已婚' | '保密' | '';
  height?: string;
  weight?: string;
  healthStatus?: '健康' | '良好' | '一般' | '';
  country?: string;
  state?: string;
  postalCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  nativePlace?: LocationInfo;
  birthPlace?: LocationInfo;
  currentLocation?: LocationInfo;
  hukouLocation?: LocationInfo;
  workAuthorization?: 'US_CITIZEN' | 'PERMANENT_RESIDENT' | 'NEED_SPONSORSHIP' | 'OPT_STEM' | 'OTHER' | string;
  visaSponsorship?: boolean;
  veteranStatus?: string;
  disabilityStatus?: string;
  workingYears: number;
  jobStatus?: '在职-考虑机会' | '离职-随时到岗' | '应届毕业生' | '在校生找实习' | '';
  expectedRole?: string;
  expectedCity?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  availableTime?: '随时' | '1周内' | '1个月内';
  githubUrl?: string;
  linkedinUrl?: string;
  blogUrl?: string;
  portfolioUrl?: string;
  selfEvaluation?: string;
  hobbies?: string;
  driverLicense?: string;
  acceptOvertime?: boolean;
  acceptBusinessTrip?: boolean;
  adjustable?: boolean;
  cityFlexible?: boolean;
  hasRelatives?: boolean;
  hasPunishment?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface StandardResume {
  id: string;
  title: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion?: number; // Current runtime schema: v5.
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
