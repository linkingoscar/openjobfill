import { setNativeValue, simulateClick } from './dispatcher';
import { sleep } from '../../utils/dom';

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
  if (!dateInput || !rawDate) return false;

  const formatted = normalizeDate(rawDate);
  const formattedMonthOnly = normalizeDate(rawDate, 'YYYY-MM');

  // 1. 如果支持直接赋值（非完全只读或可通过 native setter 写入）
  let success = setNativeValue(dateInput, formatted);

  // 2. 如果页面有只读属性导致直接填入无效，先尝试临时解除只读并触发
  if (dateInput.readOnly) {
    dateInput.readOnly = false;
    success = setNativeValue(dateInput, formatted) || setNativeValue(dateInput, formattedMonthOnly);
  }

  // 3. 模拟触发一次回车或失焦以触发校验并关闭日期下拉面板
  dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  dateInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  await sleep(60);

  return success;
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
    if (startDate) await fillDatePicker(startInput, startDate);
    if (endDate) await fillDatePicker(endInput, endDate);
    return true;
  }
  return false;
}

