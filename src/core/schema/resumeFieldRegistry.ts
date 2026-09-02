import type { StandardResume } from '../../types/resume';
import type { ClipboardItem } from '../../types/floatingBall';
import { RESUME_DICTIONARY } from '../matcher/dictionary';
import { getValueByPath } from '../../utils/objectPath';

export type ValueKind = 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'ENUM' | 'REGION' | 'PHONE' | 'EMAIL' | 'URL';
export type Sensitivity = 'PUBLIC' | 'PERSONAL' | 'SENSITIVE';
export interface ResumeFieldDefinition {
  path: string;
  label: string;
  group: keyof StandardResume;
  cardinality: 'ONE' | 'MANY';
  valueKind: ValueKind;
  sensitivity: Sensitivity;
  aliases: readonly string[];
  fillable: boolean;
  clipboard: boolean;
  diagnosticExport: boolean;
}

export const RESUME_GROUPS = [
  ['basics', '基本信息', 'ONE'], ['educations', '教育经历', 'MANY'],
  ['experiences', '工作实习', 'MANY'], ['projects', '项目经历', 'MANY'],
  ['languages', '技能证书', 'MANY'], ['skills', '技能证书', 'MANY'],
  ['certificates', '技能证书', 'MANY'], ['familyMembers', '家庭成员', 'MANY'],
  ['awards', '成果荣誉', 'MANY'], ['academicAchievements', '成果荣誉', 'MANY'],
  ['campusExperiences', '校园经历', 'MANY'], ['qaBank', '问答与评价', 'MANY'],
] as const;

// Explicit field ownership: adding a TS property alone never silently exposes it to AI or clipboard.
const FIELDS: Record<typeof RESUME_GROUPS[number][0], Record<string, string>> = {
  basics: {
    name: '姓名', firstName: '名字', lastName: '姓氏', middleName: '中间名', preferredName: '常用名',
    gender: '性别', birthDate: '出生日期', age: '年龄', phone: '手机号码', email: '电子邮箱', avatarUrl: '头像链接',
    idCardType: '证件类型', idCardNumber: '证件号码', politicalStatus: '政治面貌', ethnicity: '民族', maritalStatus: '婚姻状况',
    height: '身高', weight: '体重', healthStatus: '健康状况', country: '国家地区', state: '州省', postalCode: '邮政编码',
    addressLine1: '详细地址', addressLine2: '补充地址', workAuthorization: '工作许可', visaSponsorship: '需要签证赞助',
    veteranStatus: '退伍军人状态', disabilityStatus: '残障状态', workingYears: '工作年限', jobStatus: '求职状态',
    expectedRole: '期望岗位', expectedCity: '期望城市', expectedSalaryMin: '最低期望月薪(k)', expectedSalaryMax: '最高期望月薪(k)',
    availableTime: '到岗时间', githubUrl: 'GitHub', linkedinUrl: 'LinkedIn', blogUrl: '个人博客', portfolioUrl: '作品集',
    selfEvaluation: '自我评价', hobbies: '兴趣爱好', driverLicense: '驾驶执照', acceptOvertime: '接受加班',
    acceptBusinessTrip: '接受出差', adjustable: '接受岗位调剂', cityFlexible: '接受城市调剂', hasRelatives: '公司内有亲属',
    hasPunishment: '有处分记录', emergencyContactName: '紧急联系人姓名', emergencyContactPhone: '紧急联系人电话', emergencyContactRelation: '紧急联系人关系',
    ...Object.fromEntries(['nativePlace:籍贯', 'birthPlace:出生地', 'currentLocation:现居地', 'hukouLocation:户籍地'].flatMap((entry) => {
      const [key, label] = entry.split(':');
      return Object.entries({ province: '省份', city: '城市', district: '区县', detail: '详细地址' }).map(([part, suffix]) => [`${key}.${part}`, `${label}${suffix}`]);
    })),
  },
  educations: { schoolName: '就读学校', degree: '学历', degreeEn: '英文学历', major: '专业', majorCategory: '专业门类', college: '院系', startDate: '入学日期', endDate: '毕业日期', gpa: 'GPA', ranking: '成绩排名', isFullTime: '全日制', isHighest: '最高学历', is985_211: '985/211院校', courses: '主修课程', awards: '在校荣誉' },
  experiences: { company: '公司名称', department: '部门', title: '职位', jobType: '工作性质', city: '工作城市', startDate: '入职日期', endDate: '离职日期', isCurrent: '目前在职', description: '工作内容', achievements: '工作成果', techStack: '技术栈', witnessName: '证明人姓名', witnessPhone: '证明人电话' },
  projects: { projectName: '项目名称', role: '项目角色', startDate: '开始日期', endDate: '结束日期', projectUrl: '项目链接', description: '项目描述', responsibility: '个人职责', techStack: '技术栈', achievements: '项目成果' },
  languages: { language: '语种', proficiency: '语言熟练度', certificateName: '语言考试', score: '考试成绩' },
  skills: { name: '技能名称', level: '技能熟练度' },
  certificates: { name: '证书名称', issueDate: '颁发日期', authority: '颁发机构' },
  familyMembers: { relation: '家属关系', name: '家属姓名', company: '家属工作单位', jobTitle: '家属职位', phone: '家属电话', politicalStatus: '家属政治面貌', hukouLocation: '家属户籍地' },
  awards: { name: '奖项名称', issueDate: '获奖日期', level: '奖项级别', grade: '奖项等级', role: '获奖角色', description: '奖项描述' },
  academicAchievements: { title: '成果标题', venue: '期刊会议', authorOrder: '作者排序', url: '成果链接', date: '发表日期', abstract: '摘要' },
  campusExperiences: { organization: '校园组织', title: '校园职务', startDate: '任职开始', endDate: '任职结束', description: '校园经历描述', responsibility: '校园任职职责' },
  qaBank: { keyword: '问题关键词', answer: '问题答案', scope: '问答作用域', domain: '问答域名' },
};

export function normalizeResumeFieldPath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]').replace(/\.\d+(?=\.|$)/g, '[]');
}

function kindFor(key: string): ValueKind {
  if (/phone$/i.test(key)) return 'PHONE';
  if (key === 'email') return 'EMAIL';
  if (/url$/i.test(key)) return 'URL';
  if (/date$/i.test(key)) return 'DATE';
  if (/^(is[A-Z]|accept|has[A-Z])|^(visaSponsorship|adjustable|cityFlexible)$/.test(key)) return 'BOOLEAN';
  if (/^(age|workingYears|expectedSalaryMin|expectedSalaryMax)$/.test(key)) return 'NUMBER';
  if (/province|city|district|Location|Place/.test(key)) return 'REGION';
  if (/description|responsibility|abstract|answer|selfEvaluation|achievements|courses|hobbies/.test(key)) return 'LONG_TEXT';
  if (/gender|degree|level|proficiency|Status|Type|availableTime/.test(key)) return 'ENUM';
  return 'TEXT';
}

export const RESUME_FIELD_REGISTRY: readonly ResumeFieldDefinition[] = RESUME_GROUPS.flatMap(([group, , cardinality]) =>
  Object.entries(FIELDS[group]).map(([key, label]): ResumeFieldDefinition => {
    const path = `${group}${cardinality === 'MANY' ? '[]' : ''}.${key}`;
    const dictionary = RESUME_DICTIONARY.find((entry) => normalizeResumeFieldPath(entry.resumeKey) === path);
    const sensitivity: Sensitivity = /phone|email|idCardNumber|politicalStatus|ethnicity|healthStatus|disabilityStatus|hasPunishment/i.test(key)
      ? 'SENSITIVE' : 'PERSONAL';
    const fillable = !['scope', 'domain', 'keyword', 'avatarUrl'].includes(key);
    return { path, label, group, cardinality, valueKind: kindFor(key), sensitivity,
      aliases: dictionary?.keywords || [label], fillable, clipboard: fillable,
      diagnosticExport: false };
  }),
);
const FIELD_INDEX = new Map(RESUME_FIELD_REGISTRY.map((field) => [field.path, field]));
export function getResumeFieldDefinition(path: string): ResumeFieldDefinition | undefined {
  return FIELD_INDEX.get(normalizeResumeFieldPath(path));
}

/** Values stay local. AI callers must project only path and label. False and zero are answers. */
export function enumerateResumeFields(resume: StandardResume) {
  return RESUME_FIELD_REGISTRY.flatMap((definition) => {
    const entries = definition.cardinality === 'MANY' ? resume[definition.group] : [resume.basics];
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((_, index) => {
      const path = definition.path.replace('[]', `.${index}`);
      const value = getValueByPath(resume, path);
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return [];
      if (!['string', 'number', 'boolean'].includes(typeof value)) return [];
      return [{ definition, path, value, label: definition.label + (definition.cardinality === 'MANY' ? `(${index + 1})` : '') }];
    });
  });
}

export function buildResumeClipboardItems(resume: StandardResume): ClipboardItem[] {
  const fields: ClipboardItem[] = enumerateResumeFields(resume).filter(({ definition }) => definition.clipboard).map(({ definition, path, label, value }) => ({
    id: path, category: RESUME_GROUPS.find(([group]) => group === definition.group)![1], label,
    value: typeof value === 'boolean' ? (value ? '是' : '否') : String(value),
  }));
  for (const field of fields) {
    const qaIndex = field.id.match(/^qaBank\.(\d+)\.answer$/)?.[1];
    if (qaIndex !== undefined) field.label = `问答: ${resume.qaBank[Number(qaIndex)].keyword}`;
  }
  // Preserve convenient one-click ranges in addition to the individual metadata fields.
  for (const group of ['educations', 'experiences', 'projects'] as const) {
    resume[group]?.forEach((entry, index) => {
      if (!entry.startDate && !entry.endDate) return;
      fields.push({ id: `${group}.${index}.dateRange`, category: RESUME_GROUPS.find(([key]) => key === group)![1], label: `起止时间(${index + 1})`, value: `${entry.startDate || ''} 至 ${entry.endDate || ''}`.trim() });
    });
  }
  return fields;
}
