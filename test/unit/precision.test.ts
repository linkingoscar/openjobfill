import { describe, it, expect, beforeEach } from 'vitest';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { setRadioGroupValue, setNativeCheckboxChecked } from '@/core/engine/dispatcher';
import { parseResumeFromText } from '@/core/parser/resumeParser';
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

  describe('1. Plan Deduplication (防止平台映射后产生重复 PlanItem)', () => {
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

  describe('2. Radio Group 语义精准查找与勾选', () => {
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
  });

  describe('3. Checkbox 严格布尔解析 (严禁将 "否" 解析为 true)', () => {
    it('字符串 "否" / "false" / "0" / "不同意" 应严格被解析为 false 并取消勾选', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      document.body.appendChild(checkbox);

      // 传入 "否"
      setNativeCheckboxChecked(checkbox, '否');
      expect(checkbox.checked).toBe(false);

      // 传入 "不同意"
      checkbox.checked = true;
      setNativeCheckboxChecked(checkbox, '不同意');
      expect(checkbox.checked).toBe(false);

      // 传入 "是"
      setNativeCheckboxChecked(checkbox, '是');
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('4. Parser "不会就不填" 纯洁性测试', () => {
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

  describe('5. Cascader 控件识别与 enhanceField Hook', () => {
    it('PageAnalyzer 应该能将 ant-cascader 与 el-cascader 准确识别为 cascader 类型', () => {
      const div = document.createElement('div');
      div.className = 'ant-cascader el-cascader';
      document.body.appendChild(div);

      const descriptors = pageAnalyzer.analyzePage(document);
      expect(descriptors.length).toBe(1);
      expect(descriptors[0].type).toBe('cascader');
    });

    it('PlatformEnhancer.enhanceField Hook 能动态修正字段元数据', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const field: FieldDescriptor = {
        id: 'f_hook',
        element: input,
        type: 'text',
        label: '未知代码',
        placeholder: '',
        name: 'custom_code',
        ariaLabel: '',
        required: true,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const hookEnhancer: PlatformEnhancer = {
        id: 'hook-enhancer',
        name: 'Hook 增强器',
        priority: 100,
        matches: () => true,
        enhanceField: (f) => {
          if (f.name === 'custom_code') {
            return { label: '增强后的真实姓名', type: 'text' };
          }
          return undefined;
        },
        fieldMappings: {
          'input[name="custom_code"]': 'basics.name',
        },
      };

      const plan = planGenerator.generatePlan([field], BASE_MOCK_RESUME, hookEnhancer);
      expect(field.label).toBe('增强后的真实姓名');
    });
  });
});
