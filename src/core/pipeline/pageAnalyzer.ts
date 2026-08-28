import type { FieldDescriptor, FieldType, FieldSectionInfo } from '../../types/pipeline';
import { findAssociatedLabelText } from '../../utils/dom';

export class PageAnalyzer {
  /**
   * 深度扫描页面表单控件，生成结构化的 FieldDescriptor[]
   */
  analyzePage(container: Document | HTMLElement = document): FieldDescriptor[] {
    const descriptors: FieldDescriptor[] = [];
    const visitedElements = new Set<HTMLElement>();

    // 1. 扫描所有原生 input / textarea / select
    const nativeInputs = Array.from(
      container.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable="true"]')
    );

    // 2. 扫描自定义下拉框 / Combobox / Cascader 容器
    const customComponents = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.el-select, .ant-select, .semi-select, [role="combobox"], [class*="select-selection"], .el-cascader, .ant-cascader, .semi-cascader, [class*="cascader"]'
      )
    );

    const allCandidateElements = [...nativeInputs, ...customComponents];

    let fieldCounter = 0;
    for (const el of allCandidateElements) {
      // 避免重复扫描或扫描已被包裹在自定义组件内部的冗余原生 input
      if (visitedElements.has(el)) continue;

      // 忽略不可见、系统隐藏、提交按钮类元素
      if (this.shouldSkipElement(el)) continue;

      visitedElements.add(el);
      fieldCounter++;

      const type = this.detectFieldType(el);
      const label = findAssociatedLabelText(el);
      const placeholder = el.getAttribute('placeholder') || '';
      const name = el.getAttribute('name') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const required = this.detectRequired(el, label);
      const disabled = (el as HTMLInputElement).disabled || el.getAttribute('aria-disabled') === 'true';
      const readOnly = (el as HTMLInputElement).readOnly || el.getAttribute('readonly') !== null;
      const currentValue = this.readCurrentValue(el, type);
      const options = this.extractOptions(el, type);
      const section = this.detectSectionInfo(el);
      const contextText = this.extractContextText(el);

      descriptors.push({
        id: `field_${fieldCounter}_${type}`,
        element: el,
        type,
        label,
        placeholder,
        name,
        ariaLabel,
        required,
        disabled,
        readOnly,
        currentValue,
        options,
        section,
        contextText,
      });
    }

    return descriptors;
  }

  private shouldSkipElement(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) {
        return true;
      }
    }
    // 判断元素是否在页面上可见
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
      // 若父容器也是隐藏的则跳过
      if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) {
        return true;
      }
    }
    return false;
  }

  private detectFieldType(el: HTMLElement): FieldType {
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return 'contenteditable';
    }
    if (el instanceof HTMLTextAreaElement) {
      return 'textarea';
    }
    if (el instanceof HTMLSelectElement) {
      return 'select';
    }
    if (
      el.classList.contains('el-cascader') ||
      el.classList.contains('ant-cascader') ||
      el.classList.contains('semi-cascader') ||
      el.getAttribute('role') === 'cascader'
    ) {
      return 'cascader';
    }
    if (el.classList.contains('el-select') || el.classList.contains('ant-select') || el.getAttribute('role') === 'combobox') {
      return 'select';
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'radio') return 'radio';
      if (el.type === 'checkbox') return 'checkbox';
      if (el.type === 'date' || el.type === 'month' || el.classList.contains('datepicker') || el.placeholder.includes('年') || el.placeholder.includes('YYYY')) {
        return 'date';
      }
      return 'text';
    }
    return 'unknown';
  }

  private detectRequired(el: HTMLElement, labelText: string): boolean {
    if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') {
      return true;
    }
    if (labelText.includes('*') || labelText.includes('必填')) {
      return true;
    }
    const parent = el.closest('.el-form-item, .ant-form-item, .form-item, .form-group');
    if (parent) {
      if (parent.classList.contains('is-required') || parent.querySelector('.ant-form-item-required, [class*="required"]')) {
        return true;
      }
    }
    return false;
  }

  private readCurrentValue(el: HTMLElement, type: FieldType): any {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (type === 'radio' || type === 'checkbox') {
        return (el as HTMLInputElement).checked;
      }
      return el.value;
    }
    if (el instanceof HTMLSelectElement) {
      return el.value;
    }
    if (type === 'contenteditable') {
      return el.innerText || el.textContent || '';
    }
    return '';
  }

  private extractOptions(el: HTMLElement, type: FieldType): string[] | undefined {
    if (el instanceof HTMLSelectElement) {
      return Array.from(el.options).map((o) => o.text.trim()).filter(Boolean);
    }
    if (type === 'radio') {
      const name = el.getAttribute('name');
      const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || document;
      const groupRadios = name
        ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`))
        : Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      if (groupRadios.length > 0) {
        return groupRadios
          .map((r) => {
            const labelText = findAssociatedLabelText(r) || r.value || r.parentElement?.textContent?.trim() || '';
            return labelText.trim();
          })
          .filter(Boolean);
      }
    }
    if (type === 'select') {
      const optionEls = el.querySelectorAll('[role="option"], .el-select-dropdown__item, .ant-select-item-option');
      if (optionEls.length > 0) {
        return Array.from(optionEls).map((o) => o.textContent?.trim() || '').filter(Boolean);
      }
    }
    return undefined;
  }

  private detectSectionInfo(el: HTMLElement): FieldSectionInfo {
    const cardSelectors = [
      { type: 'education' as const, sel: '[class*="education-item"], [class*="edu-item"], [class*="education_item"], [class*="education-card"], [class*="educationCard"], [data-section="education"]' },
      { type: 'experience' as const, sel: '[class*="experience-item"], [class*="work-item"], [class*="exp-item"], [class*="work-card"], [class*="job-item"], [data-section="experience"]' },
      { type: 'project' as const, sel: '[class*="project-item"], [class*="proj-item"], [class*="project-card"], [class*="projectCard"], [data-section="project"]' },
      { type: 'family' as const, sel: '[class*="family-item"], [class*="family_item"], [class*="contact-item"], [data-section="family"]' },
    ];

    for (const item of cardSelectors) {
      const card = el.closest(item.sel);
      if (card && card.parentElement) {
        const siblings = Array.from(card.parentElement.querySelectorAll(item.sel));
        const idx = siblings.indexOf(card);
        return { type: item.type, index: Math.max(0, idx) };
      }
    }

    // 向上查找通用标题区域
    const genericSection = el.closest('fieldset, .section, [class*="section"], [class*="block"], .ant-card, .el-card');
    if (genericSection) {
      const headerText = (genericSection.querySelector('h1, h2, h3, h4, .title, [class*="title"], legend')?.textContent || '').toLowerCase();
      let type: FieldSectionInfo['type'] = 'unknown';
      if (/教育|学历|就读|学习经历|education/i.test(headerText)) type = 'education';
      else if (/工作|实习|工作经历|任职|experience|work/i.test(headerText)) type = 'experience';
      else if (/项目|项目经历|主要项目|project/i.test(headerText)) type = 'project';
      else if (/家庭|亲属|紧急联系|family|contact/i.test(headerText)) type = 'family';
      else if (/问答|开放|essay|question/i.test(headerText)) type = 'qa';
      else if (/基本信息|个人信息|basic/i.test(headerText)) type = 'basic';

      if (type !== 'unknown' && genericSection.parentElement) {
        const allSame = Array.from(genericSection.parentElement.children).filter((c) => c.tagName === genericSection.tagName);
        const idx = allSame.indexOf(genericSection);
        return { type, index: Math.max(0, idx), rawTitle: headerText };
      }
    }

    return { type: 'basic', index: 0 };
  }

  private extractContextText(el: HTMLElement): string {
    const candidates = [
      el.closest('.el-form-item, .ant-form-item, .semi-form-item, .form-item, .form-group, [class*="form-item"], [class*="FormItem"], fieldset, .section, [class*="section"], tr'),
      el.parentElement,
      el.parentElement?.parentElement,
    ];

    for (const ancestor of candidates) {
      if (ancestor && ancestor.textContent) {
        return ancestor.textContent.trim().toLowerCase();
      }
    }

    return '';
  }
}

export const pageAnalyzer = new PageAnalyzer();
