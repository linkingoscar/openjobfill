import { describe, it, expect, beforeEach } from 'vitest';
import { parseResumeFromText } from '@/core/parser/resumeParser';
import { workdayEnhancer } from '@/core/adapters/enhancers';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import type { StandardResume } from '@/types/resume';

describe('Workday & International ATS Suite (Workday 与国际化网申专项测试)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('1. 智能中英文姓名拆分 (firstName / lastName)', () => {
    it('中文单字姓氏应能正确拆分为 lastName 和 firstName', () => {
      const parsed = parseResumeFromText('张小明\n手机：13800000000\n邮箱：test@example.com');
      expect(parsed.basics.name).toBe('张小明');
      expect(parsed.basics.lastName).toBe('张');
      expect(parsed.basics.firstName).toBe('小明');
    });

    it('中文复姓（如诸葛、欧阳）应能精准识别并拆分', () => {
      const parsed = parseResumeFromText('欧阳修\n手机：13800000000\n邮箱：test@example.com');
      expect(parsed.basics.name).toBe('欧阳修');
      expect(parsed.basics.lastName).toBe('欧阳');
      expect(parsed.basics.firstName).toBe('修');
    });

    it('英文格式姓名（如 Johnathan Smith）应能按空格正确拆分', () => {
      const parsed = parseResumeFromText('Johnathan Smith\nPhone: +1 234567890\nEmail: john@example.com');
      expect(parsed.basics.name).toBe('Johnathan Smith');
      expect(parsed.basics.firstName).toBe('Johnathan');
      expect(parsed.basics.lastName).toBe('Smith');
    });
  });

  describe('2. Workday 国际招聘系统字段增强与规划', () => {
    it('Workday 结构化表单中的 legalNameSection 应精准映射到 firstName 与 lastName', () => {
      document.body.innerHTML = `
        <form data-automation-id="workdayApplicationForm">
          <div data-automation-id="legalNameSection_firstName">
            <input name="firstName" type="text" placeholder="First Name" />
          </div>
          <div data-automation-id="legalNameSection_lastName">
            <input name="lastName" type="text" placeholder="Last Name" />
          </div>
          <div data-automation-id="addressSection_postalCode">
            <input name="zipCode" type="text" placeholder="Postal Code" />
          </div>
          <div data-automation-id="phone-number">
            <input name="phone" type="tel" />
          </div>
        </form>
      `;

      const mockInternationalResume: StandardResume = {
        id: 'wd-1',
        title: 'Workday 国际简历',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        basics: {
          name: 'Alex Ferguson',
          firstName: 'Alex',
          lastName: 'Ferguson',
          phone: '+1 555-0199',
          email: 'alex@example.com',
          birthDate: '1990-01-01',
          idCardNumber: '',
          country: 'United States',
          postalCode: '94043',
          workingYears: 8,
          expectedRole: 'Tech Lead',
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

      const descriptors = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(descriptors, mockInternationalResume, workdayEnhancer);

      expect(plan.highConfidenceCount).toBeGreaterThanOrEqual(3);

      const firstNamePlan = plan.items.find((p) => p.semanticKey === 'basics.firstName');
      expect(firstNamePlan).toBeDefined();
      expect(firstNamePlan?.targetValue).toBe('Alex');

      const lastNamePlan = plan.items.find((p) => p.semanticKey === 'basics.lastName');
      expect(lastNamePlan).toBeDefined();
      expect(lastNamePlan?.targetValue).toBe('Ferguson');

      const zipPlan = plan.items.find((p) => p.semanticKey === 'basics.postalCode');
      expect(zipPlan).toBeDefined();
      expect(zipPlan?.targetValue).toBe('94043');
    });

    it('当 data-automation-id 直接挂在 input 上时，WorkdayEnhancer 同样必须精准识别', () => {
      document.body.innerHTML = `
        <form data-automation-id="workdayApplicationForm">
          <input data-automation-id="firstName" type="text" />
          <input data-automation-id="lastName" type="text" />
        </form>
      `;

      const mockInternationalResume: StandardResume = {
        id: 'wd-2',
        title: 'Workday 国际简历 2',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        basics: {
          name: 'Alex Ferguson',
          firstName: 'Alex',
          lastName: 'Ferguson',
          phone: '',
          email: '',
          birthDate: '',
          idCardNumber: '',
          workingYears: 8,
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

      const descriptors = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(descriptors, mockInternationalResume, workdayEnhancer);

      const firstNamePlan = plan.items.find((p) => p.semanticKey === 'basics.firstName');
      expect(firstNamePlan).toBeDefined();
      expect(firstNamePlan?.targetValue).toBe('Alex');

      const lastNamePlan = plan.items.find((p) => p.semanticKey === 'basics.lastName');
      expect(lastNamePlan).toBeDefined();
      expect(lastNamePlan?.targetValue).toBe('Ferguson');
    });

    it('通用语义词典面对 First Name / Given Name 时，绝对只能匹配 basics.firstName，绝不能填入 Full Name', () => {
      document.body.innerHTML = `
        <div>
          <label>First Name</label>
          <input name="user_fname" type="text" />
        </div>
      `;

      const mockResume: StandardResume = {
        id: 'wd-3',
        title: '通用简历',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        basics: {
          name: 'Johnathan Smith',
          firstName: 'Johnathan',
          lastName: 'Smith',
          phone: '',
          email: '',
          birthDate: '',
          idCardNumber: '',
          workingYears: 3,
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

      const descriptors = pageAnalyzer.analyzePage(document);
      // 不传任何 PlatformEnhancer，测试通用词典
      const plan = planGenerator.generatePlan(descriptors, mockResume, null);

      const item = plan.items[0];
      expect(item).toBeDefined();
      expect(item.semanticKey).toBe('basics.firstName');
      expect(item.targetValue).toBe('Johnathan'); // 必须是 Johnathan，绝不能是 Johnathan Smith
    });
  });
});
