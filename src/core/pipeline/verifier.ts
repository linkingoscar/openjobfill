import type { FieldDescriptor, DriverType } from '../../types/pipeline';
import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { locationResolver } from '../resolvers/locationResolver';
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
        const selected = el.options[el.selectedIndex];
        return selected ? selected.text.trim() : el.value;
      }
      // 自定义下拉框：提取当前展示的文本
      const selectedItem = el.querySelector(
        '.el-select__selected-item, .ant-select-selection-item, .semi-select-selection-text, [class*="selected"], [class*="value"]'
      );
      if (selectedItem && selectedItem.textContent) {
        return selectedItem.textContent.trim();
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

    if (driverType === 'date-range') {
      const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
      const presentControl = Array.from(el.querySelectorAll<HTMLElement>(
        'label, button, [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"], [aria-pressed]'
      )).find((candidate) => {
        const text = candidate.textContent || candidate.getAttribute('aria-label') || '';
        if (!/至今|目前|现在|present|current/i.test(text)) return false;
        if (isInputElement(candidate)) return candidate.checked;
        return candidate.getAttribute('aria-checked') === 'true' || candidate.getAttribute('aria-pressed') === 'true';
      });
      return {
        startDate: inputs[0]?.value || '',
        endDate: inputs[1]?.value || (presentControl ? '至今' : ''),
      };
    }

    if (driverType === 'contenteditable') {
      return el.innerText || el.textContent || '';
    }

    return (el as any).value || el.textContent || '';
  }

  /**
   * 校验读回的值与期望值是否具备“语义等价性” (Domain-Aware Equivalence)
   */
  isSemanticEquivalent(actual: any, expected: any, driverType: DriverType): boolean {
    if (actual === expected) return true;
    if (actual === undefined || actual === null || expected === undefined || expected === null) {
      return false;
    }

    if (driverType === 'date-range' && typeof actual === 'object' && typeof expected === 'object') {
      return this.isSemanticEquivalent(actual.startDate || '', expected.startDate || '', 'date') &&
        this.isSemanticEquivalent(actual.endDate || '', expected.endDate || '', 'date');
    }

    // 1. Boolean 场景 (Checkbox / Radio)
    if (typeof expected === 'boolean' || typeof actual === 'boolean') {
      const expBool = typeof expected === 'boolean' ? expected : !['否', 'false', '0', 'no'].includes(String(expected).toLowerCase().trim());
      const actBool = typeof actual === 'boolean' ? actual : !['否', 'false', '0', 'no', ''].includes(String(actual).toLowerCase().trim());
      return expBool === actBool;
    }

    const strActual = String(actual).toLowerCase().replace(/[\s:：*_\-\(\)（）\[\]【】/]/g, '');
    const strExpected = String(expected).toLowerCase().replace(/[\s:：*_\-\(\)（）\[\]【】/]/g, '');

    if (!strActual && !strExpected) return true;
    if (!strActual || !strExpected) return false;

    // 2. 完全一致
    if (strActual === strExpected) return true;

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
    if (driverType === 'select' || driverType === 'cascader') {
      const domains: CanonicalDomain[] = ['degree', 'academicDegree', 'gender', 'politicalStatus', 'maritalStatus', 'jobType', 'availability', 'languageLevel', 'jobStatus'];
      for (const d of domains) {
        const canAct = optionResolver.toCanonical(d, strActual);
        const canExp = optionResolver.toCanonical(d, strExpected);
        if (canAct && canExp && canAct === canExp) {
          return true;
        }
      }

      // Location 判定
      const locAct = locationResolver.normalizeLocation(strActual);
      const locExp = locationResolver.normalizeLocation(strExpected);
      if (locAct.city && locExp.city && locAct.city === locExp.city) {
        return true;
      }
    }

    // 6. 日期等价性 (如 "2023-09" vs "2023年09月" vs "2023/09")
    if (driverType === 'date') {
      const numActual = strActual.replace(/[^\d]/g, '');
      const numExpected = strExpected.replace(/[^\d]/g, '');
      if (numActual && numExpected && (numActual.startsWith(numExpected) || numExpected.startsWith(numActual))) {
        return true;
      }
    }

    // 7. 通用包含关系
    if (strActual.includes(strExpected) || strExpected.includes(strActual)) {
      return true;
    }

    return false;
  }
}

export const verifier = new Verifier();
