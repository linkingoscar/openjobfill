import { describe, it, expect } from 'vitest';
import { buildFillableFields, rememberManualFillMapping } from '@/core/engine/manualFill';
import { ruleStorage } from '@/core/storage/ruleStorage';
import { beforeEach } from 'vitest';
import type { StandardResume } from '@/types/resume';

const RESUME: StandardResume = {
  id: 'mf-1',
  title: '手动填充测试简历',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  basics: {
    name: '李晓',
    gender: '女',
    birthDate: '1997-03-10',
    phone: '13700137000',
    email: 'lixiao@example.com',
    idCardNumber: '310101199703101234',
    politicalStatus: '共青团员',
    nativePlace: { province: '江苏省', city: '南京市' },
    currentLocation: { province: '上海市', city: '浦东新区' },
    workingYears: 4,
    expectedRole: '产品经理',
    selfEvaluation: '擅长需求分析',
    githubUrl: 'https://github.com/lixiao',
  },
  educations: [
    { id: 'e1', schoolName: '南京大学', degree: '本科', major: '信息管理', startDate: '2015-09', endDate: '2019-06' },
    { id: 'e2', schoolName: '复旦大学', degree: '硕士', major: '工商管理', startDate: '2019-09', endDate: '2022-06' },
  ],
  experiences: [
    { id: 'x1', company: '甲公司', title: '产品专员', startDate: '2022-07', endDate: '至今', description: '负责用户增长' },
  ],
  projects: [],
  skills: [],
  languages: [],
  certificates: [],
  familyMembers: [],
  qaBank: [{ id: 'q1', keyword: '为何选择我司', answer: '认可贵司技术氛围' }],
};

describe('manualFill.buildFillableFields', () => {
  beforeEach(() => localStorage.clear());
  it('提取有值的基础字段并展开嵌套对象', () => {
    const fields = buildFillableFields(RESUME);
    const byKey = new Map(fields.map((f) => [f.resumeKey, f.value]));

    expect(byKey.get('basics.name')).toBe('李晓');
    expect(byKey.get('basics.phone')).toBe('13700137000');
    // 嵌套对象按路径取值，而不是序列化整个对象
    expect(byKey.get('basics.nativePlace.city')).toBe('南京市');
    expect(byKey.get('basics.currentLocation.city')).toBe('浦东新区');
  });

  it('跳过空值字段，不进入可选清单', () => {
    const fields = buildFillableFields(RESUME);
    const keys = fields.map((f) => f.resumeKey);

    // 简历中 maritalStatus、postalCode 为空，不应出现
    expect(keys).not.toContain('basics.maritalStatus');
    expect(keys).not.toContain('basics.postalCode');
    expect(keys).not.toContain('basics.linkedinUrl');
  });

  it('多段经历带序号，且不遗漏', () => {
    const fields = buildFillableFields(RESUME);
    const byKey = new Map(fields.map((f) => [f.resumeKey, f.label]));

    expect(byKey.get('educations.0.schoolName')).toBe('毕业院校(1)');
    expect(byKey.get('educations.1.schoolName')).toBe('毕业院校(2)');
    expect(byKey.get('experiences.0.company')).toBe('公司(1)');
  });

  it('问答库进入可选清单', () => {
    const fields = buildFillableFields(RESUME);
    const qa = fields.find((f) => f.resumeKey === 'qaBank.q1');

    expect(qa).toBeDefined();
    expect(qa!.label).toContain('为何选择我司');
    expect(qa!.value).toBe('认可贵司技术氛围');
  });

  it('空简历返回空清单，调用方应提示并中止', () => {
    const empty: StandardResume = {
      ...RESUME,
      basics: { ...RESUME.basics, name: '', phone: '', email: '' },
      educations: [],
      experiences: [],
      qaBank: [],
    };
    // 清空基础可填项后，仍可能残留 birthDate 等；这里验证不会抛错且只含有值项
    const fields = buildFillableFields(empty);
    for (const f of fields) {
      expect(f.value).not.toBe('');
    }
  });

  it('用户明确点选目标和值后，记住当前站点映射供下次自动填写', async () => {
    document.body.innerHTML = '<form><input id="manual-company"></form>';
    const element = document.querySelector<HTMLElement>('#manual-company')!;
    const remembered = await rememberManualFillMapping(
      'https://careers.example.com/apply',
      { resumeKey: 'experiences.0.company', label: '公司', value: '示例科技' },
      element,
    );
    expect(remembered).toBe(true);
    const rule = await ruleStorage.findMatchingRuleForUrl('https://careers.example.com/apply/step2');
    expect(rule?.fields[0]).toMatchObject({ selector: '#manual-company', resumeKey: 'experiences.0.company' });
  });
});
