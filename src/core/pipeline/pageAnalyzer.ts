import type { FieldDescriptor, FieldType, FieldSectionInfo } from '../../types/pipeline';
import {
  findAssociatedLabelText, 
  getElementWindow, 
  isInputElement, 
  isTextAreaElement, 
  isSelectElement,
  isFieldRequired,
  getAllOpenRoots,
} from '../../utils/dom';
import { createElementFingerprint } from './runContext';
import { inspectFieldSafety } from './fieldSafety';

export class PageAnalyzer {
  /**
   * 深度扫描页面表单控件，生成结构化的 FieldDescriptor[]
   */
  analyzePage(container: Document | HTMLElement = document): FieldDescriptor[] {
    const descriptors: FieldDescriptor[] = [];
    const visitedElements = new Set<HTMLElement>();

    // 0. 收集主容器及所有可访问的同源 iframe 页面。
    // ATS 常见「门户 iframe → 表单 iframe」两层甚至多层嵌套，不能只扫描
    // container 的直接子 iframe；按文档队列递归遍历并去重。
    const documentsToScan: (Document | HTMLElement)[] = [container];
    const queuedDocuments = new Set<Document>();
    const queue: (Document | HTMLElement)[] = [container];

    while (queue.length > 0) {
      const currentRoot = queue.shift()!;
      const currentDoc = currentRoot.nodeType === 9
        ? currentRoot as Document
        : currentRoot.ownerDocument;
      if (!currentDoc) continue;

      // Document 根节点只需处理一次；HTMLElement 根节点则由调用方限定扫描范围，
      // 不能为了找 iframe 把整个 ownerDocument 再加入候选。
      if (currentRoot.nodeType === 9) {
        if (queuedDocuments.has(currentDoc)) continue;
        queuedDocuments.add(currentDoc);
      }

      try {
        const iframes = Array.from(currentRoot.querySelectorAll<HTMLIFrameElement>('iframe, frame'));
        for (const iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && !queuedDocuments.has(iframeDoc)) {
              documentsToScan.push(iframeDoc);
              queue.push(iframeDoc);
            }
          } catch {
            // 跨域 iframe (SecurityError) 静默忽略，主文档和其他同源 frame 继续。
          }
        }
      } catch {
        // 页面切换期间文档可能暂时不可查询，保留已收集的候选。
      }
    }

    const allCandidateElements: HTMLElement[] = [];
    const customComponentSelector = [
      '.el-select', '.ant-select', '.semi-select', '[role="combobox"]', '[class*="select-selection"]',
      '.el-cascader', '.ant-cascader', '.semi-cascader', '.ivu-cascader', '[class*="cascader"]',
      '.mtd-select', '.mtd-picker', '.layui-form-select', '.ivu-select',
      '.pop-input', '.datepicker-input', '.input-layer',
      '.el-date-editor', '.ant-picker', '.semi-datepicker', '[class*="date-picker"]', '[class*="datepicker"]',
      '[class*="date-range"]', '[class*="daterange"]', '[data-openjobfill-date-group]',
      '[role="radio"]', '[role="checkbox"]', '[aria-pressed]',
    ].join(',');

    for (const targetDoc of documentsToScan) {
      try {
        const roots = getAllOpenRoots(targetDoc);
        const nativeInputs = roots.flatMap((root) => Array.from(
          root.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable="true"]')
        ));
        const customComponents = roots.flatMap((root) =>
          Array.from(root.querySelectorAll<HTMLElement>(customComponentSelector))
        );

        // 外层日期/选择组件已经代表一个逻辑字段时，移除它内部重复命中的组件根。
        const topLevelCustomComponents = customComponents.filter(
          (component) => !customComponents.some((other) => other !== component && other.contains(component))
        );

        // 组件库的可搜索下拉通常同时包含一个内部 input。规划阶段只保留
        // 组件根节点，否则同一个控件会生成两条计划并被重复操作。
        const standaloneNativeInputs = nativeInputs.filter(
          (el) => !topLevelCustomComponents.some((component) => component !== el && component.contains(el))
        );
        allCandidateElements.push(...standaloneNativeInputs, ...topLevelCustomComponents);
      } catch {}
    }

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
      const sectionTitle = section.rawTitle || section.type;

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
        fingerprint: createElementFingerprint(el, sectionTitle, section.index),
        safety: inspectFieldSafety(el, label, contextText),
      });
    }

    return descriptors;
  }

  private shouldSkipElement(el: HTMLElement): boolean {
    if (isInputElement(el)) {
      if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) {
        return true;
      }
    }
    // 判断元素是否在页面上可见 (通过元素自身的 Window 计算样式)
    const win = getElementWindow(el);
    const style = win.getComputedStyle ? win.getComputedStyle(el) : null;
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
    if (isTextAreaElement(el)) {
      return 'textarea';
    }
    if (isSelectElement(el)) {
      return 'select';
    }
    const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    // Cascader 组件名中也常带 picker（如 ant-cascader-picker），必须先于日期判断。
    if (/cascader/.test(className) || el.getAttribute('role') === 'cascader') {
      return 'cascader';
    }
    if (
      /(^|\s)(el-select|ant-select|semi-select|mtd-select|layui-form-select|ivu-select)(\s|$)/.test(className) ||
      el.getAttribute('role') === 'combobox'
    ) {
      return 'select';
    }
    const dateInputs = el.querySelectorAll?.('input[type="date"], input[type="month"], input') || [];
    const dateSelects = el.querySelectorAll?.('select, .el-select, .ant-select, .semi-select') || [];
    const isDateComponent =
      /date|picker/.test(className) ||
      el.hasAttribute('data-openjobfill-date-group') ||
      el.getAttribute('role') === 'dialog';

    if (isDateComponent && dateInputs.length >= 2 && /range|daterange/.test(className)) {
      return 'date-range';
    }
    if (isDateComponent && (dateInputs.length > 0 || dateSelects.length >= 2)) {
      return 'date';
    }
    if (el.getAttribute('role') === 'radio' || el.hasAttribute('aria-pressed')) return 'radio';
    if (el.getAttribute('role') === 'checkbox') return 'checkbox';
    if (isInputElement(el)) {
      if (el.type === 'radio') return 'radio';
      if (el.type === 'checkbox') return 'checkbox';
      if (
        el.type === 'date' ||
        el.type === 'month' ||
        el.classList.contains('datepicker') ||
        /日期|时间|年月|date|month|year|yyyy/i.test(`${el.placeholder} ${el.name} ${el.getAttribute('aria-label') || ''}`)
      ) {
        return 'date';
      }
      return 'text';
    }
    return 'unknown';
  }

  private detectRequired(el: HTMLElement, labelText: string): boolean {
    return isFieldRequired(el, labelText);
  }

  private readCurrentValue(el: HTMLElement, type: FieldType): any {
    if (isInputElement(el) || isTextAreaElement(el)) {
      if (type === 'radio' || type === 'checkbox') {
        return (el as HTMLInputElement).checked;
      }
      return el.value;
    }
    if (isSelectElement(el)) {
      return el.value;
    }
    if (type === 'contenteditable') {
      return el.innerText || el.textContent || '';
    }
    if (type === 'date' || type === 'date-range') {
      const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
      if (type === 'date-range') return inputs.map((input) => input.value).filter(Boolean);
      if (inputs.length > 0) return inputs[0].value;
      const selects = Array.from(el.querySelectorAll<HTMLSelectElement>('select'));
      return selects.map((select) => select.value).filter(Boolean).join('-');
    }
    return '';
  }

  private extractOptions(el: HTMLElement, type: FieldType): string[] | undefined {
    if (isSelectElement(el)) {
      return Array.from(el.options).map((o) => o.text.trim()).filter(Boolean);
    }
    if (type === 'radio') {
      const name = el.getAttribute('name');
      const doc = el.ownerDocument || document;
      const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || doc;
      const groupRadios = name
        ? Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`))
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
