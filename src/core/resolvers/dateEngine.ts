import { setNativeValue } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { isInputElement } from '../../utils/dom';

export interface SemanticDate {
  year: number;
  month: number;
  day?: number | null;
  isPresent?: boolean;
  raw: string;
}

export class DateEngine {
  /**
   * 将任意形式的日期字符串解析为结构化的 SemanticDate
   */
  parseSemanticDate(rawDateStr: string): SemanticDate {
    if (!rawDateStr) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1, raw: '' };
    }

    const clean = rawDateStr.trim();
    if (/至今|目前|现在|present/i.test(clean)) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        isPresent: true,
        raw: clean,
      };
    }

    // 提取数字部分
    const digits = clean.replace(/[年月\./日]/g, '-').split('-').filter(Boolean).map((d) => parseInt(d, 10));

    if (digits.length >= 3) {
      return {
        year: digits[0] < 100 ? 2000 + digits[0] : digits[0],
        month: digits[1],
        day: digits[2],
        isPresent: false,
        raw: clean,
      };
    } else if (digits.length === 2) {
      return {
        year: digits[0] < 100 ? 2000 + digits[0] : digits[0],
        month: digits[1],
        isPresent: false,
        raw: clean,
      };
    } else if (digits.length === 1 && digits[0] > 1970) {
      return {
        year: digits[0],
        month: 1,
        isPresent: false,
        raw: clean,
      };
    }

    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, raw: clean };
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
  async injectSemanticDate(el: HTMLElement, rawDateStr: string): Promise<boolean> {
    const semantic = this.parseSemanticDate(rawDateStr);

    // 1. 如果是原生 input[type="date"]
    if (isInputElement(el) && (el.type === 'date' || el.type === 'month')) {
      // 「至今」是经历结束日期的业务语义，不是 native date/month 的合法值。
      // 不写入非法字符串，交给待办清单让用户确认“至今”或页面专属控件。
      if (semantic.isPresent) return false;

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
        if (semantic.isPresent) return false;

        // 第一个下拉通常为年份，第二个为月份
        const yearSelect = allSelects[0];
        const monthSelect = allSelects[1];

        const yearTarget = String(semantic.year);
        const monthTarget = String(semantic.month);

        const yearOk = await selectCustomOption(yearSelect, yearTarget);
        const monthOk = await selectCustomOption(monthSelect, monthTarget);
        return yearOk && monthOk;
      }
    }

    // 3. 针对普通文本输入框：根据 placeholder 或格式特征注入
    const placeholder = el.getAttribute('placeholder') || '';
    let targetFormat: 'YYYY-MM' | 'YYYY-MM-DD' | 'YYYY年MM月' | 'MM/YYYY' = 'YYYY-MM';

    if (placeholder.includes('日') || placeholder.includes('DD')) {
      targetFormat = 'YYYY-MM-DD';
    } else if (placeholder.includes('年') || placeholder.includes('月')) {
      targetFormat = 'YYYY年MM月';
    } else if (placeholder.includes('/')) {
      targetFormat = 'MM/YYYY';
    }

    const formattedText = this.formatDate(semantic, targetFormat);
    return setNativeValue(el, formattedText);
  }
}

export const dateEngine = new DateEngine();
