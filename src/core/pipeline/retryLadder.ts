import type { FieldDescriptor, DriverType } from '../../types/pipeline';
import { setNativeValue, setNativeRadioChecked, setRadioGroupValue, setNativeCheckboxChecked, simulateClick } from '../engine/dispatcher';
import { selectCustomOption } from '../engine/selector';
import { optionResolver, type CanonicalDomain } from '../resolvers/optionResolver';
import { locationResolver } from '../resolvers/locationResolver';
import { dateEngine } from '../resolvers/dateEngine';

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
              const el = field.element as HTMLInputElement;
              el.focus();
              el.value = String(val);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.blur();
              return true;
            },
          },
        ];

      case 'select':
      case 'cascader':
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
              if (field.element instanceof HTMLSelectElement) {
                const sel = field.element;
                const stringVal = String(val).toLowerCase();
                for (let i = 0; i < sel.options.length; i++) {
                  const optText = sel.options[i].text.toLowerCase();
                  const optVal = sel.options[i].value.toLowerCase();
                  if (optText.includes(stringVal) || optVal === stringVal || stringVal.includes(optText)) {
                    sel.selectedIndex = i;
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
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
          {
            name: 'Direct Radio Option Click Fallback',
            execute: (field) => {
              simulateClick(field.element);
              return true;
            },
          },
        ];

      case 'checkbox':
        return [
          {
            name: 'Strict Boolean Checkbox Dispatcher',
            execute: (field, val) => {
              if (field.element instanceof HTMLInputElement) {
                return setNativeCheckboxChecked(field.element, val);
              }
              simulateClick(field.element);
              return true;
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
