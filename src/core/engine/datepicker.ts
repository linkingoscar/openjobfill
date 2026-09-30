import { dateEngine } from '../resolvers/dateEngine';
import { isInputElement } from '../../utils/dom';

/** Manual/legacy callers share the same date interaction and validation as the pipeline. */
export async function fillDatePicker(dateInput: HTMLInputElement, rawDate: string): Promise<boolean> {
  if (!dateInput || !rawDate || !isInputElement(dateInput)) return false;
  return dateEngine.injectSemanticDate(dateInput, rawDate);
}

export async function fillDateRangePicker(container: HTMLElement, startDate: string, endDate: string): Promise<boolean> {
  if (!container) return false;
  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'));
  if (inputs.length < 2 || (!startDate && !endDate)) return false;
  const startOk = !startDate || await fillDatePicker(inputs[0], startDate);
  const endOk = !endDate || await fillDatePicker(inputs[1], endDate);
  return startOk && endOk;
}
