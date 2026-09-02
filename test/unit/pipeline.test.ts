import { describe, it, expect, beforeEach } from 'vitest';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { verifier } from '@/core/pipeline/verifier';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { formFillerEngine } from '@/core/engine/filler';
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
      expect(nameField?.type).toBe('text');
      expect(nameField?.required).toBe(true);
      expect(nameField?.label).toContain('姓名');
      expect(nameField?.fingerprint).toMatch(/^field-/);
      expect(nameField?.locator?.selectors).toContain('#nameInput');
      expect(JSON.stringify(nameField?.locator)).not.toContain('张三');

      const selectField = descriptors.find((d) => d.type === 'select');
      expect(selectField).toBeDefined();
      expect(selectField?.options).toContain('本科');
      expect(selectField?.options).toContain('硕士');
    });

    it('应优先扫描申请表单根节点，排除同页搜索和登录表单', () => {
      document.body.innerHTML = `
        <header>
          <form id="job-search"><label>搜索职位</label><input name="keyword"></form>
          <form id="login"><label>登录账号</label><input name="account"><input type="password"></form>
        </header>
        <main>
          <form id="application" class="application-form">
            <h2>职位申请</h2>
            <label>姓名</label><input name="name">
            <label>手机</label><input name="phone">
            <label>邮箱</label><input name="email">
          </form>
        </main>`;

      const fields = pageAnalyzer.analyzePage(document);
      expect(fields.map((field) => field.name)).toEqual(['name', 'phone', 'email']);
      const diagnostics = pageAnalyzer.getLastDiagnostics();
      expect(diagnostics.fallbackDocumentCount).toBe(0);
      expect(diagnostics.formRoots.find((root) => root.root.includes('#application'))?.selected).toBe(true);
      expect(diagnostics.formRoots.find((root) => root.root.includes('#job-search'))?.selected).toBe(false);
    });

    it('选择申请表单根节点后仍应扫描其内部宿主的开放 Shadow DOM', () => {
      document.body.innerHTML = `
        <form id="site-search"><input name="keyword"></form>
        <form id="application" class="application-form">
          <h2>职位申请</h2>
          <label>姓名</label><input name="name">
          <div id="contact-widget"></div>
        </form>`;

      const host = document.querySelector<HTMLElement>('#contact-widget')!;
      const shadowRoot = host.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `
        <label for="shadow-phone">联系电话</label>
        <input id="shadow-phone" name="phone" type="tel">`;

      const fields = pageAnalyzer.analyzePage(document);
      expect(fields.map((field) => field.name)).toEqual(['name', 'phone']);
      expect(fields.some((field) => field.element === shadowRoot.querySelector('#shadow-phone'))).toBe(true);
    });
  });

  describe('PlanGenerator (填表规划决策生成)', () => {
    it('密码、验证码和支付字段必须在规划阶段被安全阻断', () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item"><label>登录密码</label><input name="password" type="password" /></div>
          <div class="form-item"><label>验证码</label><input name="captcha" type="text" /></div>
          <div class="form-item"><label>银行卡号</label><input name="cardNumber" type="text" /></div>
          <div class="form-item"><label>姓名</label><input name="name" type="text" /></div>
        </form>
      `;

      const fields = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(fields, MOCK_RESUME);
      const password = plan.items.find((item) => item.field.name === 'password');
      const captcha = plan.items.find((item) => item.field.name === 'captcha');
      const card = plan.items.find((item) => item.field.name === 'cardNumber');
      const name = plan.items.find((item) => item.field.name === 'name');

      expect(password?.action).toBe('SKIP');
      expect(captcha?.action).toBe('SKIP');
      expect(card?.action).toBe('SKIP');
      expect(name?.action).toBe('FILL');
    });

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

    it('应保留 false 问项并为专业级联生成完整路径', () => {
      document.body.innerHTML = `
        <div class="form-item"><label>是否接受加班</label><input type="radio" name="overtime" value="是"><input type="radio" name="overtime" value="否"></div>
        <div class="form-item"><label>所学专业</label><div class="ant-cascader-picker"><input name="major"></div></div>
      `;
      const resume: StandardResume = {
        ...MOCK_RESUME,
        basics: { ...MOCK_RESUME.basics, acceptOvertime: false },
      };
      const descriptors = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(descriptors, resume);
      const overtime = plan.items.find((item) => item.field.label.includes('加班'));
      const major = plan.items.find((item) => item.field.label.includes('专业'));

      expect(overtime?.action).toBe('FILL');
      expect(overtime?.targetValue).toBe('否');
      expect(major?.targetValue).toBe('工学-计算机类-计算机科学与技术');
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

    it('radio 读回必须限定在本字段所属分组内，不得读回同页他处的选中项', async () => {
      document.body.innerHTML = `
        <form id="formA">
          <div class="form-item">
            <input type="radio" name="gender" value="男" checked />
            <input type="radio" name="gender" value="女" />
          </div>
        </form>
        <form id="formB">
          <div class="form-item">
            <input type="radio" name="married" value="是" checked />
            <input type="radio" name="married" value="否" />
          </div>
        </form>
      `;

      const genderEl = document.querySelector<HTMLInputElement>('#formA input[name="gender"]')!;
      const genderField = {
        id: 'f-gender',
        element: genderEl,
        type: 'radio' as const,
        label: '性别',
        placeholder: '',
        name: 'gender',
        ariaLabel: '',
        required: false,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      // 必须读回本组的“男”，而不是 formB 中已选中的“是”
      const val = await verifier.readBack(genderField, 'radio');
      expect(val).toBe('男');
    });

    it('无 name 且无分组容器时，radio 读回不得退化为全文档查询', async () => {
      document.body.innerHTML = `
        <div id="otherGroup"><input type="radio" value="X" checked /></div>
        <div id="mineGroup"><input type="radio" value="Y" /></div>
      `;

      const el = document.querySelector<HTMLInputElement>('#mineGroup input')!;
      const field = {
        id: 'f-no-name',
        element: el,
        type: 'radio' as const,
        label: '未知单选',
        placeholder: '',
        name: '',
        ariaLabel: '',
        required: false,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      // 该 radio 自身未被选中，必须返回 false，
      // 绝不能因为降级到 document 而把 otherGroup 的 "X" 读回成自己的值
      const val = await verifier.readBack(field, 'radio');
      expect(val).toBe(false);
    });

    it('iframe 内 radio 读回必须使用所属文档，不能串到顶层同名分组', async () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      expect(iframeDoc).toBeDefined();
      if (!iframeDoc) return;

      iframeDoc.body.innerHTML = `
        <form>
          <input type="radio" name="gender" value="女" checked />
          <input type="radio" name="gender" value="男" />
        </form>
      `;
      const el = iframeDoc.querySelector('input[type="radio"]') as HTMLInputElement;
      const field = {
        id: 'f-iframe-gender',
        element: el,
        type: 'radio' as const,
        label: '性别',
        placeholder: '',
        name: 'gender',
        ariaLabel: '',
        required: false,
        disabled: false,
        readOnly: false,
        currentValue: '',
        contextText: '',
      };

      expect(await verifier.readBack(field, 'radio')).toBe('女');
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

    it('收到 AbortSignal 后不得再写入任何字段', async () => {
      document.body.innerHTML = '<form><label>姓名</label><input name="name" type="text" /></form>';
      const fields = pageAnalyzer.analyzePage(document);
      const plan = planGenerator.generatePlan(fields, MOCK_RESUME);
      const controller = new AbortController();
      controller.abort();

      await expect(pipelineExecutor.executePlan(plan, { signal: controller.signal }))
        .rejects.toThrow('填写已取消');
      expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe('');
    });

    it('纯诊断模式不得扩展区块、调用填写或生成可执行计划', async () => {
      document.body.innerHTML = `
        <form class="application-form">
          <h2>职位申请</h2>
          <label>姓名</label><input name="name">
          <button type="button">添加工作经历</button>
        </form>`;
      let expansionClicks = 0;
      document.querySelector('button')?.addEventListener('click', () => expansionClicks++);
      const resume = structuredClone(MOCK_RESUME);
      resume.experiences.push({
        ...resume.experiences[0],
        id: 'exp-2',
        company: '第二家公司',
      });

      const analyzed = await formFillerEngine.analyzeDryRun(resume);

      expect(expansionClicks).toBe(0);
      expect(analyzed.diagnostics?.reportType).toBe('OPENJOBFILL_ASSOCIATION_DRY_RUN');
      expect(analyzed.diagnostics?.safety).toEqual({
        dynamicExpansionAttempted: false,
        pageWriteAttempted: false,
        resumeValuePersisted: false,
        rawDomPersisted: false,
      });
      expect(analyzed.diagnostics?.formRoots.formRoots.some((root) => root.selected)).toBe(true);
      expect(analyzed.diagnostics?.controlAdapters).toMatchObject({
        matchedFields: 0,
        genericFallbackFields: 1,
        mainWorldCandidates: 0,
      });
      await expect(formFillerEngine.executePlan(analyzed)).rejects.toThrow('纯诊断计划不能执行');
      expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe('');
    });

    it('预览停留时间不应计入最终填写耗时', async () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item">
            <label>姓名 *</label>
            <input name="name" type="text" />
          </div>
        </form>
      `;

      const analyzed = await formFillerEngine.analyze(MOCK_RESUME);
      await new Promise((resolve) => setTimeout(resolve, 120));
      const result = await formFillerEngine.executePlan(analyzed);

      expect(result.filledCount).toBe(1);
      expect(result.durationMs).toBeLessThan(120);
    });

    it('普通预览也不得提前展开、编辑或新增重复区块', async () => {
      document.body.innerHTML = `
        <form class="application-form">
          <h2>工作经历</h2>
          <div class="experience-card"><label>公司</label><input name="company"></div>
          <button type="button">添加工作经历</button>
        </form>`;
      let expansionClicks = 0;
      document.querySelector('button')!.addEventListener('click', () => expansionClicks++);
      const resume = structuredClone(MOCK_RESUME);
      resume.experiences.push({ ...resume.experiences[0], id: 'exp-2', company: '第二家公司' });

      const analyzed = await formFillerEngine.analyze(resume);

      expect(expansionClicks).toBe(0);
      expect(analyzed.sectionPreparation?.actions.some((action) => action.groupKey === 'experience')).toBe(true);
      formFillerEngine.cancelRun(analyzed.runId);
    });

    it('确认后由站点画像状态机填写并验证单卡记录，再执行区块保存', async () => {
      document.body.innerHTML = `
        <section class="apply-module" data-section="education">
          <div class="apply-form">
            <label>毕业院校</label><input name="school" placeholder="请输入学校">
            <button type="button">保存</button>
          </div>
        </section>`;
      const input = document.querySelector<HTMLInputElement>('input')!;
      let saveClicks = 0;
      document.querySelector('button')!.addEventListener('click', () => {
        saveClicks++;
        input.style.display = 'none';
      });

      const analyzed = await formFillerEngine.analyze(MOCK_RESUME);
      expect(input.value).toBe('');
      expect(saveClicks).toBe(0);
      expect(analyzed.sectionPreparation?.actions[0]).toMatchObject({
        groupKey: 'education', mode: 'single-card',
      });

      const result = await formFillerEngine.executePlan(analyzed);
      expect(result.filledCount).toBe(1);
      expect(saveClicks).toBe(1);
    });

    it('表单节点被刷新后，不应继续执行旧预览计划', async () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item">
            <label>姓名 *</label>
            <input name="name" type="text" />
          </div>
        </form>
      `;

      const analyzed = await formFillerEngine.analyze(MOCK_RESUME);
      document.body.innerHTML = '<form><input name="name" type="text" /></form>';

      await expect(formFillerEngine.executePlan(analyzed)).rejects.toThrow('表单已刷新');
      expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe('');
    });

    it('SPA 步骤地址变化后，不应继续执行旧预览计划', async () => {
      document.body.innerHTML = `
        <form><label>姓名 *</label><input name="name" type="text" /></form>
      `;

      const analyzed = await formFillerEngine.analyze(MOCK_RESUME);
      const originalUrl = window.location.href;
      try {
        window.history.pushState({}, '', `${originalUrl}#next-step`);
        await expect(formFillerEngine.executePlan(analyzed)).rejects.toThrow('页面步骤已变化');
      } finally {
        window.history.replaceState({}, '', originalUrl);
      }
    });

    it('增量规划只返回新增字段，不重复规划上一轮已处理字段', async () => {
      document.body.innerHTML = `
        <form>
          <div class="form-item"><label>姓名</label><input name="name" type="text" /></div>
        </form>
      `;
      const firstPlan = await formFillerEngine.analyze(MOCK_RESUME);
      await formFillerEngine.executePlan(firstPlan);

      const form = document.querySelector('form')!;
      const item = document.createElement('div');
      item.className = 'form-item';
      item.innerHTML = '<label>电子邮箱</label><input name="email" type="email" />';
      form.appendChild(item);

      const incremental = await formFillerEngine.analyzeIncremental(MOCK_RESUME, firstPlan, {
        changedRoots: [item],
      });
      expect(incremental.plan.items.some((entry) => entry.field.name === 'email')).toBe(true);
      expect(incremental.plan.items.some((entry) => entry.field.name === 'name')).toBe(false);
    });
  });
});
