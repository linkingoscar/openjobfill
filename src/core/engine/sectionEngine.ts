import type { StandardResume } from '../../types/resume';
import { autoExpandHeuristicSections } from './repeater';
import { isElementVisible, sleep } from '../../utils/dom';

export class SectionEngine {
  /**
   * 自动探测页面现有卡片行数，并按需差量点击 "+添加经历" 按钮 (Required - Existing)
   */
  async ensureSectionCapacity(resume: StandardResume): Promise<boolean> {
    let anyExpanded = false;

    // 1. 教育经历卡片
    if (resume.educations && resume.educations.length > 1) {
      const existingCount = this.countExistingSectionCards(['教育', '学历', 'education']);
      const needed = resume.educations.length;
      if (needed > existingCount) {
        const delta = needed - existingCount;
        const expanded = await autoExpandHeuristicSections(['教育', '学历', 'education'], delta + 1);
        if (expanded) anyExpanded = true;
      }
    }

    // 2. 工作与实习经历卡片
    if (resume.experiences && resume.experiences.length > 1) {
      const existingCount = this.countExistingSectionCards(['工作', '实习', 'experience', 'employment']);
      const needed = resume.experiences.length;
      if (needed > existingCount) {
        const delta = needed - existingCount;
        const expanded = await autoExpandHeuristicSections(['工作', '实习', 'experience'], delta + 1);
        if (expanded) anyExpanded = true;
      }
    }

    // 3. 项目经历卡片
    if (resume.projects && resume.projects.length > 1) {
      const existingCount = this.countExistingSectionCards(['项目', 'project']);
      const needed = resume.projects.length;
      if (needed > existingCount) {
        const delta = needed - existingCount;
        const expanded = await autoExpandHeuristicSections(['项目', 'project'], delta + 1);
        if (expanded) anyExpanded = true;
      }
    }

    // 4. 家庭成员卡片
    if (resume.familyMembers && resume.familyMembers.length > 1) {
      const existingCount = this.countExistingSectionCards(['家庭', 'family']);
      const needed = resume.familyMembers.length;
      if (needed > existingCount) {
        const delta = needed - existingCount;
        const expanded = await autoExpandHeuristicSections(['家庭', 'family'], delta + 1);
        if (expanded) anyExpanded = true;
      }
    }

    if (anyExpanded) {
      // 额外等待 150ms 确保 Vue/React/Angular 虚拟 DOM 挂载完成
      await sleep(150);
    }

    return anyExpanded;
  }

  /**
   * 统计页面当前已渲染的指定模块卡片数量
   * 策略：先定位模块的 Section Root 容器，再统计 Root 内部包含表单输入的重复卡片/行
   */
  private countExistingSectionCards(keywords: string[]): number {
    // 1. 定位模块标题节点
    const titleCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4, h5, h6, .section-title, .title, legend, [class*="title"], [class*="header"], .ant-form-item-label'
      )
    ).filter((el) => {
      if (!isElementVisible(el)) return false;
      const text = (el.textContent || '').trim().toLowerCase();
      return keywords.some((k) => text.includes(k.toLowerCase()));
    });

    if (titleCandidates.length === 0) {
      return 1;
    }

    const titleEl = titleCandidates[0];

    // 2. 定位 Section Root 容器
    const sectionRoot =
      titleEl.closest<HTMLElement>(
        'section, fieldset, .form-section, [class*="section"], [class*="block"], .el-card, .ant-card, form'
      ) || titleEl.parentElement;

    if (!sectionRoot) {
      return 1;
    }

    // 3. 在 Section Root 内部查找具有表单输入控件的卡片/行节点
    const cardSelectors = [
      '.card, .form-card, .section-card, .list-item, .dynamic-row, .repeater-item, [class*="card"], [class*="item-wrapper"], [class*="item_wrapper"]',
      '.el-card, .ant-card, .semi-card, [class*="repeater"]',
    ];

    const childCards = Array.from(sectionRoot.querySelectorAll<HTMLElement>(cardSelectors.join(','))).filter(
      (c) => {
        if (!isElementVisible(c)) return false;
        // 必须自身包含 input/textarea/select，避免命中空的父级或装饰性 card
        const hasInputs = c.querySelector('input, textarea, select, [contenteditable="true"]');
        return !!hasInputs;
      }
    );

    if (childCards.length > 0) {
      // 过滤掉嵌套包含关系的父卡片，只保留最具体的叶子卡片
      const leafCards = childCards.filter(
        (card) => !childCards.some((other) => other !== card && card.contains(other))
      );
      return Math.max(1, leafCards.length);
    }

    return 1;
  }
}

export const sectionEngine = new SectionEngine();
