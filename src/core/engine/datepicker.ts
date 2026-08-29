import { setNativeValue, simulateClick } from './dispatcher';
import { getElementWindow, isInputElement, sleep } from '../../utils/dom';

/**
 * 格式化日期字符串以适配常见 ATS 格式 (YYYY-MM-DD, YYYY-MM, YYYY/MM, YYYY.MM)
 */
export function normalizeDate(rawDate: string, format = 'YYYY-MM-DD'): string {
  if (!rawDate) return '';
  const cleaned = rawDate.replace(/[./年月\s]/g, '-').replace(/日$/, '');
  const parts = cleaned.split('-').filter(Boolean);

  if (parts.length === 2) {
    const [year, month] = parts;
    const formattedMonth = month.padStart(2, '0');
    if (format === 'YYYY-MM') return `${year}-${formattedMonth}`;
    return `${year}-${formattedMonth}-01`;
  }

  if (parts.length === 3) {
    const [year, month, day] = parts;
    const formattedMonth = month.padStart(2, '0');
    const formattedDay = day.padStart(2, '0');
    if (format === 'YYYY-MM') return `${year}-${formattedMonth}`;
    return `${year}-${formattedMonth}-${formattedDay}`;
  }

  return rawDate;
}

/**
 * 处理日期选择组件填入 (单输入框或弹层触发框)
 */
export async function fillDatePicker(
  dateInput: HTMLInputElement,
  rawDate: string
): Promise<boolean> {
  if (!dateInput || !rawDate || !isInputElement(dateInput)) return false;

  const inputType = (dateInput.type || '').toLowerCase();
  const isNativeDate = inputType === 'date' || inputType === 'month';
  // native date/month 只接受 ISO 日期，不能把经历中的“至今”写成无效值。
  if (isNativeDate && /至今|目前|现在|present/i.test(rawDate.trim())) return false;

  const formatted = normalizeDate(rawDate, inputType === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD');
  const formattedMonthOnly = normalizeDate(rawDate, 'YYYY-MM');
  const wasReadOnly = dateInput.readOnly;
  const win = getElementWindow(dateInput) as any;
  const KeyboardEventClass = win.KeyboardEvent || KeyboardEvent;

  try {
    // 1. 如果页面有只读属性导致直接填入无效，先尝试临时解除只读并触发。
    if (dateInput.readOnly) dateInput.readOnly = false;
    let success = setNativeValue(dateInput, formatted);
    if (!success && formattedMonthOnly !== formatted) {
      success = setNativeValue(dateInput, formattedMonthOnly);
    }

    // 2. 模拟触发一次回车或失焦以触发校验并关闭日期下拉面板
    dateInput.dispatchEvent(new KeyboardEventClass('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    dateInput.dispatchEvent(new KeyboardEventClass('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    await sleep(60);

    // setNativeValue 对 native date 的 setter 即使收到非法字符串也可能返回 true；
    // 读回值才能确认浏览器真的接受了日期。
    if (isNativeDate) return success && dateInput.value === formatted;
    return success;
  } finally {
    // 不把页面原本的只读状态永久改掉，避免破坏后续日期选择器交互。
    if (wasReadOnly) dateInput.readOnly = true;
  }
}

/**
 * 针对起止时间成对双输入框组件 (如 Element RangePicker / Antd RangePicker)
 */
export async function fillDateRangePicker(
  container: HTMLElement,
  startDate: string,
  endDate: string
): Promise<boolean> {
  if (!container) return false;

  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
  if (inputs.length >= 2) {
    const startInput = inputs[0];
    const endInput = inputs[1];
    let attempted = false;
    let success = true;
    if (startDate) {
      attempted = true;
      success = (await fillDatePicker(startInput, startDate)) && success;
    }
    if (endDate) {
      attempted = true;
      success = (await fillDatePicker(endInput, endDate)) && success;
    }
    return attempted && success;
  }
  return false;
}
