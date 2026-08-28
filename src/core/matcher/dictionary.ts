/**
 * 超级字段同义词与关键词词典 (全功能增强版)
 * 支撑通用启发式字段识别、多段经历动态索引映射与跨平台智能匹配
 */

export interface FieldSynonymItem {
  resumeKey: string;
  name: string;
  keywords: string[];
  type?: 'text' | 'select' | 'radio' | 'date' | 'textarea' | 'cascader';
  pattern?: RegExp;
}

// 基础个人字段模板
const BASE_PERSONAL_FIELDS: FieldSynonymItem[] = [
  // 1. 基础个人信息
  {
    resumeKey: 'basics.firstName',
    name: '名字 / First Name',
    keywords: [
      'first name', 'firstname', 'given name', '名', '名字', 'first_name', 'fname', 'userfirstname'
    ],
  },
  {
    resumeKey: 'basics.lastName',
    name: '姓氏 / Last Name',
    keywords: [
      'last name', 'lastname', 'surname', 'family name', '姓', '姓氏', 'last_name', 'lname', 'userlastname'
    ],
  },
  {
    resumeKey: 'basics.name',
    name: '姓名 / Full Name',
    keywords: [
      '姓名', '真实姓名', '中文姓名', '申请人姓名', '候选人姓名', '用户姓名', '本人姓名',
      'name', 'full name', 'fullname', 'candidate name', 'applicant name', 'legal name', 'your name'
    ],
  },
  {
    resumeKey: 'basics.gender',
    name: '性别',
    type: 'radio',
    keywords: ['性别', 'gender', 'sex'],
  },
  {
    resumeKey: 'basics.phone',
    name: '手机号',
    keywords: [
      '手机', '手机号', '手机号码', '联系电话', '联系方式', '电话', '移动电话', '常用电话', '本人电话',
      'phone', 'telephone', 'mobile', 'cellphone', 'mobile phone', 'phone number', 'contact number'
    ],
  },
  {
    resumeKey: 'basics.email',
    name: '电子邮箱',
    keywords: ['邮箱', '电子邮箱', 'email', 'e-mail', 'mail', '电子邮件', '电子信箱', 'email address'],
  },
  {
    resumeKey: 'basics.birthDate',
    name: '出生日期',
    type: 'date',
    keywords: ['出生日期', '出生年月', '生日', '出生时间', '出生', 'birthday', 'birth date', 'dob', 'date of birth'],
  },
  {
    resumeKey: 'basics.idCardType',
    name: '证件类型',
    type: 'select',
    keywords: ['证件类型', '证件种类', 'id type', 'identity type'],
  },
  {
    resumeKey: 'basics.idCardNumber',
    name: '证件号码 / 身份证',
    keywords: [
      '身份证', '身份证号', '身份证号码', '证件号码', '证件号', '居民身份证', '证件号/身份证号',
      'id card', 'id number', 'identification number', 'national id'
    ],
  },
  {
    resumeKey: 'basics.politicalStatus',
    name: '政治面貌',
    type: 'select',
    keywords: ['政治面貌', '党派', '政治背景', '政治身份', 'political status', 'political affiliation'],
  },
  {
    resumeKey: 'basics.ethnicity',
    name: '民族',
    type: 'select',
    keywords: ['民族', '国籍民族', '族别', 'ethnicity', 'ethnic group', 'race'],
  },
  {
    resumeKey: 'basics.maritalStatus',
    name: '婚姻状况',
    type: 'select',
    keywords: ['婚姻状况', '婚否', '婚姻', '婚育状况', 'marital status', 'marriage status'],
  },
  {
    resumeKey: 'basics.height',
    name: '身高',
    keywords: ['身高', 'height', 'height(cm)', '身高(cm)', '身高（cm）'],
  },
  {
    resumeKey: 'basics.weight',
    name: '体重',
    keywords: ['体重', 'weight', 'weight(kg)', '体重(kg)', '体重（kg）'],
  },
  {
    resumeKey: 'basics.healthStatus',
    name: '健康状况',
    type: 'select',
    keywords: ['健康状况', '身体状况', '健康情况', 'health condition', 'health status'],
  },

  // 2. 地理位置与户籍
  {
    resumeKey: 'basics.nativePlace.city',
    name: '籍贯 / 生源地',
    type: 'cascader',
    keywords: ['籍贯', '生源地', '家乡', '籍贯所在地', 'native place', 'birthplace', 'place of origin'],
  },
  {
    resumeKey: 'basics.currentLocation.city',
    name: '现居住地 / 居住城市',
    type: 'cascader',
    keywords: ['现居住地', '目前所在地', '现居城市', '居住地址', '通讯地址', '现住址', '居住地', 'current location', 'address', 'city', 'location'],
  },
  {
    resumeKey: 'basics.hukouLocation.city',
    name: '户口所在地',
    type: 'cascader',
    keywords: ['户口', '户籍', '户籍所在地', '户口所在地', '户口地', 'hukou', 'registered residence'],
  },

  // 3. 求职意向与社交链接
  {
    resumeKey: 'basics.expectedRole',
    name: '期望职位 / 应聘岗位',
    keywords: ['期望职位', '期望岗位', '应聘职位', '意向职位', '应聘岗位', '目标职位', '求职意向', 'target position', 'expected role', 'desired position', 'job title'],
  },
  {
    resumeKey: 'basics.expectedCity',
    name: '期望城市 / 工作地点',
    keywords: ['期望城市', '意向城市', '期望工作地点', '目标城市', '工作地点', '期望地点', 'expected city', 'preferred location', 'target city'],
  },
  {
    resumeKey: 'basics.expectedSalaryMin',
    name: '期望薪资',
    keywords: ['期望薪资', '期望月薪', '期望年薪', '期望待遇', 'expected salary', 'desired salary'],
  },
  {
    resumeKey: 'basics.workingYears',
    name: '工作年限',
    keywords: ['工作年限', '工作经验', '工龄', '几年经验', 'years of experience', 'experience years'],
  },
  {
    resumeKey: 'basics.jobStatus',
    name: '求职状态',
    type: 'select',
    keywords: ['求职状态', '目前状态', '在职状态', '当前状态', 'job status', 'current status'],
  },
  {
    resumeKey: 'basics.availableTime',
    name: '到岗时间',
    type: 'select',
    keywords: ['到岗时间', '入职时间', '何时到岗', '可到岗时间', 'notice period', 'availability', 'start date'],
  },
  {
    resumeKey: 'basics.githubUrl',
    name: 'GitHub 链接',
    keywords: ['github', 'github url', 'git', '代码仓库', '开源主页'],
  },
  {
    resumeKey: 'basics.linkedinUrl',
    name: 'LinkedIn 领英主页',
    keywords: ['linkedin', '领英', 'linkedin url', 'linkedin profile'],
  },
  {
    resumeKey: 'basics.blogUrl',
    name: '个人博客 / 网站',
    keywords: ['博客', '个人网站', '个人主页', '作品集链接', 'blog', 'personal website', 'website', 'portfolio url'],
  },
  {
    resumeKey: 'basics.selfEvaluation',
    name: '自我评价 / 个人优势',
    type: 'textarea',
    keywords: ['自我评价', '自我介绍', '个人总结', '关于我', '个人优势', '自我描述', 'self evaluation', 'self assessment', 'about me', 'summary', 'bio'],
  },
];

/**
 * 动态生成支持多段经历 (0..maxIndex) 的词典项
 */
export function generateExperienceDictionary(maxIndex = 4): FieldSynonymItem[] {
  const result: FieldSynonymItem[] = [];

  for (let i = 0; i <= maxIndex; i++) {
    const idxLabel = i > 0 ? `(第${i + 1}段)` : '';

    // 教育经历
    result.push(
      {
        resumeKey: `educations.${i}.schoolName`,
        name: `毕业院校 ${idxLabel}`.trim(),
        keywords: ['学校', '毕业院校', '毕业学校', '大学', '就读学校', '最高学历学校', '本科院校', '研究生院校', 'school', 'university', 'college', 'institution'],
      },
      {
        resumeKey: `educations.${i}.degree`,
        name: `学历学位 ${idxLabel}`.trim(),
        type: 'select',
        keywords: ['学历', '学位', '最高学历', '文化程度', '学历层次', 'degree', 'education level', 'highest degree'],
      },
      {
        resumeKey: `educations.${i}.major`,
        name: `专业名称 ${idxLabel}`.trim(),
        keywords: ['专业', '所学专业', '专业名称', '主修专业', 'major', 'field of study', 'discipline', 'course of study'],
      },
      {
        resumeKey: `educations.${i}.college`,
        name: `院系学院 ${idxLabel}`.trim(),
        keywords: ['学院', '院系', '系别', '二级学院', 'department', 'faculty', 'school/department'],
      },
      {
        resumeKey: `educations.${i}.startDate`,
        name: `就读开始时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['入学时间', '就读开始时间', '入学年月', '学习开始时间', 'education start date', 'start year/month'],
      },
      {
        resumeKey: `educations.${i}.endDate`,
        name: `毕业时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['毕业时间', '毕业年月', '预计毕业时间', '就读结束时间', 'education end date', 'graduation date', 'expected graduation'],
      },
      {
        resumeKey: `educations.${i}.gpa`,
        name: `GPA成绩 ${idxLabel}`.trim(),
        keywords: ['gpa', '成绩', '学分绩点', '平均绩点', '成绩排名', 'grade point average', 'rank'],
      },
      {
        resumeKey: `educations.${i}.courses`,
        name: `主修课程 ${idxLabel}`.trim(),
        type: 'textarea',
        keywords: ['主修课程', '核心课程', '主修科目', 'courses', 'main courses'],
      }
    );

    // 工作与实习经历
    result.push(
      {
        resumeKey: `experiences.${i}.company`,
        name: `公司名称 ${idxLabel}`.trim(),
        keywords: ['公司', '公司名称', '单位名称', '实习单位', '最近任职单位', '就职企业', '工作单位', 'company', 'employer', 'organization'],
      },
      {
        resumeKey: `experiences.${i}.title`,
        name: `职位名称 ${idxLabel}`.trim(),
        keywords: ['职位', '职位名称', '岗位', '职务', '任职岗位', 'title', 'job title', 'position', 'role'],
      },
      {
        resumeKey: `experiences.${i}.department`,
        name: `所属部门 ${idxLabel}`.trim(),
        keywords: ['部门', '所属部门', '任职部门', 'department'],
      },
      {
        resumeKey: `experiences.${i}.startDate`,
        name: `工作开始时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['工作开始时间', '入职时间', '工作起始时间', '任职开始时间', 'work start date'],
      },
      {
        resumeKey: `experiences.${i}.endDate`,
        name: `工作结束时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['工作结束时间', '离职时间', '工作截止时间', '任职结束时间', 'work end date'],
      },
      {
        resumeKey: `experiences.${i}.description`,
        name: `工作内容描述 ${idxLabel}`.trim(),
        type: 'textarea',
        keywords: ['工作内容', '工作描述', '职责描述', '实习内容', '主要职责', '工作业绩', '工作成就', 'job description', 'responsibilities', 'work summary'],
      }
    );

    // 项目经历
    result.push(
      {
        resumeKey: `projects.${i}.projectName`,
        name: `项目名称 ${idxLabel}`.trim(),
        keywords: ['项目名称', '项目', '参与项目', '项目名', 'project name', 'project title'],
      },
      {
        resumeKey: `projects.${i}.role`,
        name: `项目角色 ${idxLabel}`.trim(),
        keywords: ['项目角色', '担任角色', '项目职位', '项目职责', 'project role', 'role in project'],
      },
      {
        resumeKey: `projects.${i}.startDate`,
        name: `项目开始时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['项目开始时间', '项目起始时间', 'project start date'],
      },
      {
        resumeKey: `projects.${i}.endDate`,
        name: `项目结束时间 ${idxLabel}`.trim(),
        type: 'date',
        keywords: ['项目结束时间', '项目截止时间', 'project end date'],
      },
      {
        resumeKey: `projects.${i}.description`,
        name: `项目描述 ${idxLabel}`.trim(),
        type: 'textarea',
        keywords: ['项目描述', '项目简介', '项目内容', '项目背景', '项目介绍', 'project description', 'project summary'],
      },
      {
        resumeKey: `projects.${i}.responsibility`,
        name: `个人职责 ${idxLabel}`.trim(),
        type: 'textarea',
        keywords: ['个人职责', '项目职责', '负责内容', 'responsibilities'],
      },
      {
        resumeKey: `projects.${i}.techStack`,
        name: `技术栈 ${idxLabel}`.trim(),
        keywords: ['技术栈', '涉及技术', '所用技术', 'tech stack', 'technologies'],
      }
    );

    // 语言与证书
    result.push(
      {
        resumeKey: `languages.${i}.score`,
        name: `外语成绩 ${idxLabel}`.trim(),
        keywords: ['英语成绩', '六级成绩', '四级成绩', 'cet6', 'cet-6', 'cet4', 'cet-4', '雅思', '托福', 'english score', 'language score'],
      },
      {
        resumeKey: `certificates.${i}.name`,
        name: `证书名称 ${idxLabel}`.trim(),
        keywords: ['证书', '职业证书', '荣誉证书', '资格证书', 'certificate', 'certification'],
      }
    );

    // 家庭成员 / 紧急联系人
    result.push(
      {
        resumeKey: `familyMembers.${i}.name`,
        name: `联系人姓名 ${idxLabel}`.trim(),
        keywords: ['紧急联系人', '联系人姓名', '家属姓名', '亲属姓名', '紧急联系人姓名', 'emergency contact', 'contact person'],
      },
      {
        resumeKey: `familyMembers.${i}.relation`,
        name: `联系人关系 ${idxLabel}`.trim(),
        keywords: ['与本人关系', '关系', '亲属关系', 'relationship', 'relation'],
      },
      {
        resumeKey: `familyMembers.${i}.phone`,
        name: `联系人电话 ${idxLabel}`.trim(),
        keywords: ['紧急联系人电话', '联系人电话', '家属电话', '亲属电话', 'emergency contact phone'],
      }
    );
  }

  return result;
}

export const RESUME_DICTIONARY: FieldSynonymItem[] = [
  ...BASE_PERSONAL_FIELDS,
  ...generateExperienceDictionary(4),
];

