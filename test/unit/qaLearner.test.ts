import { describe, it, expect } from 'vitest';
import { mapLabelToProfileField } from '@/core/engine/qaLearner';
import { EMPTY_RESUME, DEMO_RESUME } from '@/core/storage/defaultData';
import { planGenerator } from '@/core/pipeline/planGenerator';
import type { FieldDescriptor } from '@/types/pipeline';
import type { StandardResume } from '@/types/resume';

describe('Smart Profile / QA Learner & Purity Test Suite (资料补全与纯洁性测试)', () => {
  describe('1. EMPTY_RESUME vs DEMO_RESUME 彻底解耦', () => {
    it('EMPTY_RESUME 必须完全空净，严禁包含张三/假数据', () => {
      expect(EMPTY_RESUME.basics.name).toBe('');
      expect(EMPTY_RESUME.basics.phone).toBe('');
      expect(EMPTY_RESUME.basics.email).toBe('');
      expect(EMPTY_RESUME.basics.idCardNumber).toBe('');
      expect(EMPTY_RESUME.educations.length).toBe(0);
      expect(EMPTY_RESUME.experiences.length).toBe(0);
      expect(EMPTY_RESUME.projects.length).toBe(0);
      expect(EMPTY_RESUME.schemaVersion).toBe(4);
    });

    it('DEMO_RESUME 保持张三完整演示数据，用于演示测试', () => {
      expect(DEMO_RESUME.basics.name).toBe('张三');
      expect(DEMO_RESUME.educations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. 二分法：结构化 Profile 字段识别', () => {
    it('身高、体重、籍贯、户口、婚姻、到岗时间等应精准识别为 Profile 字段', () => {
      expect(mapLabelToProfileField('身高(cm)')?.key).toBe('basics.height');
      expect(mapLabelToProfileField('体重（kg）')?.key).toBe('basics.weight');
      expect(mapLabelToProfileField('生源所在地')?.key).toBe('basics.nativePlace.detail');
      expect(mapLabelToProfileField('户口所在地址')?.key).toBe('basics.hukouLocation.detail');
      expect(mapLabelToProfileField('到岗时间')?.key).toBe('basics.availableTime');
      expect(mapLabelToProfileField('婚姻状况')?.key).toBe('basics.maritalStatus');
      expect(mapLabelToProfileField('期望薪资')?.key).toBe('basics.expectedSalaryMin');
    });

    it('开放式问题不属于 Profile 字段，返回 null 进入 QA 流程', () => {
      expect(mapLabelToProfileField('你最大的优势是什么')).toBeNull();
      expect(mapLabelToProfileField('未来三年职业规划')).toBeNull();
      expect(mapLabelToProfileField('为什么选择加入我们公司')).toBeNull();
    });
  });

  describe('3. QA 问答库域名作用域隔离 (Domain Scoping)', () => {
    it('标记为 scope: domain 的问答项，在异域网申时绝不会被填入', () => {
      const input = document.createElement('textarea');
      const field: FieldDescriptor = {
        id: 'f_qa_test',
        element: input,
        type: 'textarea',
        label: '为什么选择我们',
        placeholder: '请阐述加入本公司的原因',
        name: 'why_us',
        ariaLabel: '',
        required: true,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const resumeWithDomainQA: StandardResume = {
        ...EMPTY_RESUME,
        qaBank: [
          {
            id: 'qa-tencent',
            keyword: '为什么选择我们, 为什么加入我们',
            answer: '因为腾讯在社交与游戏领域具有领先优势。',
            scope: 'domain',
            domain: 'join.qq.com', // 专属腾讯
          },
          {
            id: 'qa-career',
            keyword: '职业规划',
            answer: '深耕技术，成为架构师。',
            scope: 'global',
          },
        ],
      };

      // 模拟在阿里巴巴校招页面
      window.location.hostname = 'talent.alibaba.com';

      const plan = planGenerator.generatePlan([field], resumeWithDomainQA);
      const matchedQA = plan.items.find((p) => p.semanticKey?.startsWith('qaBank.'));
      // 腾讯专属答案绝不会被填入阿里校招页
      expect(matchedQA).toBeUndefined();
    });
  });

  describe('4. 入职时间与工作经历上下文消歧测试', () => {
    it('工作经历中的入职时间绝不误归档为 basics.availableTime', () => {
      // 在工作/实习背景下
      expect(mapLabelToProfileField('入职时间', '工作经历 某科技有限公司 前端开发', 'experience')).toBeNull();
      expect(mapLabelToProfileField('入职时间', '实习经历 某互联网大厂', 'experience')).toBeNull();
      expect(mapLabelToProfileField('开始时间', '项目经历 核心中台架构', 'project')).toBeNull();
    });

    it('求职意向中的入职时间或显式到岗时间正确归档到 basics.availableTime', () => {
      expect(mapLabelToProfileField('入职时间', '求职意向 期望到岗', 'basics')?.key).toBe('basics.availableTime');
      expect(mapLabelToProfileField('可到岗时间', '', '')?.key).toBe('basics.availableTime');
      expect(mapLabelToProfileField('最快入职时间', '', '')?.key).toBe('basics.availableTime');
    });
  });

  describe('5. Domain QA 两遍最高优先级匹配测试', () => {
    it('当同时存在 Global 通用回答与 Domain 专属回答时，专属回答必须优先命中胜出', () => {
      const input = document.createElement('textarea');
      const field: FieldDescriptor = {
        id: 'f_why_bytedance',
        element: input,
        type: 'textarea',
        label: '为什么选择我们',
        placeholder: '请说明理由',
        name: 'reason',
        ariaLabel: '',
        required: true,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      const resumeWithBothQAs: StandardResume = {
        ...EMPTY_RESUME,
        qaBank: [
          {
            id: 'qa-global',
            keyword: '为什么选择我们',
            answer: '通用回答：看好贵司的发展前景与平台技术实力。',
            scope: 'global', // 全局通用 (排在前面)
          },
          {
            id: 'qa-bytedance',
            keyword: '为什么选择我们',
            answer: '字节专属回答：我深度热爱抖音产品生态，希望为亿级并发架构贡献力量。',
            scope: 'domain',
            domain: 'jobs.bytedance.com', // 字节专属 (排在后面)
          },
        ],
      };

      // 处于字节跳动招聘页面
      window.location.hostname = 'jobs.bytedance.com';

      const plan = planGenerator.generatePlan([field], resumeWithBothQAs);
      const matched = plan.items.find((p) => p.semanticKey?.startsWith('qaBank.'));

      expect(matched).toBeDefined();
      expect(matched?.targetValue).toBe('字节专属回答：我深度热爱抖音产品生态，希望为亿级并发架构贡献力量。');
    });
  });
});
