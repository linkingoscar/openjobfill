import { readDateRangeValue } from '../../utils/dateRangeValue';
import { getSafeEntityVariants } from '../matcher/aliasDictionary';
import type { FieldDescriptor, DriverType } from '../../types/pipeline';
import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';

export class Verifier {
  /**
   * 写入后从 DOM / 受控组件中读回当前渲染的真实值 (Read-Back)
   */
  async readBack(field: FieldDescriptor, driverType: DriverType): Promise<any> {
    const el = field.element;

    if (driverType === 'input') {
      if (isInputElement(el) || isTextAreaElement(el)) {
        return el.value;
      }
    }

    if (driverType === 'radio') {
      const name = el.getAttribute('name');
      // 找不到分组容器时只能退到父元素，绝不能退到 document ——
      // 否则会把页面上任意一个已选中的 radio 读回成本字段的值，导致校验误判。
      const container =
        el.closest('.radio-group, .el-radio-group, .ant-radio-group, .form-item, .form-group, fieldset') ||
        el.parentElement ||
        el;

      // 按 name 查找时优先限定在同一个 form 内：同名 radio 组在不同表单中可能重复出现
      const nameScope: ParentNode =
        isInputElement(el) && el.form ? el.form : (el.ownerDocument || document);

      const checked = name
        ? nameScope.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]:checked`)
        : container.querySelector<HTMLInputElement>('input[type="radio"]:checked');

      if (checked) {
        return checked.value || checked.parentElement?.textContent?.trim() || true;
      }

      if (isInputElement(el) && el.type === 'radio' && el.checked) {
        return el.value || el.parentElement?.textContent?.trim() || true;
      }
      const customContainer = el.closest('[role="radiogroup"], .radio-group, .form-item, .form-group') || el.parentElement || el;
      const selectedCustom = customContainer.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], [aria-pressed="true"]');
      if (selectedCustom) return selectedCustom.getAttribute('data-value') || selectedCustom.textContent?.trim() || true;
      return false;
    }

    if (driverType === 'checkbox') {
      if (isInputElement(el)) {
        return el.checked;
      }
      return el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true';
    }

    if (driverType === 'select' || driverType === 'cascader') {
      if (isSelectElement(el)) {
        if (el.multiple) return Array.from(el.selectedOptions, option => option.text.trim());
        const selected = el.options[el.selectedIndex];
        return selected ? selected.text.trim() : el.value;
      }
      if (isInputElement(el)) {
        const display = el.closest('[class*="sd-Select"], .sd-dropdown, .mokahr-search-dropdown, .ant-select, .el-select')
          ?.querySelector('[class*="sd-Input-display-value"], .ant-select-selection-item, .el-select__selected-item');
        return display?.textContent?.trim() || el.value;
      }
      // 自定义下拉框：提取当前展示的文本
      const selectedItem = el.querySelector(
        '.el-select__selected-item, .ant-select-selection-item, .semi-select-selection-text, .select2-chosen, [class*="selected"], [class*="value"]'
      );
      if (selectedItem) {
        return selectedItem.textContent?.trim() || '';
      }
      return el.textContent?.trim() || '';
    }

    if (driverType === 'date') {
      if (isInputElement(el)) {
        return el.value;
      }
      const input = el.querySelector<HTMLInputElement>('input');
      if (input) return input.value;
      const selects = Array.from(el.querySelectorAll<HTMLSelectElement>('select'));
      if (selects.length > 0) return selects.map((select) => select.value).filter(Boolean).join('-');
      return el.textContent?.trim() || '';
    }

    if (driverType === 'date-range') return readDateRangeValue(el);

    if (driverType === 'contenteditable') {
      return el.innerText || el.textContent || '';
    }

    return (el as any).value || el.textContent || '';
  }

  /**
   * 校验读回的值与期望值是否具备“语义等价性” (Domain-Aware Equivalence)
   */
  isSemanticEquivalent(actual: any, expected: any, driverType: DriverType, semanticKey?: string): boolean {
    if (actual === expected && driverType !== 'date' && driverType !== 'date-range') return true;
    if (actual == null || expected == null) return false;
    if (driverType === 'select' && (Array.isArray(actual) || Array.isArray(expected))) {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      const normalize = (values: unknown[]) => values.map(value => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim()).sort();
      const a = normalize(actual); const e = normalize(expected);
      return a.length === e.length && a.every((value, index) => value === e[index]);
    }
    const normalizedText = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (/phone/i.test(semanticKey || '')) {
      const phone = (value: unknown) => {
        const raw = normalizedText(value);
        if (!/^[+\d\s().-]+$/.test(raw)) return '';
        const digits = raw.replace(/\D/g, '');
        return digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits;
      };
      return !!phone(expected) && phone(actual) === phone(expected);
    }
    if (/email/i.test(semanticKey || '')) return normalizedText(actual).toLowerCase() === normalizedText(expected).toLowerCase();
    if (/idCardNumber|passport/i.test(semanticKey || '')) return normalizedText(actual).toUpperCase() === normalizedText(expected).toUpperCase();

    if (driverType === 'date') {
      if (actual === '' && expected === '') return true;
      const present = (value: unknown) => /^(至今|目前|现在|present|current)$/i.test(normalizedText(value));
      if (present(actual) || present(expected)) return present(actual) && present(expected);

      const parts = (value: unknown): number[] | null => {
        let text = String(value).trim().replace(/[年月日/.]/g, '-').replace(/-$/, '');
        const monthFirst = text.match(/^(\d{1,2})-(\d{4})$/);
        if (monthFirst) text = `${monthFirst[2]}-${monthFirst[1]}`;
        if (!/^\d{4}(?:-\d{1,2}){0,2}$/.test(text)) return null;
        const result = text.split('-').map(Number);
        if (result[0] < 1900 || result[0] > 2200) return null;
        if (result.length > 1 && (result[1] < 1 || result[1] > 12)) return null;
        if (result.length > 2) {
          const date = new Date(Date.UTC(result[0], result[1] - 1, result[2]));
          if (date.getUTCMonth() !== result[1] - 1 || date.getUTCDate() !== result[2]) return null;
        }
        return result;
      };
      const actualParts = parts(actual);
      const expectedParts = parts(expected);
      return !!actualParts && !!expectedParts && actualParts.length >= expectedParts.length
        && expectedParts.every((part, index) => actualParts[index] === part);
    }

    if (driverType === 'date-range' && typeof actual === 'object' && typeof expected === 'object') {
      return this.isSemanticEquivalent(actual.startDate || '', expected.startDate || '', 'date') &&
        this.isSemanticEquivalent(actual.endDate || '', expected.endDate || '', 'date');
    }

    // Unknown boolean strings must never become true by truthiness.
    if (typeof expected === 'boolean' || typeof actual === 'boolean') {
      const booleanValue = (value: unknown): boolean | null => {
        if (typeof value === 'boolean') return value;
        const text = normalizedText(value).toLowerCase();
        if (['true', '1', 'yes', '是', '同意'].includes(text)) return true;
        if (['false', '0', 'no', '否', '不同意'].includes(text)) return false;
        return null;
      };
      return booleanValue(actual) !== null && booleanValue(actual) === booleanValue(expected);
    }
    const strActual = normalizedText(actual);
    const strExpected = normalizedText(expected);
    if (strActual === strExpected) return true;
    if (!strActual || !strExpected) return false;
    const entityKind = /schoolName$/.test(semanticKey || '') ? 'school' : /\.major$/.test(semanticKey || '') ? 'major' : null;
    if (entityKind) {
      const a = getSafeEntityVariants(strActual, entityKind);
      const e = getSafeEntityVariants(strExpected, entityKind);
      return a.some(value => e.includes(value));
    }

    // 3. 政治面貌排斥保护 (正式党员与预备党员严禁混为一谈)
    if (
      (strActual.includes('预备') && !strExpected.includes('预备')) ||
      (!strActual.includes('预备') && strExpected.includes('预备'))
    ) {
      return false;
    }

    // 4. 性别排斥保护 (男 vs 女 严禁 substring 匹配)
    if ((strActual === '男' && strExpected === '女') || (strActual === '女' && strExpected === '男')) {
      return false;
    }

    // 5. Select 标准域 Canonical 判定
    if ((driverType === 'select' || driverType === 'cascader' || driverType === 'radio')
      && (!semanticKey || /degree|gender|politicalStatus|maritalStatus|jobType|availability|languageLevel|jobStatus|ethnicity/i.test(semanticKey))) {
      const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
      for (const d of domains) {
        const canAct = optionResolver.toCanonical(d, strActual, true);
        const canExp = optionResolver.toCanonical(d, strExpected, true);
        if (canAct && canExp && canAct === canExp) {
          return true;
        }
      }
    }

    if (driverType === 'cascader') {
      const path = (value: string) => value.split(/[\s/＞>→\-]+/).filter(Boolean).map(part => part.length >= 3 ? part.replace(/[省市区县]$/, '') : part);
      const a = path(strActual); const e = path(strExpected);
      if (a.length === e.length && a.length > 1 && a.every((part, index) => part === e[index])) return true;
    }

    // A single administrative suffix is a safe display alias only for a location
    // field (legacy callers without semantic keys retain this narrow alias).
    if (!semanticKey || /Location|Place|province|city|district/i.test(semanticKey)) {
      const admin = (value: string) => value.length >= 3 ? value.replace(/[省市区县]$/, '') : value;
      if (admin(strActual) === admin(strExpected)) return true;
    }

    return false;
  }
}

export const verifier = new Verifier();
