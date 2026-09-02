import type { FieldDescriptor, DriverType } from '../../types/pipeline';
import { isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';
import { verifyByField, type VerificationResult } from './strictVerification';

export class Verifier {
  async readBack(field: FieldDescriptor, driverType: DriverType): Promise<any> {
    const el = field.element;
    if (driverType === 'input' && (isInputElement(el) || isTextAreaElement(el))) return el.value;

    if (driverType === 'radio') {
      const name = el.getAttribute('name');
      const container = el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') || el.parentElement || el;
      const nameScope: ParentNode = isInputElement(el) && el.form ? el.form : (el.ownerDocument || document);
      const checked = name
        ? nameScope.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]:checked`)
        : container.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      if (checked) return checked.value || checked.parentElement?.textContent?.trim() || true;
      if (isInputElement(el) && el.type === 'radio' && el.checked) return el.value || el.parentElement?.textContent?.trim() || true;
      const customContainer = el.closest('[role="radiogroup"], .radio-group, .form-item, .form-group') || el.parentElement || el;
      const selectedCustom = customContainer.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], [aria-pressed="true"]');
      return selectedCustom ? selectedCustom.getAttribute('data-value') || selectedCustom.textContent?.trim() || true : false;
    }

    if (driverType === 'checkbox') {
      if (isInputElement(el)) return el.checked;
      return el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true';
    }

    if (driverType === 'select' || driverType === 'cascader') {
      if (isSelectElement(el)) {
        const selected = el.options[el.selectedIndex];
        return selected ? selected.text.trim() : el.value;
      }
      const selectedItem = el.querySelector('.el-select__selected-item, .ant-select-selection-item, .semi-select-selection-text, [class*="selected"], [class*="value"]');
      if (selectedItem?.textContent) return selectedItem.textContent.trim();
      return el.textContent?.trim() || '';
    }

    if (driverType === 'date') {
      if (isInputElement(el)) return el.value;
      const input = el.querySelector<HTMLInputElement>('input');
      if (input) return input.value;
      const selects = Array.from(el.querySelectorAll<HTMLSelectElement>('select'));
      return selects.length ? selects.map((select) => select.value).filter(Boolean).join('-') : el.textContent?.trim() || '';
    }

    if (driverType === 'date-range') {
      const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
      const presentControl = Array.from(el.querySelectorAll<HTMLElement>('label, button, [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"], [aria-pressed]')).find((candidate) => {
        const label = candidate.textContent || candidate.getAttribute('aria-label') || '';
        if (!/至今|目前|现在|present|current/i.test(label)) return false;
        if (isInputElement(candidate)) return candidate.checked;
        return candidate.getAttribute('aria-checked') === 'true' || candidate.getAttribute('aria-pressed') === 'true';
      });
      return { startDate: inputs[0]?.value || '', endDate: inputs[1]?.value || (presentControl ? '至今' : '') };
    }

    if (driverType === 'contenteditable') return el.innerText || el.textContent || '';
    return (el as any).value ?? el.textContent ?? undefined;
  }

  verify(actual: unknown, expected: unknown, driverType: DriverType, semanticKey?: string): VerificationResult {
    return verifyByField(actual, expected, driverType, semanticKey);
  }

  isSemanticEquivalent(actual: unknown, expected: unknown, driverType: DriverType, semanticKey?: string): boolean {
    return this.verify(actual, expected, driverType, semanticKey).status === 'VERIFIED';
  }
}

export const verifier = new Verifier();
