import type { FieldDescriptor, DriverType } from '../../types/pipeline';

export class Verifier {
  /**
   * 写入后从 DOM / 受控组件中读回当前渲染的真实值 (Read-Back)
   */
  async readBack(field: FieldDescriptor, driverType: DriverType): Promise<any> {
    const el = field.element;

    if (driverType === 'input') {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value;
      }
    }

    if (driverType === 'radio') {
      if (el instanceof HTMLInputElement && el.type === 'radio') {
        // 如果是单个 radio
        if (el.checked) return el.value || el.parentElement?.textContent?.trim() || true;
        // 如果有同名 radio group，查找选中的项
        if (el.name) {
          const checked = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${el.name}"]:checked`);
          if (checked) {
            return checked.value || checked.parentElement?.textContent?.trim() || true;
          }
        }
        return false;
      }
    }

    if (driverType === 'checkbox') {
      if (el instanceof HTMLInputElement) {
        return el.checked;
      }
    }

    if (driverType === 'select') {
      if (el instanceof HTMLSelectElement) {
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
      if (el instanceof HTMLInputElement) {
        return el.value;
      }
      return el.textContent?.trim() || '';
    }

    if (driverType === 'contenteditable') {
      return el.innerText || el.textContent || '';
    }

    return (el as any).value || el.textContent || '';
  }

  /**
   * 校验读回的值与期望值是否具备“语义等价性”
   */
  isSemanticEquivalent(actual: any, expected: any, driverType: DriverType): boolean {
    if (actual === expected) return true;
    if (actual === undefined || actual === null || expected === undefined || expected === null) {
      return false;
    }

    // Boolean 场景 (Checkbox / Radio)
    if (typeof expected === 'boolean') {
      return Boolean(actual) === expected;
    }

    const strActual = String(actual).toLowerCase().replace(/[\s:：*_\-\(\)（）\[\]【】/]/g, '');
    const strExpected = String(expected).toLowerCase().replace(/[\s:：*_\-\(\)（）\[\]【】/]/g, '');

    if (!strActual && !strExpected) return true;
    if (!strActual || !strExpected) return false;

    // 1. 完全一致
    if (strActual === strExpected) return true;

    // 2. 包含关系 (如 "北京市" vs "北京"，"大学本科" vs "本科")
    if (strActual.includes(strExpected) || strExpected.includes(strActual)) {
      return true;
    }

    // 3. 日期等价性 (如 "2023-09" vs "2023年09月" vs "2023/09")
    if (driverType === 'date') {
      const numActual = strActual.replace(/[^\d]/g, '');
      const numExpected = strExpected.replace(/[^\d]/g, '');
      if (numActual && numExpected && (numActual.startsWith(numExpected) || numExpected.startsWith(numActual))) {
        return true;
      }
    }

    return false;
  }
}

export const verifier = new Verifier();
