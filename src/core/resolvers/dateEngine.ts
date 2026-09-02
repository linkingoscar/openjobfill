import { setNativeValue, simulateClick } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { getAllOpenRoots, isElementVisible, isInputElement, sleep } from '../../utils/dom';
import { throwIfAborted } from '../pipeline/runContext';

export interface SemanticDate {
  year: number;
  month: number;
  day?: number | null;
  isPresent?: boolean;
  valid?: boolean;
  raw: string;
}

export class DateEngine {
  private findPresentControl(el: HTMLElement): HTMLElement | null {
    const container =
      el.closest('.form-item, .form-group, .form-row, .ant-form-item, .el-form-item') ||
      el.closest('[class*="date"], [class*="picker"]') ||
      el.parentElement ||
      el;
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(
      'label, button, [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"], [aria-pressed]'
    ));
    const matched = candidates.find((candidate) => /至今|目前|现在|present|current/i.test(
      candidate.textContent || candidate.getAttribute('aria-label') || ''
    ));
    if (!matched) return null;
    if (matched.tagName === 'LABEL') {
      return matched.querySelector<HTMLElement>(
        'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], button, [aria-pressed]'
      ) || matched;
    }
    return matched;
  }

  private visibleCalendarItems(popup: HTMLElement): HTMLElement[] {
    return Array.from(popup.querySelectorAll<HTMLElement>(
      '.ant-picker-cell, .el-year-table td, .el-month-table td, .semi-datepicker-year, ' +
      '.semi-datepicker-month, .mtd-calendar-cell, .atsx-calendar-cell, .tp-calendar-cell, ' +
      '.WdayTable td, [role="gridcell"], [data-year], [data-month]'
    )).filter((item) => isElementVisible(item) && item.getAttribute('aria-disabled') !== 'true');
  }

  private findCalendarItem(popup: HTMLElement, values: string[]): HTMLElement | null {
    const expected = new Set(values.map((value) => value.replace(/\s+/g, '').toLowerCase()));
    return this.visibleCalendarItems(popup).find((item) => {
      const actual = [
        item.textContent || '',
        item.getAttribute('title') || '',
        item.getAttribute('data-value') || '',
        item.getAttribute('data-year') || '',
        item.getAttribute('data-month') || '',
      ].map((value) => value.replace(/\s+/g, '').toLowerCase());
      return actual.some((value) => expected.has(value));
    }) || null;
  }

  private calendarHeaderText(popup: HTMLElement): string {
    const headers = Array.from(popup.querySelectorAll<HTMLElement>(
      '.ant-picker-header, .el-date-picker__header, .semi-datepicker-header, ' +
      '.mtd-calendar-header, .WdateDiv .MTitle, [class*="picker-header"], [class*="calendar-header"]'
    )).filter(isElementVisible);
    const text = headers.length > 0
      ? headers.map((header) => header.textContent || '').join('')
      : popup.textContent || '';
    return text.replace(/\s+/g, '');
  }

  private async alignCalendarView(popup: HTMLElement, semantic: SemanticDate, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    const year = String(semantic.year);
    const month = String(semantic.month);
    const paddedMonth = month.padStart(2, '0');
    let headerText = this.calendarHeaderText(popup);

    if (!headerText.includes(year)) {
      const yearSwitch = Array.from(popup.querySelectorAll<HTMLElement>(
        '.ant-picker-year-btn, .el-date-picker__header-label, [class*="year-btn"], [class*="year-label"]'
      )).find(isElementVisible);
      if (yearSwitch) {
        simulateClick(yearSwitch);
        await sleep(100, signal);

        // Ant/Element 的年份面板通常按十年分页。只在能读出年份范围时定向翻页，
        // 最多 24 次，覆盖正常求职经历日期且不会无限循环。
        for (let page = 0; page < 24; page++) {
          const yearCell = this.findCalendarItem(popup, [year, `${year}年`]);
          if (yearCell) {
            simulateClick(yearCell);
            await sleep(100, signal);
            break;
          }
          const visibleYears = this.visibleCalendarItems(popup)
            .map((item) => Number((item.textContent || '').match(/\d{4}/)?.[0]))
            .filter((value) => Number.isFinite(value));
          if (visibleYears.length === 0) break;
          const goPrevious = semantic.year < Math.min(...visibleYears);
          const goNext = semantic.year > Math.max(...visibleYears);
          if (!goPrevious && !goNext) break;
          const navSelector = goPrevious
            ? '.ant-picker-header-super-prev-btn, .el-picker-panel__icon-btn.d-arrow-left, [class*="super-prev"]'
            : '.ant-picker-header-super-next-btn, .el-picker-panel__icon-btn.d-arrow-right, [class*="super-next"]';
          const nav = Array.from(popup.querySelectorAll<HTMLElement>(navSelector)).find(isElementVisible);
          if (!nav) break;
          simulateClick(nav);
          await sleep(80, signal);
        }
      }
    }

    headerText = this.calendarHeaderText(popup);
    if (!headerText.includes(`${month}月`) && !headerText.includes(`${paddedMonth}月`)) {
      let monthCell = this.findCalendarItem(popup, [
        `${semantic.year}-${paddedMonth}`, `${month}月`, `${paddedMonth}月`,
      ]);
      if (!monthCell) {
        const monthSwitches = Array.from(popup.querySelectorAll<HTMLElement>(
          '.ant-picker-month-btn, .el-date-picker__header-label, [class*="month-btn"], [class*="month-label"]'
        )).filter(isElementVisible);
        const monthSwitch = monthSwitches.find((item) => /月|month/i.test(item.textContent || item.className)) || monthSwitches.at(-1);
        if (monthSwitch) {
          simulateClick(monthSwitch);
          await sleep(100, signal);
          monthCell = this.findCalendarItem(popup, [
            `${semantic.year}-${paddedMonth}`, `${month}月`, `${paddedMonth}月`,
          ]);
        }
      }
      if (monthCell) {
        simulateClick(monthCell);
        await sleep(100, signal);
      }
    }
  }

  private async selectVisibleCalendarCell(el: HTMLElement, semantic: SemanticDate, signal?: AbortSignal): Promise<boolean> {
    const doc = el.ownerDocument || document;
    const y = String(semantic.year);
    const m = String(semantic.month).padStart(2, '0');
    const d = String(semantic.day || 1).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;
    const isoMonth = `${y}-${m}`;
    const popupSelectors = [
      '.ant-picker-dropdown', '.el-picker-panel', '.semi-datepicker', '[class*="picker-panel"]',
      '.mtd-picker-panel', '.atsx-date-panel', '.tp-date-panel', '.zhipin-date-panel',
      '.lagou-calendar', '.WdateDiv', '#dpHolder', '[class*="calendar-panel"]', '[role="dialog"]', '[role="grid"]',
    ].join(',');

    let roots: ParentNode[] = [];
    let rootsRefreshedAt = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      throwIfAborted(signal);
      if (roots.length === 0 || Date.now() - rootsRefreshedAt >= 240) {
        roots = getAllOpenRoots(doc);
        rootsRefreshedAt = Date.now();
      }
      const popups = roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(popupSelectors))).filter(isElementVisible);
      for (const popup of popups) {
        if (attempt === 0) await this.alignCalendarView(popup, semantic, signal);
        const exactSelectors = [
          `[data-date="${isoDate}"]`, `[data-value="${isoDate}"]`, `[title="${isoDate}"]`,
          `[data-month="${isoMonth}"]`, `[data-value="${isoMonth}"]`, `[title="${isoMonth}"]`,
        ];
        for (const selector of exactSelectors) {
          const target = popup.querySelector<HTMLElement>(selector);
          if (target && isElementVisible(target) && target.getAttribute('aria-disabled') !== 'true') {
            simulateClick(target);
            await sleep(120, signal);
            return true;
          }
        }

        // 当前年月已显示时，允许按日文本匹配；避免跨月面板误点同一个“18”。
        const headerText = this.calendarHeaderText(popup);
        if (semantic.day && headerText.includes(y) && (headerText.includes(`${semantic.month}月`) || headerText.includes(m))) {
          const cells = Array.from(popup.querySelectorAll<HTMLElement>(
            '.ant-picker-cell, .el-date-table td, .semi-datepicker-day, .mtd-calendar-cell, ' +
            '.atsx-calendar-cell, .tp-calendar-cell, .WdayTable td, [role="gridcell"]'
          )).filter((cell) => isElementVisible(cell) && cell.getAttribute('aria-disabled') !== 'true');
          const dayCell = cells.find((cell) => (cell.textContent || '').trim() === String(semantic.day));
          if (dayCell) {
            simulateClick(dayCell);
            await sleep(120, signal);
            return true;
          }
        }
      }
      await sleep(60, signal);
    }
    return false;
  }

  /**
   * 将任意形式的日期字符串解析为结构化的 SemanticDate
   */
  parseSemanticDate(rawDateStr: string): SemanticDate {
    if (!rawDateStr) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1, raw: '', valid: false };
    }

    const clean = rawDateStr.trim();
    if (/至今|目前|现在|present/i.test(clean)) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        isPresent: true,
        valid: true,
        raw: clean,
      };
    }

    const monthFirst = clean.match(/^(0?[1-9]|1[0-2])[\/\-.](\d{4})$/);
    if (monthFirst) {
      return { year: Number(monthFirst[2]), month: Number(monthFirst[1]), isPresent: false, valid: true, raw: clean };
    }

    // 提取数字部分
    const digits = clean.replace(/[年月\./日]/g, '-').split('-').filter(Boolean).map((d) => parseInt(d, 10));

    if (digits.length >= 3) {
      const year = digits[0] < 100 ? 2000 + digits[0] : digits[0];
      const month = digits[1];
      const day = digits[2];
      const calendarDate = new Date(Date.UTC(year, month - 1, day));
      return {
        year,
        month,
        day,
        isPresent: false,
        valid:
          year >= 1900 && year <= 2200 &&
          calendarDate.getUTCFullYear() === year &&
          calendarDate.getUTCMonth() === month - 1 &&
          calendarDate.getUTCDate() === day,
        raw: clean,
      };
    } else if (digits.length === 2) {
      const year = digits[0] < 100 ? 2000 + digits[0] : digits[0];
      const month = digits[1];
      return {
        year,
        month,
        isPresent: false,
        valid: year >= 1900 && year <= 2200 && month >= 1 && month <= 12,
        raw: clean,
      };
    } else if (digits.length === 1 && digits[0] > 1970) {
      return {
        year: digits[0],
        month: 1,
        isPresent: false,
        valid: digits[0] <= 2200,
        raw: clean,
      };
    }

    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, raw: clean, valid: false };
  }

  /**
   * 格式化 SemanticDate 为指定格式
   */
  formatDate(date: SemanticDate, format: 'YYYY-MM' | 'YYYY-MM-DD' | 'YYYY年MM月' | 'MM/YYYY' | 'YYYY'): string {
    if (date.isPresent) {
      return '至今';
    }

    const y = String(date.year);
    const m = String(date.month).padStart(2, '0');
    const d = date.day ? String(date.day).padStart(2, '0') : '01';

    switch (format) {
      case 'YYYY-MM-DD':
        return `${y}-${m}-${d}`;
      case 'YYYY年MM月':
        return `${y}年${m}月`;
      case 'MM/YYYY':
        return `${m}/${y}`;
      case 'YYYY':
        return y;
      case 'YYYY-MM':
      default:
        return `${y}-${m}`;
    }
  }

  /**
   * 智能检测日期组件形态并完成结构化注入 (支持原生 input、双下拉框与文本框)
   */
  async injectSemanticDate(el: HTMLElement, rawDateStr: string, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);
    const semantic = this.parseSemanticDate(rawDateStr);
    if (!semantic.valid && !semantic.isPresent) return false;

    if (semantic.isPresent) {
      const presentControl = this.findPresentControl(el);
      if (!presentControl) return false;
      simulateClick(presentControl);
      await sleep(80, signal);
      if (isInputElement(presentControl)) return presentControl.checked;
      return presentControl.getAttribute('aria-checked') === 'true' || presentControl.getAttribute('aria-pressed') === 'true';
    }

    // 1. 如果是原生 input[type="date"]
    if (isInputElement(el) && (el.type === 'date' || el.type === 'month')) {
      // 「至今」是经历结束日期的业务语义，不是 native date/month 的合法值。
      // 不写入非法字符串，交给待办清单让用户确认“至今”或页面专属控件。
      const format = el.type === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
      const formatted = this.formatDate(semantic, format);
      const written = setNativeValue(el, formatted);
      return written && el.value === formatted;
    }

    // 2. 检查当前输入框附近是否存在“年/月双下拉框”组合
    const parentContainer = el.closest('.form-item, .form-group, .form-row, [class*="date"]');
    if (parentContainer) {
      const allSelects = Array.from(parentContainer.querySelectorAll<HTMLElement>('select, .el-select, .ant-select'));
      if (allSelects.length >= 2) {
        // 年/月双下拉没有“至今”的通用合法值；写当前年月会把结束时间
        // 错成今天，宁可留给待办清单让用户选择页面提供的“至今”选项。
        // 第一个下拉通常为年份，第二个为月份
        const yearSelect = allSelects[0];
        const monthSelect = allSelects[1];

        const yearTarget = String(semantic.year);
        const monthTarget = String(semantic.month);

        const yearOk = await selectCustomOption(yearSelect, yearTarget, true, signal);
        const monthOk = await selectCustomOption(monthSelect, monthTarget, true, signal);
        return yearOk && monthOk;
      }
    }

    // 3. 自定义日期组件根：优先尝试其内部输入框，失败后操作可见日历弹层。
    const input = isInputElement(el) ? el : el.querySelector<HTMLInputElement>('input');
    if (!input) return false;
    const placeholder = input.getAttribute('placeholder') || el.getAttribute('placeholder') || '';
    let targetFormat: 'YYYY-MM' | 'YYYY-MM-DD' | 'YYYY年MM月' | 'MM/YYYY' = 'YYYY-MM';

    if (placeholder.includes('日') || placeholder.includes('DD') || semantic.day) {
      targetFormat = 'YYYY-MM-DD';
    } else if (placeholder.includes('年') || placeholder.includes('月')) {
      targetFormat = 'YYYY年MM月';
    } else if (placeholder.includes('/')) {
      targetFormat = 'MM/YYYY';
    }

    const formattedText = this.formatDate(semantic, targetFormat);
    const wasReadOnly = input.readOnly;
    try {
      if (input.readOnly) input.readOnly = false;
      setNativeValue(input, formattedText);
      await sleep(60, signal);
      if (input.value === formattedText || input.value.replace(/[^\d]/g, '').startsWith(formattedText.replace(/[^\d]/g, ''))) {
        return true;
      }
    } finally {
      if (wasReadOnly) input.readOnly = true;
    }

    simulateClick(el === input ? input : el);
    await sleep(100, signal);
    const selected = await this.selectVisibleCalendarCell(el, semantic, signal);
    if (!selected) return false;
    await sleep(80, signal);
    const digits = input.value.replace(/[^\d]/g, '');
    const expectedDigits = this.formatDate(semantic, semantic.day ? 'YYYY-MM-DD' : 'YYYY-MM').replace(/[^\d]/g, '');
    return !!digits && (digits.startsWith(expectedDigits) || expectedDigits.startsWith(digits));
  }
}

export const dateEngine = new DateEngine();
