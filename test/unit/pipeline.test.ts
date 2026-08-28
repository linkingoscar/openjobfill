import { describe, it, expect, beforeEach } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { verifier } from '@/core/pipeline/verifier';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { mokaEnhancer } from '@/core/adapters/enhancers';
import type { StandardResume } from '@/types/resume';

const MOCK_RESUME: StandardResume = {
  id: 'mock-1',
  title: '测试简历',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  basics: {
    name: '张三',
    gender: '男',
    birthDate: '1999-05-20',
    phone: '13900139000',
    email: 'zhangsan@example.com',
    idCardType: '身份证',
    idCardNumber: '110101199905201234',
    politicalStatus: '中共党员',
    ethnicity: '汉族',
    maritalStatus: '未婚',
    nativePlace: { province: '山东省', city: '青岛市' },
    currentLocation: { province: '北京市', city: '海淀区' },
    workingYears: 2,
    jobStatus: '在职-考虑机会',
    expectedRole: '前端架构师',
    selfEvaluation: '深耕前端工程化与性能优化',
  },
  educations: [
    {
      id: 'edu-1',
      schoolName: '清华大学',
      degree: '硕士',
      major: '计算机科学与技术',
      startDate: '2021-09',
      endDate: '2024-06',
      gpa: '3.9/4.0',
      isFullTime: true,
    },
  ],
  experiences: [
    {
      id: 'exp-1',
      company: '北京字节跳动科技有限公司',
      title: '前端高级开发工程师',
      startDate: '2024-07',
      endDate: '至今',
      description: '负责核心性能优化架构',
      techStack: 'Vue3, TypeScript',
    },
  ],
  projects: [],
  skills: [],
  languages: [],
  certificates: [],
  familyMembers: [],
  qaBank: [
    {
      id: 'qa-1',
      keyword: '竞业协议, 竞业限制',
      answer: '目前无任何在期竞业协议限制。',
    },
  ],
};

describe('Pipeline Engine (新一代两阶段决策与执行管道)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('PageAnalyzer (页面全要素结构化扫描)', () => {
    it('应该能正确扫描并解析各种表单控件的元数据与必填状态', () => {
      document.body.innerHTML = `
        <form id="testForm">
          <div class="form-item is-required">
            <label for="nameInput">真实中文姓名 *</label>
            <input id="nameInput" name="candidateName" type="text" placeholder="请输入姓名" required />
          </div>
          <div class="form-item">
            <label>联系电话</label>
            <input name="phone" type="tel" placeholder="11位手机号" />
          </div>
          <div class="form-item">
            <label>最高学历</label>
            <select name="degree">
              <option value="">请选择</option>
              <option value="本科">本科</option>
              <option value="硕士">硕士</option>
            </select>
          </div>
          <div class="form-item">
            <label>开放问答：竞业限制说明</label>
            <textarea name="nonCompete"></textarea>
          </div>
        </form>
      `;

      const descriptors = pageAnalyzer.analyzePage(document);

      expect(descriptors.length).toBe(4);

      const nameField = descriptors.find((d) => d.name === 'candidateName');
      expect(nameField).toBeDefined();
      expect(nameField?.required).toBe(true);
      expect(nameField?.label).toContain('姓名');

      const selectField = descriptors.find((d) => d.type === 'select');
      expect(selectField).toBeDefined();
      expect(selectField?.options).toContain('本科');
      expect(selectField?.options).toContain('硕士');
    });
  });

  describe('PlanGenerator (填表规划决策生成)', () => {
    it('应该能正确识别高置信度字段、问答库并标记 NEEDS_USER 待办项', () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item">
            <label>申请人姓名 *</label>
            <input name="name" type="text" />
          </div>
          <div class="form-item">
            <label>联系手机号</label>
            <input name="phone" type="tel" />
          </div>
          <div class="form-item">
            <label>是否有竞业协议限制？</label>
            <textarea name="compete"></textarea>
          </div>
          <div class="form-item">
            <label>特殊未收录必填合规项 *</label>
            <input name="unknown_compliance" type="text" required />
          </div>
        </form>
      `;

      const descriptors = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(descriptors, MOCK_RESUME, mokaEnhancer);

      expect(plan.highConfidenceCount).toBeGreaterThanOrEqual(2);
      expect(plan.needsUserCount).toBeGreaterThanOrEqual(1);

      // 验证姓名项
      const namePlan = plan.items.find((p) => p.field.label.includes('姓名'));
      expect(namePlan?.action).toBe('FILL');
      expect(namePlan?.targetValue).toBe('张三');

      // 验证问答库匹配
      const qaPlan = plan.items.find((p) => p.field.label.includes('竞业'));
      expect(qaPlan?.action).toBe('FILL');
      expect(qaPlan?.targetValue).toBe('目前无任何在期竞业协议限制。');

      // 验证未知必填项被标记为 NEEDS_USER 待办
      const compliancePlan = plan.items.find((p) => p.field.label.includes('合规项'));
      expect(compliancePlan?.action).toBe('NEEDS_USER');
    });
  });

  describe('Verifier (写后读回验证与语义等价性)', () => {
    it('应该能准确读回 input 和 select 的值', async () => {
      const input = document.createElement('input');
      input.value = '北京大学';
      document.body.appendChild(input);

      const field = {
        id: 'f1',
        element: input,
        type: 'text' as const,
        label: '学校',
        placeholder: '',
        name: '',
        ariaLabel: '',
        required: false,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const readVal = await verifier.readBack(field, 'input');
      expect(readVal).toBe('北京大学');
    });

    it('isSemanticEquivalent 应支持包含、标点归一化与日期模糊等价', () => {
      expect(verifier.isSemanticEquivalent('北京市', '北京', 'input')).toBe(true);
      expect(verifier.isSemanticEquivalent('大学本科', '本科', 'select')).toBe(true);
      expect(verifier.isSemanticEquivalent('2023年09月', '2023-09', 'date')).toBe(true);
      expect(verifier.isSemanticEquivalent('张三', '李四', 'input')).toBe(false);
    });
  });

  describe('PipelineExecutor (执行与待办清单闭环)', () => {
    it('执行规划后应成功完成写入、读回验证并输出 remainingTasks', async () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item">
            <label>姓名 *</label>
            <input name="name" type="text" />
          </div>
          <div class="form-item">
            <label>手机号码 *</label>
            <input name="mobile" type="tel" />
          </div>
          <div class="form-item">
            <label>需人工填写的企业文化题 *</label>
            <textarea name="culture" required></textarea>
          </div>
        </form>
      `;

      const descriptors = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(descriptors, MOCK_RESUME);
      const result = await pipelineExecutor.executePlan(plan);

      expect(result.filledCount).toBe(2);
      expect(result.verifiedCount).toBe(2);
      expect(result.remainingTasks.length).toBe(1);
      expect(result.remainingTasks[0].label).toContain('企业文化');

      // 验证 DOM 上的值确实已经被填入
      const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
      expect(nameInput.value).toBe('张三');
    });
  });
});
