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
   */
  private countExistingSectionCards(keywords: string[]): number {
    const cardSelectors = [
      '.card, .form-card, .section-card, .list-item, .dynamic-row, .repeater-item',
      '[class*="card"], [class*="item-wrapper"], [class*="section-item"]',
      '.el-card, .ant-card, .semi-card',
    ];

    const cards = Array.from(document.querySelectorAll<HTMLElement>(cardSelectors.join(','))).filter((c) => {
      if (!isElementVisible(c)) return false;
      const text = (c.textContent || '').toLowerCase();
      return keywords.some((k) => text.includes(k.toLowerCase()));
    });

    return Math.max(1, cards.length);
  }
}

export const sectionEngine = new SectionEngine();
