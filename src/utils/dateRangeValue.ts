import { isInputElement } from './dom';

/** Read committed date controls, excluding toggles and hidden component state. */
export function readDateRangeValue(root: HTMLElement): { startDate: string; endDate: string } {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'));
  const present = Array.from(root.querySelectorAll<HTMLElement>('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [aria-pressed]')).some(control => {
    const label = isInputElement(control) ? Array.from(control.labels || []).map(item => item.textContent || '').join(' ') : '';
    const text = [label, control.textContent, control.getAttribute('aria-label')].filter(Boolean).join(' ');
    if (!/至今|目前|现在|\bpresent\b|\bcurrent\b/i.test(text)) return false;
    return isInputElement(control) ? control.checked : control.getAttribute('aria-checked') === 'true' || control.getAttribute('aria-pressed') === 'true';
  });
  return { startDate: inputs[0]?.value || '', endDate: present ? '至今' : inputs[1]?.value || '' };
}
