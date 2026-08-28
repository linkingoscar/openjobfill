import { describe, it, expect, beforeEach } from 'vitest';
import { planGenerator, hasUsableValue } from '@/core/pipeline/planGenerator';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { setRadioGroupValue, setNativeCheckboxChecked, parseBoolean } from '@/core/engine/dispatcher';
import { parseResumeFromText } from '@/core/parser/resumeParser';
import { sectionEngine } from '@/core/engine/sectionEngine';
import type { PlatformEnhancer, FieldDescriptor } from '@/types/pipeline';
import type { StandardResume } from '@/types/resume';

const BASE_MOCK_RESUME: StandardResume = {
  id: 'prec-1',
  title: '精准测试简历',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  basics: {
    name: '李小龙',
    gender: '男',
    birthDate: '1995-11-27',
    phone: '13911112222',
    email: 'bruce@example.com',
    idCardType: '身份证',
    idCardNumber: '110101199511271234',
    politicalStatus: '中共党员',
    ethnicity: '汉族',
    maritalStatus: '未婚',
    nativePlace: { province: '广东省', city: '佛山市' },
    currentLocation: { province: '北京市', city: '海淀区' },
    workingYears: 5,
    jobStatus: '在职-看机会',
    expectedRole: '架构师',
    selfEvaluation: '',
  },
  educations: [],
  experiences: [],
  projects: [],
  skills: [],
  languages: [],
  certificates: [],
  familyMembers: [],
  qaBank: [
    {
      id: 'qa-name-conflict',
      keyword: '真实姓名, 候选人姓名',
      answer: '李小龙 (问答库)',
    },
  ],
};

describe('Precision Engine & Anti-False-Positive Test Suite (精准决策与防误填专项测试)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('1. hasUsableValue 统一门禁与 Plan 拦截', () => {
    it('hasUsableValue 必须正确判定有效值与无效假值', () => {
      expect(hasUsableValue(undefined)).toBe(false);
      expect(hasUsableValue(null)).toBe(false);
      expect(hasUsableValue('')).toBe(false);
      expect(hasUsableValue('   ')).toBe(false);

      expect(hasUsableValue(0)).toBe(true);
      expect(hasUsableValue(false)).toBe(true);
      expect(hasUsableValue('0')).toBe(true);
      expect(hasUsableValue('否')).toBe(true);
      expect(hasUsableValue('男')).toBe(true);
    });

    it('当简历字段为未知空串（如 gender = ""）时，绝不能生成 action: FILL 的规划项', () => {
      const input = document.createElement('input');
      input.name = 'gender';
      document.body.appendChild(input);

      const field: FieldDescriptor = {
        id: 'f_gender',
        element: input,
        type: 'text',
        label: '性别',
        placeholder: '请输入性别',
        name: 'gender',
        ariaLabel: '',
        required: true,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const resumeWithEmptyGender: StandardResume = {
        ...BASE_MOCK_RESUME,
        basics: {
          ...BASE_MOCK_RESUME.basics,
          gender: '', // 未知留空
        },
      };

      const plan = planGenerator.generatePlan([field], resumeWithEmptyGender);
      const fillItem = plan.items.find((p) => p.semanticKey === 'basics.gender');
      expect(fillItem).toBeUndefined(); // 绝不生成 FILL
    });
  });

  describe('2. Plan Deduplication (防止平台映射后产生重复 PlanItem)', () => {
    it('命中平台专属规则的字段，严禁再被问答库或通用语义生成第二个 PlanItem', () => {
      const input = document.createElement('input');
      input.className = 'moka-candidate-name-input';
      input.name = 'candidateName';
      document.body.appendChild(input);

      const field: FieldDescriptor = {
        id: 'f_dup_test',
        element: input,
        type: 'text',
        label: '真实姓名',
        placeholder: '请输入候选人姓名',
        name: 'candidateName',
        ariaLabel: '',
        required: true,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const testEnhancer: PlatformEnhancer = {
        id: 'test-enhancer',
        name: '测试增强器',
        priority: 100,
        matches: () => true,
        fieldMappings: {
          '.moka-candidate-name-input': 'basics.name',
        },
      };

      const plan = planGenerator.generatePlan([field], BASE_MOCK_RESUME, testEnhancer);

      // 验证 PlanItems 列表中针对该字段有且仅有 1 项
      expect(plan.items.length).toBe(1);
      expect(plan.items[0].source).toBe('platform_rule');
      expect(plan.items[0].targetValue).toBe('李小龙');
    });
  });

  describe('3. Radio Group 严格匹配 (严禁找不到选项时盲选当前 Radio)', () => {
    it('面对同名性别单选框组，setRadioGroupValue 应能根据目标值准确定位并勾选目标单选框', () => {
      document.body.innerHTML = `
        <div class="form-item gender-group">
          <label>性别</label>
          <label class="radio-label">
            <input type="radio" name="gender" value="M" checked /> 男
          </label>
          <label class="radio-label">
            <input type="radio" name="gender" value="F" /> 女
          </label>
        </div>
      `;

      const maleRadio = document.querySelector('input[value="M"]') as HTMLInputElement;
      const femaleRadio = document.querySelector('input[value="F"]') as HTMLInputElement;

      expect(maleRadio.checked).toBe(true);
      expect(femaleRadio.checked).toBe(false);

      // 请求选中 "女"
      const res = setRadioGroupValue(maleRadio, '女');
      expect(res).toBe(true);
      expect(femaleRadio.checked).toBe(true);
      expect(maleRadio.checked).toBe(false);
    });

    it('当 targetValue 与组内所有 Radio 都不匹配时，必须返回 false 且绝不能修改任何 radio 状态', () => {
      document.body.innerHTML = `
        <div class="form-item gender-group">
          <label class="radio-label">
            <input type="radio" name="gender" value="M" /> 男
          </label>
          <label class="radio-label">
            <input type="radio" name="gender" value="F" /> 女
          </label>
        </div>
      `;

      const maleRadio = document.querySelector('input[value="M"]') as HTMLInputElement;
      const femaleRadio = document.querySelector('input[value="F"]') as HTMLInputElement;

      // 传入一个不存在的选项 "保密"
      const res = setRadioGroupValue(maleRadio, '保密');
      expect(res).toBe(false);
      expect(maleRadio.checked).toBe(false);
      expect(femaleRadio.checked).toBe(false);
    });
  });

  describe('4. Checkbox 三态布尔解析与拒绝盲猜', () => {
    it('parseBoolean 必须严格区分 true / false / null', () => {
      expect(parseBoolean('是')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('同意')).toBe(true);

      expect(parseBoolean('否')).toBe(false);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('不同意')).toBe(false);

      expect(parseBoolean('不确定')).toBeNull();
      expect(parseBoolean('视情况而定')).toBeNull();
      expect(parseBoolean('unknown')).toBeNull();
      expect(parseBoolean('')).toBeNull();
    });

    it('遇到模糊词时，setNativeCheckboxChecked 必须返回 false，拒绝盲猜', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      document.body.appendChild(checkbox);

      const res = setNativeCheckboxChecked(checkbox, '不确定');
      expect(res).toBe(false);
      expect(checkbox.checked).toBe(false); // 绝不翻转为 true
    });
  });

  describe('5. Section Root 容器精确定位与卡片计数', () => {
    it('即便子卡片内部不包含“教育”文字，SectionEngine 也能通过 Section Root 容器准确定位卡片数量', () => {
      document.body.innerHTML = `
        <section class="education-section">
          <h2>教育经历</h2>
          <div class="card item-wrapper">
            <input name="school" value="清华大学" />
            <input name="major" value="计算机科学" />
          </div>
          <div class="card item-wrapper">
            <input name="school" value="北京大学" />
            <input name="major" value="软件工程" />
          </div>
        </section>
      `;

      // 现有 2 张卡片，如果 resume 里需要 2 张，则不需要重复扩增
      const count = (sectionEngine as any).countExistingSectionCards(['教育', '学历']);
      expect(count).toBe(2);
    });
  });

  describe('6. Parser "不会就不填" 纯洁性测试', () => {
    it('简历文本未明确提及性别、政治面貌、婚姻状况时，严禁默认推断出假值', () => {
      const textWithoutDemographics = `
        张敏
        手机：13800001111 | 邮箱：min.zhang@example.com
        求职意向：Java后端开发工程师
      `;

      const parsed = parseResumeFromText(textWithoutDemographics);

      expect(parsed.basics.name).toBe('张敏');
      expect(parsed.basics.gender).toBe(''); // 严禁默认为 '男'
      expect(parsed.basics.politicalStatus).toBe(''); // 严禁默认为 '群众'
      expect(parsed.basics.maritalStatus).toBe(''); // 严禁默认为 '未婚'
      expect(parsed.basics.jobStatus).toBe(''); // 严禁默认为 '应届毕业生'
    });
  });
});
