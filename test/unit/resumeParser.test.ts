import { describe, it, expect } from 'vitest';
import { parseResumeFromText } from '@/core/parser/resumeParser';
import { parseResumePayload } from '@/core/schema/resumeSchema';
import { buildResumeKeyOptions } from '@/core/ai/fieldMapper';

describe('ResumeParser (简历语料库解析与时序智能推导引擎)', () => {
  it('未声明的工龄、国家和学习形式保持未知，不能进入 AI 可填候选', () => {
    const parsed = parseResumeFromText('林示例\n教育背景\n2020.09 - 2024.06 示例大学 计算机科学与技术 本科\n工作经历\n2024.07 - 2026.08 示例科技有限公司 前端工程师');
    const resume = parseResumePayload(parsed).resume;
    expect(resume.educations).toHaveLength(1);
    expect(resume.basics.workingYears).toBeUndefined();
    expect(resume.basics.country).toBe('');
    expect(resume.educations[0].isFullTime).toBeUndefined();
    const keys = buildResumeKeyOptions(resume).map((item) => item.resumeKey);
    expect(keys).not.toContain('basics.workingYears');
    expect(keys).not.toContain('basics.country');
    expect(keys).not.toContain('educations.0.isFullTime');
  });

  it('明确的零年经验与非全日制仍然是有效答案', () => {
    const parsed = parseResumeFromText('林示例\n工作年限：0年\n教育背景\n本科 - 示例大学 - 2020.09 - 2024.06 - 软件工程 - 非全日制');
    expect(parsed.basics.workingYears).toBe(0);
    expect(parsed.educations[0].isFullTime).toBe(false);
    expect(buildResumeKeyOptions(parsed).map((item) => item.resumeKey)).toContain('basics.workingYears');
  });
  it('标准中文简历应该能精准提取所有模块字段', () => {
    const rawResumeText = `
      王小明
      手机：13812345678 | 邮箱：xiaoming.wang@example.com | 性别：男
      身份证：110101199806012345 | 生日：1998-06-01 | 政治面貌：中共党员
      籍贯：山东青岛 | 现居地：北京海淀 | 求职意向：前端高级开发工程师

      【教育背景】
      2020.09 - 2023.06 北京航空航天大学 计算机科学与技术 硕士 GPA: 3.85/4.0
      2016.09 - 2020.06 山东大学 软件工程 本科 GPA: 3.7/4.0

      【工作经历】
      2023.07 - 至今 字节跳动科技有限公司 前端研发工程师
      负责抖音前端性能优化架构设计与业务落地。
      2022.06 - 2023.01 阿里巴巴集团 前端实习生
      参与淘天营销活动中台开发。

      【项目经历】
      2023.09 - 2024.03 跨端高性能富文本编辑器研发
      职责：担任核心架构师，使用 WebAssembly 与 TypeScript 打造 60fps 渲染引擎。

      【专业技能】
      Vue3、React、TypeScript、Node.js、WebAssembly、Webpack、Vite

      【自我评价】
      拥有扎实的计算机基础与良好的算法功底，对技术有极高热情。
    `;

    const resume = parseResumeFromText(rawResumeText, '王小明_简历.pdf');

    // 1. 基础信息验证
    expect(resume.basics.name).toBe('王小明');
    expect(resume.basics.phone).toBe('13812345678');
    expect(resume.basics.email).toBe('xiaoming.wang@example.com');
    expect(resume.basics.gender).toBe('男');
    expect(resume.basics.idCardNumber).toBe('110101199806012345');
    expect(resume.basics.birthDate).toBe('1998-06-01');
    expect(resume.basics.politicalStatus).toBe('中共党员');
    expect(resume.basics.nativePlace.city).toBe('山东青岛');
    expect(resume.basics.currentLocation.city).toBe('北京海淀');
    expect(resume.basics.expectedRole).toBe('前端高级开发工程师');

    // 2. 教育经历验证 (验证倒序排序：硕士在首位，本科在第二位)
    expect(resume.educations.length).toBe(2);
    expect(resume.educations[0].schoolName).toBe('北京航空航天大学');
    expect(resume.educations[0].degree).toBe('硕士');
    expect(resume.educations[0].major).toBe('计算机科学与技术');
    expect(resume.educations[0].startDate).toBe('2020-09');
    expect(resume.educations[0].endDate).toBe('2023-06');

    expect(resume.educations[1].schoolName).toBe('山东大学');
    expect(resume.educations[1].degree).toBe('本科');

    // 3. 工作经历验证
    expect(resume.experiences.length).toBe(2);
    expect(resume.experiences[0].company).toBe('字节跳动科技有限公司');
    expect(resume.experiences[0].title).toBe('前端研发工程师');

    // 4. 项目经历验证
    expect(resume.projects.length).toBe(1);
    expect(resume.projects[0].projectName).toBe('跨端高性能富文本编辑器研发');

    // 5. 技能与自我评价
    expect(resume.skills.length).toBeGreaterThanOrEqual(5);
    expect(resume.basics.selfEvaluation).toContain('扎实的计算机基础');
  });

  it('多样化手机号与异构日期格式应能被正确归一化', () => {
    const rawResumeWithMessyFormats = `
      李华
      联系方式：+86 159-8888-9999
      Mail: lihua_tech@gmail.com
      
      【教育经历】
      2019年9月 至 2023年6月 清华大学 自动化 本科
    `;

    const resume = parseResumeFromText(rawResumeWithMessyFormats);

    expect(resume.basics.name).toBe('李华');
    expect(resume.basics.phone).toBe('15988889999');
    expect(resume.basics.email).toBe('lihua_tech@gmail.com');
    expect(resume.educations[0].startDate).toBe('2019-09');
    expect(resume.educations[0].endDate).toBe('2023-06');
  });

  it('面对空文本、乱码或破坏性输入时，应能优雅降级 (Graceful Fallback) 而不崩溃', () => {
    expect(() => parseResumeFromText('')).not.toThrow();
    const emptyResume = parseResumeFromText('');
    expect(emptyResume.basics.name).toBe('');
    expect(emptyResume.educations).toEqual([]);

    expect(() => parseResumeFromText('~~~$$$### 123456 !!! ???')).not.toThrow();
  });

  it('技能熟练度仅在原文明确写明时才提取，未写明时保持空值拒绝盲猜', () => {
    const text = `
      张三
      【专业技能】
      Java(精通)、Python、C++(熟练)、TypeScript
    `;
    const resume = parseResumeFromText(text);
    const java = resume.skills.find(s => s.name === 'Java');
    const python = resume.skills.find(s => s.name === 'Python');
    const cpp = resume.skills.find(s => s.name === 'C++');

    expect(java?.level).toBe('精通');
    expect(python?.level).toBeUndefined(); // 必须为 undefined/未声明，严禁盲猜默认“熟练”
    expect(cpp?.level).toBe('熟练');
  });

  it('纯实习经历不应被错误推算为社招在职，jobStatus 保持干净未填写', () => {
    const text = `
      学生小李
      【工作经历】
      2023.06 - 2023.09 某大厂 实习生
      2024.03 - 2024.07 某独角兽 前端实习
    `;
    const resume = parseResumeFromText(text);
    expect(resume.basics.jobStatus || '').toBe(''); // 绝不被推断为 '在职-考虑机会'
  });

  it('证件类型 idCardType 纯净性：未提取到身份证号时必须保持空字符串，提取到时赋值为身份证', () => {
    const noIdText = `
      李雷
      手机：13900001111
      邮箱：lilei@test.com
    `;
    const noIdResume = parseResumeFromText(noIdText);
    expect(noIdResume.basics.idCardNumber).toBe('');
    expect(noIdResume.basics.idCardType).toBe(''); // 严禁盲赋默认值 '身份证'

    const withIdText = `
      韩梅梅
      身份证：110101199501011234
    `;
    const withIdResume = parseResumeFromText(withIdText);
    expect(withIdResume.basics.idCardNumber).toBe('110101199501011234');
    expect(withIdResume.basics.idCardType).toBe('身份证');
  });

  it('应兼容 Word 转 Markdown 的转义、表格展平和项目内混排校园经历', () => {
    const wordMarkdown = `
__个人信息__

姓名：测试姓名
性别：女
籍贯：辽宁辽阳
出生地：辽宁辽阳
现居住地：辽宁沈阳
四六级成绩：CET4：477          CET6：492
硕士绩点：92\\.18
家庭成员及主要社会关系：
姓名
与本人关系
工作单位及职务
户籍所在地
电话
测试母亲
母女
某单位职员
辽宁省辽阳市
13700000001

__联系方式__
电话：15600000002
邮箱：[test@example\\.com](mailto:test@example.com)

__教育经历__
硕士\\-测试大学\\-2024\\.09\\-2027\\.06\\-国际商务\\-统招全日制
主要课程：计量经济学、战略管理。
本科\\-示例大学\\-2020\\.09\\-2024\\.06\\-市场营销\\-统招全日制

__实习经历__
__示例公司__
人力资源实习生
2024\\.06\\-2024\\.09
1\\. 分类记录候选人基本信息、求职意向及匹配情况。

__项目经历__
__1\\. 用户研究项目__
- __项目起止时间__：2025\\.03—2025年内
- __项目角色__：项目成员
- __项目描述__：完成用户访谈与资料分析。
- __个人职责__：整理访谈信息并输出报告。

__2\\. 流程优化项目__
- __项目起止时间__：2024\\.03—2024\\.09
- __项目角色__：负责人
- __项目描述__：优化业务流程。

__3\\. 测试大学研究生会  学术部部长__
2024\\.10—2026\\.07
负责学术活动组织。

__学术成果__
论文题目：Responsible AI Disclosure and Trust
会议/期刊：示例学术会议
作者顺序：第二作者

__奖项荣誉__
1\\. 全国大学生创新大赛铜奖
获奖时间：2025\\.08
奖项级别：国家级

__学生干部经历__
__测试大学2024级国际商务班__
班长
2024\\.09—至今
负责班级日常管理。

__证书及专业技能__
技能：Office、SPSS、Stata
证书：普通话二级甲等、全国计算机二级
兴趣爱好：羽毛球
`;

    const resume = parseResumeFromText(wordMarkdown, '匿名校招信息库.docx');

    expect(resume.basics.name).toBe('测试姓名');
    expect(resume.basics.phone).toBe('15600000002');
    expect(resume.basics.email).toBe('test@example.com');
    expect(resume.basics.birthPlace?.city).toBe('辽宁辽阳');
    expect(resume.basics.expectedRole).toBe('');
    expect(resume.basics.hobbies).toBe('羽毛球');

    expect(resume.educations).toHaveLength(2);
    expect(resume.educations[0]).toMatchObject({
      schoolName: '测试大学', degree: '硕士', startDate: '2024-09', endDate: '2027-06', gpa: '92.18',
    });
    expect(resume.educations[0].courses).toContain('计量经济学');
    expect(resume.experiences).toHaveLength(1);
    expect(resume.experiences[0].description).toContain('求职意向及匹配情况');

    expect(resume.projects).toHaveLength(2);
    expect(resume.projects[0]).toMatchObject({ projectName: '用户研究项目', startDate: '2025-03', endDate: '2025' });
    expect(resume.projects.map(project => project.projectName)).not.toContain('10—2026.07');

    expect(resume.languages.map(item => [item.certificateName, item.score])).toEqual([
      ['CET-4', '477'],
      ['CET-6', '492'],
    ]);
    expect(resume.familyMembers).toHaveLength(1);
    expect(resume.familyMembers[0]).toMatchObject({ relation: '母亲', hukouLocation: '辽宁省辽阳市' });
    expect(resume.awards).toHaveLength(1);
    expect(resume.academicAchievements).toHaveLength(1);
    expect(resume.campusExperiences).toHaveLength(1);
    expect(resume.certificates.map(item => item.name)).toContain('全国计算机二级');
  });

  it('应识别单页 PDF 的紧凑三列经历、多个项目章节和分号式荣誉列表', () => {
    const pdfLayoutText = `
测试姓名
联系电话：15600000002 邮箱：test@example.com 意向岗位：产品运营、产品经理
出生日期：2001.09.06 籍贯：辽宁沈阳 政治面貌：中共党员
教育背景
2024.09—2027.07 测试大学 国际商务与管理｜应用经济学硕士
专业排名：平均成绩 92.18/100，专业排名 1
核心课程：经济学研究方法论、计量经济学
2020.09—2024.07 示例大学 国际商务｜管理学学士
实习经历
2025.07—2025.09 某市政府 政府见习
•负责基层台账维护与群众接待。
2024.06—2024.09 示例公司 人力资源部实习生
•负责简历筛选与招聘流程跟进。
学生工作经历
2024.10—2026.07 测试大学研究生会 学术科创部部长
•负责校级学术活动组织。
2024.10—2026.07 测试大学党委组织部 部门助理、宣讲员
•负责材料整理与理论宣讲。
科研项目经历
2025.03—2026.02 全国调研课题 项目成员
•承担实地走访、资料收集和报告撰写。
社会实践经历
2025.08—2025.11 “助农项目”|“品牌赋能项目” 项目成员
•参与直播展示与农产品推广。
•协调宣传、调研和文创小组交付。
荣誉奖项与技能
荣誉奖项：研究生一等奖学金；大学生创新大赛省级铜奖；优秀团员荣誉；
证书技能：大学英语四六级；普通话二级甲等；全国计算机二级；
熟练使用 Word、Excel、PowerPoint。
`;

    const resume = parseResumeFromText(pdfLayoutText, '匿名单页简历.pdf');

    expect(resume.basics).toMatchObject({
      name: '测试姓名',
      phone: '15600000002',
      email: 'test@example.com',
      expectedRole: '产品运营、产品经理',
    });
    expect(resume.basics.nativePlace?.city).toBe('辽宁沈阳');
    expect(resume.educations[0]).toMatchObject({
      schoolName: '测试大学', degree: '硕士', major: '国际商务与管理/应用经济学', gpa: '92.18/100',
    });
    expect(resume.experiences).toHaveLength(2);
    expect(resume.experiences[0]).toMatchObject({ company: '某市政府', title: '政府见习', jobType: '实习' });
    expect(resume.campusExperiences).toHaveLength(2);
    expect(resume.projects).toHaveLength(3);
    expect(resume.projects.map(project => project.projectName)).toEqual([
      '“助农项目”',
      '“品牌赋能项目”',
      '全国调研课题',
    ]);
    expect(resume.awards).toHaveLength(3);
    expect(resume.skills.map(skill => skill.name)).toEqual(['Word', 'Excel', 'PowerPoint']);
    expect(resume.certificates.map(item => item.name)).toContain('全国计算机二级');
  });
});
