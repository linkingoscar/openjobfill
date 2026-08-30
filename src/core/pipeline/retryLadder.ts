import type { FieldDescriptor, DriverType } from '../../types/pipeline';
import { setNativeValue, setRadioGroupValue, setNativeCheckboxChecked, setCustomCheckboxChecked } from '../engine/dispatcher';
import { selectCustomOption, selectCascaderOptions } from '../engine/selector';
import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { locationResolver } from '../resolvers/locationResolver';
import { dateEngine } from '../resolvers/dateEngine';
import { getElementWindow, isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';

export interface ExecutionStrategy {
  name: string;
  execute(field: FieldDescriptor, value: any): Promise<boolean> | boolean;
}

export class RetryLadder {
  /**
   * 获取指定控件类型的重试执行策略阶梯
   */
  getStrategiesForType(driverType: DriverType): ExecutionStrategy[] {
    switch (driverType) {
      case 'input':
      case 'contenteditable':
        return [
          {
            name: 'Native Prototype Setter + React/Vue Event Chain',
            execute: (field, val) => setNativeValue(field.element, String(val)),
          },
          {
            name: 'Direct Property Assignment + InputEvent Dispatch',
            execute: (field, val) => {
              const el = field.element;
              if (!isInputElement(el) && !isTextAreaElement(el)) return false;
              const win = getElementWindow(el) as any;
              const EventClass = win.Event || Event;
              el.focus();
              el.value = String(val);
              el.dispatchEvent(new EventClass('input', { bubbles: true }));
              el.dispatchEvent(new EventClass('change', { bubbles: true }));
              el.blur();
              return true;
            },
          },
        ];

      case 'cascader':
        return [
          {
            name: 'Hierarchical Cascader Multi-Level Step Driver',
            execute: async (field, val) => {
              const stringVal = String(val);
              // 如果是包含省市区或者连字符的多级路径
              return await selectCascaderOptions(field.element, stringVal);
            },
          },
          {
            name: 'Fallback to Single Select Option Finder',
            execute: async (field, val) => {
              return await selectCustomOption(field.element, String(val));
            },
          },
        ];

      case 'select':
        return [
          {
            name: 'Option/Location Resolver + Custom UI Selection',
            execute: async (field, val) => {
              const stringVal = String(val);
              let targetOptionText = stringVal;

              // 如果已提取到 options 列表，先尝试通过 OptionResolver / LocationResolver 解析
              if (field.options && field.options.length > 0) {
                // 检查是否为城市字段
                if (field.label.includes('城市') || field.label.includes('籍贯') || field.label.includes('生源地') || field.label.includes('居住地') || field.label.includes('city') || field.label.includes('location')) {
                  const resolvedCity = locationResolver.matchLocationOption(field.options, stringVal);
                  if (resolvedCity) targetOptionText = resolvedCity;
                } else {
                  // 尝试 10 大标准域
                  const domain = this.detectDomainFromField(field);
                  if (domain) {
                    const resolvedDomainOption = optionResolver.resolveOptionValue(field.options, domain, stringVal);
                    if (resolvedDomainOption) targetOptionText = resolvedDomainOption;
                  }
                }
              }

              return await selectCustomOption(field.element, targetOptionText);
            },
          },
          {
            name: 'Native Select Option Value & Text Loop Fallback',
            execute: (field, val) => {
              if (isSelectElement(field.element)) {
                const sel = field.element;
                const stringVal = String(val).toLowerCase();
                const win = getElementWindow(sel) as any;
                const EventClass = win.Event || Event;
                for (let i = 0; i < sel.options.length; i++) {
                  const optText = sel.options[i].text.toLowerCase();
                  const optVal = sel.options[i].value.toLowerCase();
                  if (optText.includes(stringVal) || optVal === stringVal || stringVal.includes(optText)) {
                    sel.selectedIndex = i;
                    sel.dispatchEvent(new EventClass('input', { bubbles: true }));
                    sel.dispatchEvent(new EventClass('change', { bubbles: true }));
                    return true;
                  }
                }
              }
              return false;
            },
          },
        ];

      case 'radio':
        return [
          {
            name: 'Semantic Radio Group Matcher & Dispatcher',
            execute: (field, val) => {
              return setRadioGroupValue(field.element, String(val));
            },
          },
        ];

      case 'checkbox':
        return [
          {
            name: 'Strict Boolean Checkbox Dispatcher',
            execute: (field, val) => {
              if (isInputElement(field.element)) {
                return setNativeCheckboxChecked(field.element, val);
              }
              return setCustomCheckboxChecked(field.element, val);
            },
          },
        ];

      case 'date':
        return [
          {
            name: 'DateEngine Structured Injection (Dual-Select / Native Date)',
            execute: async (field, val) => {
              return await dateEngine.injectSemanticDate(field.element, String(val));
            },
          },
          {
            name: 'Native Prototype Date String Setter Fallback',
            execute: (field, val) => setNativeValue(field.element, String(val)),
          },
        ];

      case 'date-range':
        return [
          {
            name: 'Date Range Structured Picker Driver',
            execute: async (field, val) => {
              const range = typeof val === 'object' && val
                ? val as { startDate?: string; endDate?: string }
                : { startDate: String(val || ''), endDate: '' };
              const inputs = Array.from(field.element.querySelectorAll<HTMLInputElement>('input'));
              if (inputs.length < 2) return false;
              const startOk = !range.startDate || await dateEngine.injectSemanticDate(inputs[0], range.startDate);
              const endOk = !range.endDate || await dateEngine.injectSemanticDate(inputs[1], range.endDate);
              return startOk && endOk;
            },
          },
        ];

      default:
        return [
          {
            name: 'Default Native Setter',
            execute: (field, val) => setNativeValue(field.element, String(val)),
          },
        ];
    }
  }

  private detectDomainFromField(field: FieldDescriptor): CanonicalDomain | null {
    const text = (field.label + ' ' + field.name + ' ' + field.placeholder).toLowerCase();
    if (/学历|文化程度|degree|education level/.test(text)) return 'degree';
    if (/学位|academic degree/.test(text)) return 'academicDegree';
    if (/性别|gender|sex/.test(text)) return 'gender';
    if (/政治面貌|党派|political/.test(text)) return 'politicalStatus';
    if (/婚姻|婚否|marital/.test(text)) return 'maritalStatus';
    if (/工作性质|职位类别|job type/.test(text)) return 'jobType';
    if (/到岗|入职时间|notice period|availability/.test(text)) return 'availability';
    if (/英语|语言|外语|language/.test(text)) return 'languageLevel';
    if (/求职状态|在职状态|job status/.test(text)) return 'jobStatus';
    if (/民族|ethnicity/.test(text)) return 'ethnicity';
    return null;
  }
}

export const retryLadder = new RetryLadder();
