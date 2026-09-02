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
import { buildFieldLocator } from './fieldLocator';

const CONTROL_TRIGGER_SELECTORS = [
  '.el-select', '.el-select__wrapper', '.el-autocomplete', '.el-cascader', '.el-cascader__wrapper', '.el-date-editor',
  '.ant-select', '.ant-cascader', '.ant-cascader-picker', '.ant-picker', '.ant-calendar-picker',
  '.semi-select', '.semi-cascader', '.semi-datepicker', '.mtd-select', '.mtd-picker', '.mtd-month-picker',
  '.layui-form-select', '.ivu-select', '.ivu-cascader', '.aui-select', '.atsx-select', '.atsx-date-picker', '.ud-select',
  '.phoenix-input', '.phoenix-select', '.sc-input', '.sc-select', '.hc-super-selector',
  '.tp-select-box', '.tp-ethnic-picker', '.tp-date-picker', '.sd-input', '.sd-dropdown',
  '.mokahr-search-dropdown', '.mokahr-region-dropdown', '.mokahr-date-dropdown', '.mokahr-simple-dropdown',
  '.zhipin-select', '.zhipin-date-picker', '.zhipin-dialog-trigger',
  '.lagou-calendar', '.lagou-editor', '.shixiseng-city',
  '.job51-three-layer', '.setday', '.pop-input', '.bankcomm-select', '.Wdate',
  '[class*="three-layer"]', '[class*="threeLayer"]', '[class*="super-selector"]', '[class*="superSelector"]',
  '[class*="region-cascader"]', '[class*="calendar-picker"]', '[class*="ethnic-picker"]',
  '[class*="date-picker"]', '[class*="datepicker"]', '[class*="date-range"]', '[class*="daterange"]',
  '[class*="feishu"][class*="month"]', '[class*="thundersoft"][class*="month"]',
  '[class*="moka"][class*="month"]', '[class*="linked-select"]', '[class*="linkage"]',
  '[class*="phone-field"]', '[class*="mobile-field"]', '[data-openjobfill-date-group]',
];
const FORM_CONTROL_SELECTOR = [
  'input', 'textarea', 'select', '[contenteditable="true"]', '[role="combobox"]', '[role="radio"]', '[role="checkbox"]',
  ...CONTROL_TRIGGER_SELECTORS,
].join(',');
const FORM_ROOT_SELECTOR = [
  'form',
  '[role="form"]',
  '[data-application-form]',
  '.application-form',
  '.apply-form',
  '.resume-form',
  '.ant-form',
  '.el-form',
  '.semi-form',
  '.moka-application-form',
  '[data-automation-id="applicationForm"]',
  '[data-automation-id="jobApplication"]',
  '[class*="application-form"]',
  '[class*="apply-form"]',
  '[class*="resume-form"]',
].join(',');

export interface FormRootDiagnostic {
  documentIndex: number;
  root: string;
  inputCount: number;
  sectionMatchCount: number;
  score: number;
  selected: boolean;
  fallback: boolean;
}

export interface PageScanDiagnostics {
  documentsScanned: number;
  fallbackDocumentCount: number;
  formRoots: FormRootDiagnostic[];
}

export class PageAnalyzer {
  private lastDiagnostics: PageScanDiagnostics = {
    documentsScanned: 0,
    fallbackDocumentCount: 0,
    formRoots: [],
  };

  getLastDiagnostics(): PageScanDiagnostics {
    return {
      documentsScanned: this.lastDiagnostics.documentsScanned,
      fallbackDocumentCount: this.lastDiagnostics.fallbackDocumentCount,
      formRoots: this.lastDiagnostics.formRoots.map((item) => ({ ...item })),
    };
  }

  /**
   * 深度扫描页面表单控件，生成结构化的 FieldDescriptor[]
   */
  analyzePage(container: Document | HTMLElement = document): FieldDescriptor[] {
    const descriptors: FieldDescriptor[] = [];
    const visitedElements = new Set<HTMLElement>();
    this.lastDiagnostics = { documentsScanned: 0, fallbackDocumentCount: 0, formRoots: [] };

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
      ...CONTROL_TRIGGER_SELECTORS,
      '[role="combobox"]', '[class*="select-selection"]', '[class*="cascader"]',
      '.datepicker-input', '.input-layer', '[role="radio"]', '[role="checkbox"]', '[aria-pressed]',
    ].join(',');

    this.lastDiagnostics.documentsScanned = documentsToScan.length;
    for (const [documentIndex, targetDoc] of documentsToScan.entries()) {
      try {
        const availableRoots = getAllOpenRoots(targetDoc);
        const roots = targetDoc.nodeType === 9
          ? this.selectFormRoots(availableRoots, documentIndex)
          : availableRoots;
        const nativeSelector = 'input, textarea, select, [contenteditable="true"]';
        const nativeInputs = roots.flatMap((root) => [
          ...(root instanceof HTMLElement && root.matches(nativeSelector) ? [root] : []),
          ...Array.from(root.querySelectorAll<HTMLElement>(nativeSelector)),
        ]);
        const customComponents = roots.flatMap((root) => [
          ...(root instanceof HTMLElement && root.matches(customComponentSelector) ? [root] : []),
          ...Array.from(root.querySelectorAll<HTMLElement>(customComponentSelector)),
        ]).filter((component) => !component.matches([
          '.ant-select-dropdown', '.ant-cascader-menus', '.el-select-dropdown', '.el-cascader__dropdown',
          '.el-autocomplete-suggestion', '.ivu-select-dropdown', '.mtd-select-dropdown', '.cascader-modal',
          '.my-cascader-modal', '.pop-panel', '.dialog-box', '[role="listbox"]',
        ].join(',')));

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
        locator: buildFieldLocator(el, section, label),
        safety: inspectFieldSafety(el, label, contextText),
      });
    }

    return descriptors;
  }

  private describeRoot(root: ParentNode): string {
    if (!(root instanceof HTMLElement)) return root.nodeType === 9 ? 'document' : 'shadow-root';
    const id = root.id ? `#${root.id.slice(0, 80)}` : '';
    const classes = typeof root.className === 'string'
      ? root.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';
    return `${root.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ''}`.slice(0, 180);
  }

  private scoreFormRoot(root: HTMLElement): Omit<FormRootDiagnostic, 'documentIndex' | 'selected' | 'fallback'> {
    const inputCount = root.querySelectorAll(FORM_CONTROL_SELECTOR).length;
    const structuralText = `${root.id} ${root.className} ${root.getAttribute('aria-label') || ''}`.toLowerCase();
    const visibleText = (root.textContent || '').replace(/\s+/g, ' ').slice(0, 5000).toLowerCase();
    const combined = `${structuralText} ${visibleText}`;
    const sectionKeywords = [
      /基本信息|个人信息|personal information/,
      /教育经历|学历|education/,
      /工作经历|实习经历|employment|work experience/,
      /项目经历|project experience/,
      /求职申请|职位申请|application|apply now/,
    ];
    const sectionMatchCount = sectionKeywords.filter((pattern) => pattern.test(combined)).length;
    const applicationHint = /申请|应聘|简历|候选人|招聘|application|candidate|resume|career/.test(combined);
    const unrelatedHint = /登录|注册|站内搜索|搜索职位|sign.?in|log.?in|search/.test(combined)
      && sectionMatchCount === 0;
    let score = root.tagName === 'FORM' ? 4 : 1;
    score += Math.min(12, inputCount * 1.5);
    score += sectionMatchCount * 3;
    if (applicationHint) score += 5;
    if (unrelatedHint) score -= 8;

    try {
      const rect = root.getBoundingClientRect();
      const viewportArea = Math.max(1, (root.ownerDocument.defaultView?.innerWidth || 0)
        * (root.ownerDocument.defaultView?.innerHeight || 0));
      const ratio = Math.max(0, rect.width * rect.height) / viewportArea;
      if (ratio >= 0.15 && ratio <= 2) score += 2;
    } catch {
      // Layout information is optional in test DOMs and detached documents.
    }

    return {
      root: this.describeRoot(root),
      inputCount,
      sectionMatchCount,
      score: Math.round(score * 10) / 10,
    };
  }

  private selectFormRoots(roots: ParentNode[], documentIndex: number): ParentNode[] {
    const candidates = new Set<HTMLElement>();
    for (const root of roots) {
      if (root instanceof HTMLElement && root.matches(FORM_ROOT_SELECTOR)) candidates.add(root);
      for (const candidate of Array.from(root.querySelectorAll<HTMLElement>(FORM_ROOT_SELECTOR))) {
        candidates.add(candidate);
      }
    }

    const scored = [...candidates]
      .map((element) => ({ element, ...this.scoreFormRoot(element) }))
      .filter((candidate) => candidate.inputCount > 0)
      .sort((a, b) => b.score - a.score);
    const reliable = scored.filter((candidate) => candidate.score >= 8
      && (candidate.inputCount >= 2 || candidate.sectionMatchCount > 0));
    const selected: HTMLElement[] = [];
    for (const candidate of reliable) {
      if (selected.some((root) => root.contains(candidate.element))) continue;
      selected.push(candidate.element);
    }

    for (const candidate of scored) {
      this.lastDiagnostics.formRoots.push({
        documentIndex,
        root: candidate.root,
        inputCount: candidate.inputCount,
        sectionMatchCount: candidate.sectionMatchCount,
        score: candidate.score,
        selected: selected.includes(candidate.element),
        fallback: false,
      });
    }

    if (selected.length > 0) {
      // 重新从已选表单根出发收集 ShadowRoot。不能只依赖 Document 扫描结果里的
      // host.contains() 关联：部分 DOM 实现对跨树 contains 的行为不一致，且嵌套
      // shadow tree 也需要沿着表单子树继续递归发现。
      const associatedShadowRoots = new Set<ParentNode>();
      for (const formRoot of selected) {
        for (const root of getAllOpenRoots(formRoot).slice(1)) associatedShadowRoots.add(root);
      }
      return [...selected, ...associatedShadowRoots];
    }
    this.lastDiagnostics.fallbackDocumentCount++;
    this.lastDiagnostics.formRoots.push({
      documentIndex,
      root: 'document',
      inputCount: roots.reduce((total, root) => total + root.querySelectorAll(FORM_CONTROL_SELECTOR).length, 0),
      sectionMatchCount: 0,
      score: 0,
      selected: true,
      fallback: true,
    });
    return roots;
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
    if (
      /cascader|three-layer|threelayer|linked-select|super-selector|region-dropdown|city-picker/.test(className)
      || el.getAttribute('role') === 'cascader'
    ) {
      return 'cascader';
    }
    if (
      /(^|\s)(el-select|ant-select|semi-select|mtd-select|layui-form-select|ivu-select|aui-select|atsx-select|ud-select|phoenix-select|sc-select|tp-select-box|tp-ethnic-picker|sd-dropdown|mokahr-search-dropdown|mokahr-simple-dropdown|zhipin-select|zhipin-dialog-trigger|bankcomm-select|pop-input)(\s|$)/.test(className) ||
      el.getAttribute('role') === 'combobox'
    ) {
      return 'select';
    }
    const dateInputs = el.querySelectorAll?.('input[type="date"], input[type="month"], input') || [];
    const dateSelects = el.querySelectorAll?.('select, .el-select, .ant-select, .semi-select') || [];
    const isDateRangeComponent = /date-range|daterange|picker-range|month-range|monthrange/.test(className)
      || el.hasAttribute('data-openjobfill-date-group');
    const isExplicitMonthRange = /month-range|monthrange/.test(className)
      || /(?:feishu|thundersoft).*month/.test(className);
    const isDateComponent =
      /(^|\s)(ant-picker|ant-calendar-picker|el-date-editor|semi-datepicker|mtd-picker|mtd-month-picker|atsx-date-picker|tp-date-picker|mokahr-date-dropdown|zhipin-date-picker|lagou-calendar|setday|wdate|date-input)(\s|$)/.test(className) ||
      /date-picker|datepicker|calendar-picker/.test(className) ||
      /(?:moka|feishu|thundersoft).*month/.test(className) ||
      el.hasAttribute('data-openjobfill-date-group') ||
      el.getAttribute('role') === 'dialog';

    if (
      isExplicitMonthRange
      || el.hasAttribute('data-openjobfill-date-group')
      || isDateRangeComponent && dateInputs.length >= 2
    ) {
      return 'date-range';
    }
    // “date-range” 也常被年月组合控件用作容器名；两个 year/month select
    // 表示一个日期，而不是开始/结束两个日期。
    if (isDateComponent || isDateRangeComponent && dateSelects.length >= 2) {
      return 'date';
    }
    if (el.getAttribute('role') === 'radio' || el.hasAttribute('aria-pressed')) return 'radio';
    if (el.getAttribute('role') === 'checkbox') return 'checkbox';
    if (isInputElement(el)) {
      if (el.type === 'radio') return 'radio';
      if (el.type === 'checkbox') return 'checkbox';
      const dateIdentity = `${el.placeholder} ${el.name} ${el.id} ${el.getAttribute('aria-label') || ''}`;
      const hasDateSemantic = /日期|时间|年月/i.test(dateIdentity)
        || /(?:^|[-_\s])(date|month|year|yyyy)(?:[-_\s]|$)/i.test(dateIdentity)
        || /birthdate|startdate|enddate|graduationdate|availabledate/i.test(dateIdentity);
      if (
        el.type === 'date' ||
        el.type === 'month' ||
        el.classList.contains('datepicker') ||
        hasDateSemantic
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
