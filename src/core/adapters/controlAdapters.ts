import type { DriverType, FieldDescriptor } from '../../types/pipeline';
import { isInputElement, isSelectElement, isTextAreaElement } from '../../utils/dom';
import { setCustomCheckboxChecked, setNativeCheckboxChecked, setNativeValue, setRadioGroupValue } from '../engine/dispatcher';
import { selectCascaderOptions, selectCustomOption } from '../engine/selector';
import { dateEngine } from '../resolvers/dateEngine';
import { executeMainWorldControlAction } from './mainWorldBridge';

export const CONTROL_ADAPTER_IDS = [
  'MeituanMtdSelect', 'MeituanMtdMonthPicker', 'AntSelectSearchInput', 'HotjobLinkedAntSelect',
  'AntSelect', 'HotjobMajorModal', 'GuoPinAntCascader', 'AntCascader', 'AntDateRangePicker',
  'AntDatePicker', 'ZhaopinCampusElementSelect', 'GreeyunElementSelect', 'ElementSelect', 'AUISelect',
  'ElementAutocomplete', 'Job51ThreeLayerSelect', 'ZhaopinCampusRegionCascader', 'ElementCascader',
  'ZhaopinCampusDateInput', 'ElementDatePicker', 'PhoenixInput', 'HcSuperSelector', 'PhoenixSelect',
  'AtsxSelect', 'AtsxDatePicker', 'UdSelect', 'TpLinkSelectBox', 'TpLinkEthnicPicker',
  'TpLinkDatePicker', 'SdInput', 'MokahrRegionDropdown', 'MokahrSearchDropdown', 'MokahrDateDropdown',
  'MokahrSimpleDropdown', 'SdDropdown', 'LayUISelect', 'IViewSelect', 'IViewCascader', 'ZhipinSelect',
  'ZhipinDatePicker', 'ZhipinDialog', 'LagouCalendarPicker', 'LagouEditor', 'ShixisengCity',
  'CheckboxInput', 'RadioGroup', 'DateRangeCalendar', 'ThundersoftFeishuMonthRange', 'MokahrSingleMonth',
  'MokahrMonthRange', 'Job51LinkedSelect', 'Job51PhoneField', 'Job51ComboboxSelect', 'NativeSelect',
  'Job51SetdayDate', 'Job51Input', 'BankCommPopPanel', 'My97Date',
] as const;

export type ControlAdapterId = typeof CONTROL_ADAPTER_IDS[number];
export type ControlAdapterFamily =
  | 'input'
  | 'editor'
  | 'select'
  | 'search-select'
  | 'cascader'
  | 'date'
  | 'date-range'
  | 'phone'
  | 'radio'
  | 'checkbox'
  | 'dialog';
export type ControlExecutionWorld = 'ISOLATED' | 'MAIN';

interface ControlAdapterProfile {
  id: ControlAdapterId;
  family: ControlAdapterFamily;
  selectors: string[];
  priority: number;
  world?: ControlExecutionWorld;
  url?: RegExp;
  requireUrl?: boolean;
  context?: RegExp;
  requireContext?: boolean;
}

export interface ControlAdapterMatchContext {
  field: FieldDescriptor;
  driverType: DriverType;
  pageUrl?: string;
}

export interface ControlAdapterExecutionContext extends ControlAdapterMatchContext {
  value: unknown;
  signal?: AbortSignal;
  runId?: string;
}

export interface MatchedControlAdapter {
  adapter: ControlAdapterProfile;
  root: HTMLElement;
  score: number;
  reasons: string[];
}

export interface ControlAdapterMatchTrace {
  id: ControlAdapterId;
  family: ControlAdapterFamily;
  world: ControlExecutionWorld;
  matched: boolean;
  score: number;
  reasons: string[];
}

const url = {
  meituan: /(^|\.)meituan\.|zhaopin\.meituan/i,
  hotjob: /hotjob|hot-job/i,
  guopin: /guopin|iguopin/i,
  zhaopin: /xiaoyuan\.zhaopin|zhaopin/i,
  greeyun: /greeyun|career\.[^/]*gree/i,
  phoenix: /join\.qq|career\.(?:qq|tencent)|phoenix/i,
  tplink: /tp-?link|tplink/i,
  moka: /moka|mokahr/i,
  zhipin: /zhipin|boss/i,
  lagou: /lagou/i,
  shixiseng: /shixiseng/i,
  job51: /51job|jobs51/i,
  bankcomm: /bankcomm|交通银行/i,
  thundersoft: /thundersoft|中科创达/i,
};

const profile = (
  id: ControlAdapterId,
  family: ControlAdapterFamily,
  selectors: string | string[],
  priority: number,
  options: Partial<Omit<ControlAdapterProfile, 'id' | 'family' | 'selectors' | 'priority'>> = {},
): ControlAdapterProfile => ({
  id,
  family,
  selectors: Array.isArray(selectors) ? selectors : [selectors],
  priority,
  world: 'ISOLATED',
  ...options,
});

/**
 * 生产插件中的 58 个复杂控件名称在这里保持一一对应；实现按行为族复用。
 * 站点专属条目优先级高于组件库条目，Native fallback 永远位于最后。
 */
const CONTROL_ADAPTERS: ControlAdapterProfile[] = [
  profile('MeituanMtdSelect', 'select', '.mtd-select, .mtd-dropdown', 860, { url: url.meituan }),
  profile('MeituanMtdMonthPicker', 'date', '.mtd-picker, .mtd-month-picker', 870, { url: url.meituan }),
  profile('AntSelectSearchInput', 'search-select', '.ant-select-show-search, .ant-select-selector input[role="combobox"]', 660),
  profile('HotjobLinkedAntSelect', 'cascader', '.ant-select', 910, { url: url.hotjob, requireUrl: true, context: /联动|省|市|区|专业|linked|region/i }),
  profile('AntSelect', 'select', '.ant-select, .ant-select-selector', 620),
  profile('HotjobMajorModal', 'cascader', '[class*="major"] .ant-select, .ant-modal [class*="major"]', 920, { url: url.hotjob, requireUrl: true }),
  profile('GuoPinAntCascader', 'cascader', '.ant-cascader, .ant-cascader-picker', 900, { url: url.guopin, requireUrl: true }),
  profile('AntCascader', 'cascader', '.ant-cascader, .ant-cascader-picker', 650),
  profile('AntDateRangePicker', 'date-range', '.ant-picker-range', 690),
  profile('AntDatePicker', 'date', '.ant-picker, .ant-calendar-picker', 640),
  profile('ZhaopinCampusElementSelect', 'select', '.el-select', 900, { url: url.zhaopin, requireUrl: true }),
  profile('GreeyunElementSelect', 'select', '.el-select', 890, { url: url.greeyun, requireUrl: true }),
  profile('ElementSelect', 'select', '.el-select, .el-select__wrapper', 610),
  profile('AUISelect', 'select', '.aui-select, [class*="aui-select"]', 720),
  profile('ElementAutocomplete', 'search-select', '.el-autocomplete, .el-autocomplete-suggestion', 680),
  profile('Job51ThreeLayerSelect', 'cascader', '.job51-three-layer, [class*="three-layer"], [class*="threeLayer"]', 960, { url: url.job51, requireUrl: true }),
  profile('ZhaopinCampusRegionCascader', 'cascader', '.el-cascader, [class*="region-cascader"]', 930, { url: url.zhaopin, requireUrl: true }),
  profile('ElementCascader', 'cascader', '.el-cascader, .el-cascader__wrapper', 630),
  profile('ZhaopinCampusDateInput', 'date', 'input[class*="date"], [class*="date-input"]', 880, { url: url.zhaopin, requireUrl: true }),
  profile('ElementDatePicker', 'date', '.el-date-editor, .el-date-picker', 650),
  profile('PhoenixInput', 'input', '.phoenix-input, .sc-input, [class*="phoenix"][class*="input"]', 980, { url: url.phoenix, world: 'MAIN' }),
  profile('HcSuperSelector', 'cascader', '.hc-super-selector, [class*="super-selector"], [class*="superSelector"]', 970, { world: 'MAIN' }),
  profile('PhoenixSelect', 'select', '.phoenix-select, .sc-select, [class*="phoenix"][class*="select"]', 990, { url: url.phoenix, world: 'MAIN' }),
  profile('AtsxSelect', 'select', '.atsx-select, [class*="atsx-select"]', 760),
  profile('AtsxDatePicker', 'date', '.atsx-date-picker, [class*="atsx"][class*="date"]', 770),
  profile('UdSelect', 'select', '.ud-select, [class*="ud-select"]', 750),
  profile('TpLinkSelectBox', 'select', '.tp-select-box, [class*="tplink"][class*="select"]', 950, { url: url.tplink }),
  profile('TpLinkEthnicPicker', 'select', '.tp-ethnic-picker, [class*="ethnic-picker"]', 970, { url: url.tplink, requireUrl: true }),
  profile('TpLinkDatePicker', 'date', '.tp-date-picker, [class*="tplink"][class*="date"]', 960, { url: url.tplink }),
  profile('SdInput', 'input', '.sd-input, [class*="sd-input"]', 720),
  profile('MokahrRegionDropdown', 'cascader', '.mokahr-region-dropdown, [class*="moka"][class*="region"]', 970, { url: url.moka }),
  profile('MokahrSearchDropdown', 'search-select', '.mokahr-search-dropdown, [class*="moka"][class*="search"]', 960, { url: url.moka }),
  profile('MokahrDateDropdown', 'date', '.mokahr-date-dropdown, [class*="moka"][class*="date"]', 950, { url: url.moka }),
  profile('MokahrSimpleDropdown', 'select', '.mokahr-simple-dropdown, .moka-select, [class*="moka"][class*="select"]', 940, { url: url.moka }),
  profile('SdDropdown', 'select', '.sd-dropdown, [class*="sd-dropdown"]', 730),
  profile('LayUISelect', 'select', '.layui-form-select', 700),
  profile('IViewSelect', 'select', '.ivu-select', 700),
  profile('IViewCascader', 'cascader', '.ivu-cascader', 710),
  profile('ZhipinSelect', 'select', '.zhipin-select, [class*="zhipin"][class*="select"]', 940, { url: url.zhipin }),
  profile('ZhipinDatePicker', 'date', '.zhipin-date-picker, [class*="zhipin"][class*="date"]', 950, { url: url.zhipin }),
  profile('ZhipinDialog', 'dialog', '.zhipin-dialog, [class*="zhipin"][class*="dialog"]', 960, { url: url.zhipin }),
  profile('LagouCalendarPicker', 'date', '.lagou-calendar, [class*="calendar-picker"]', 930, { url: url.lagou }),
  profile('LagouEditor', 'editor', '.lagou-editor, [contenteditable="true"]', 920, { url: url.lagou, requireUrl: true }),
  profile('ShixisengCity', 'cascader', '.shixiseng-city, [class*="city-picker"]', 920, { url: url.shixiseng, requireUrl: true }),
  profile('CheckboxInput', 'checkbox', 'input[type="checkbox"], [role="checkbox"]', 300),
  profile('RadioGroup', 'radio', '[role="radiogroup"], .radio-group, .el-radio-group, .ant-radio-group, input[type="radio"]', 300),
  profile('DateRangeCalendar', 'date-range', '[class*="date-range"], [class*="daterange"], [data-openjobfill-date-group]', 420),
  profile('ThundersoftFeishuMonthRange', 'date-range', '[class*="feishu"][class*="month"], [class*="thundersoft"][class*="month"]', 900, { url: url.thundersoft }),
  profile('MokahrSingleMonth', 'date', '[class*="moka"][class*="month"]', 960, { url: url.moka, context: /开始|结束|年月|month/i }),
  profile('MokahrMonthRange', 'date-range', '[class*="moka"][class*="month-range"], [class*="moka"][class*="monthRange"]', 970, { url: url.moka }),
  profile('Job51LinkedSelect', 'cascader', '[class*="linked-select"], [class*="linkage"]', 950, { url: url.job51, requireUrl: true }),
  profile('Job51PhoneField', 'phone', '[class*="phone-field"], [class*="mobile-field"], [data-field*="phone"]', 980, { url: url.job51, requireUrl: true }),
  profile('Job51ComboboxSelect', 'search-select', '[role="combobox"], [class*="combobox"]', 940, { url: url.job51, requireUrl: true }),
  profile('NativeSelect', 'select', 'select', 100),
  profile('Job51SetdayDate', 'date', '.setday, [class*="setday"]', 970, { url: url.job51, requireUrl: true, world: 'MAIN' }),
  profile('Job51Input', 'input', 'input:not([type="hidden"]), textarea', 910, { url: url.job51, requireUrl: true }),
  profile('BankCommPopPanel', 'dialog', '.pop-input, .bankcomm-select, [class*="bank"][class*="select"]', 970, { url: url.bankcomm, requireUrl: true }),
  profile('My97Date', 'date', '.Wdate, [onclick*="WdatePicker"], [onfocus*="WdatePicker"]', 990, { world: 'MAIN' }),
];

const FAMILY_DRIVERS: Record<ControlAdapterFamily, DriverType[]> = {
  input: ['input'],
  editor: ['contenteditable', 'input'],
  select: ['select', 'input'],
  'search-select': ['select', 'input'],
  cascader: ['cascader', 'select', 'input'],
  date: ['date', 'input'],
  'date-range': ['date-range'],
  phone: ['input'],
  radio: ['radio'],
  checkbox: ['checkbox'],
  dialog: ['select', 'cascader', 'input'],
};

function matchesSelector(el: HTMLElement, selector: string): HTMLElement | null {
  try {
    if (el.matches(selector)) return el;
    const ancestor = el.closest<HTMLElement>(selector);
    if (ancestor) return ancestor;
    return el.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function pageUrlFor(context: ControlAdapterMatchContext): string {
  if (context.pageUrl) return context.pageUrl;
  try {
    return context.field.element.ownerDocument.location?.href || '';
  } catch {
    return '';
  }
}

function matchProfile(adapter: ControlAdapterProfile, context: ControlAdapterMatchContext): MatchedControlAdapter | null {
  if (!FAMILY_DRIVERS[adapter.family].includes(context.driverType)) return null;
  let root: HTMLElement | null = null;
  let selector = '';
  for (const candidate of adapter.selectors) {
    root = matchesSelector(context.field.element, candidate);
    if (root) {
      selector = candidate;
      break;
    }
  }
  if (!root) return null;

  const reasons = [`selector:${selector}`];
  let score = 60;
  const currentUrl = pageUrlFor(context);
  const urlMatched = !!adapter.url?.test(currentUrl);
  // `.sc-*` 在 Phoenix 中常见，但也可能是其它站点的普通样式类；这类短类名
  // 必须再有站点证据，避免仅凭一个宽泛 class 进入 MAIN world。
  const selectorNeedsSiteEvidence = /^\.sc-/.test(selector);
  if ((adapter.requireUrl || selectorNeedsSiteEvidence) && !urlMatched) return null;
  if (urlMatched) {
    score += 25;
    reasons.push('site');
  }

  const fieldText = `${context.field.label} ${context.field.name} ${context.field.placeholder} ${context.field.contextText}`;
  const contextMatched = !!adapter.context?.test(fieldText);
  if (adapter.requireContext && !contextMatched) return null;
  if (contextMatched) {
    score += 10;
    reasons.push('context');
  }
  score += Math.min(9, Math.max(0, adapter.priority / 1000) * 9);
  return { adapter, root, score: Math.round(score * 10) / 10, reasons };
}

export function getMatchingControlAdapters(context: ControlAdapterMatchContext): MatchedControlAdapter[] {
  return CONTROL_ADAPTERS
    .map((adapter) => matchProfile(adapter, context))
    .filter((match): match is MatchedControlAdapter => !!match)
    .sort((a, b) => b.score - a.score || b.adapter.priority - a.adapter.priority);
}

export function getControlAdapterMatchTrace(context: ControlAdapterMatchContext): ControlAdapterMatchTrace[] {
  const matches = new Map(getMatchingControlAdapters(context).map((match) => [match.adapter.id, match]));
  return CONTROL_ADAPTERS.map((adapter) => {
    const match = matches.get(adapter.id);
    return {
      id: adapter.id,
      family: adapter.family,
      world: adapter.world || 'ISOLATED',
      matched: !!match,
      score: match?.score || 0,
      reasons: match?.reasons || [],
    };
  });
}

export function getControlAdapterCatalog(): ReadonlyArray<{
  id: ControlAdapterId;
  family: ControlAdapterFamily;
  world: ControlExecutionWorld;
}> {
  return CONTROL_ADAPTERS.map(({ id, family, world }) => ({ id, family, world: world || 'ISOLATED' }));
}

function firstWritable(root: HTMLElement): HTMLElement | null {
  if (isInputElement(root) || isTextAreaElement(root) || root.isContentEditable) return root;
  return root.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, [contenteditable="true"]');
}

function normalizePath(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return ['country', 'province', 'city', 'district', 'majorCategory', 'major']
      .map((key) => record[key])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return String(value ?? '').split(/[-/、>]/).map((item) => item.trim()).filter(Boolean);
}

function normalizePhone(raw: string): { countryCode: string; local: string } {
  const compact = raw.replace(/[\s()-]/g, '');
  const matched = compact.match(/^(?:\+|00)?(86)(1\d{10})$/);
  if (matched) return { countryCode: '+86', local: matched[2] };
  return { countryCode: '', local: compact };
}

async function fillCompositePhone(root: HTMLElement, raw: string, signal?: AbortSignal): Promise<boolean> {
  const container = root.closest<HTMLElement>('[class*="phone"], [class*="mobile"], .form-item, .form-group') || root;
  const controls = Array.from(container.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, [role="combobox"]'));
  if ((isInputElement(root) || isSelectElement(root)) && !controls.includes(root)) controls.unshift(root);
  if (controls.length <= 1) {
    const target = controls[0] || firstWritable(root);
    return !!target && setNativeValue(target, raw);
  }

  const { countryCode, local } = normalizePhone(raw);
  const country = controls.find((control) => /country|area.?code|区号|国家/i.test([
    control.getAttribute('name'), control.getAttribute('id'), control.getAttribute('placeholder'), control.getAttribute('aria-label'), control.className,
  ].filter(Boolean).join(' '))) || controls[0];
  const phone = controls.find((control) => control !== country && /phone|mobile|tel|手机|电话/i.test([
    control.getAttribute('name'), control.getAttribute('id'), control.getAttribute('placeholder'), control.getAttribute('aria-label'), control.className,
  ].filter(Boolean).join(' '))) || controls.find((control) => control !== country) || controls[0];

  let countryOk = true;
  if (countryCode && country !== phone) {
    countryOk = isSelectElement(country)
      ? await selectCustomOption(country, countryCode, true, signal)
      : setNativeValue(country, countryCode);
  }
  return countryOk && setNativeValue(phone, local);
}

async function fillDateRange(root: HTMLElement, value: unknown, signal?: AbortSignal): Promise<boolean> {
  const range = value && typeof value === 'object'
    ? value as { startDate?: string; endDate?: string }
    : { startDate: String(value || ''), endDate: '' };
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input'));
  if (isInputElement(root) && !inputs.includes(root)) inputs.unshift(root);
  if (inputs.length < 2) return false;
  const startOk = !range.startDate || await dateEngine.injectSemanticDate(inputs[0], range.startDate, signal);
  const endOk = !range.endDate || await dateEngine.injectSemanticDate(inputs[1], range.endDate, signal);
  return startOk && endOk;
}

export async function executeControlAdapter(
  match: MatchedControlAdapter,
  context: ControlAdapterExecutionContext,
): Promise<boolean> {
  const { adapter, root } = match;
  const text = String(context.value ?? '');
  if (!text && context.value !== false && context.value !== 0) return false;

  if ((adapter.world || 'ISOLATED') === 'MAIN') {
    const action = adapter.family === 'cascader'
      ? 'SELECT_PATH'
      : adapter.family === 'select' || adapter.family === 'search-select' || adapter.family === 'dialog'
        ? 'SELECT_TEXT'
        : 'TYPE';
    return executeMainWorldControlAction({
      adapterId: adapter.id,
      action,
      field: context.field,
      value: action === 'SELECT_PATH' ? normalizePath(context.value) : text,
      runId: context.runId,
    });
  }

  switch (adapter.family) {
    case 'select':
    case 'search-select':
    case 'dialog':
      return selectCustomOption(root, text, true, context.signal);
    case 'cascader':
      return selectCascaderOptions(root, normalizePath(context.value), context.signal);
    case 'date':
      return dateEngine.injectSemanticDate(root, text, context.signal);
    case 'date-range':
      return fillDateRange(root, context.value, context.signal);
    case 'phone':
      return fillCompositePhone(root, text, context.signal);
    case 'radio':
      return setRadioGroupValue(root, text);
    case 'checkbox': {
      const booleanish = typeof context.value === 'string'
        || typeof context.value === 'number'
        || typeof context.value === 'boolean'
        ? context.value
        : text;
      return isInputElement(root)
        ? setNativeCheckboxChecked(root, booleanish)
        : setCustomCheckboxChecked(root, booleanish);
    }
    case 'editor':
    case 'input': {
      const writable = firstWritable(root);
      return !!writable && setNativeValue(writable, text);
    }
  }
}

function selectedText(root: HTMLElement): string {
  const selected = root.querySelector<HTMLElement>([
    '.ant-select-selection-item', '.el-select__selected-item', '.semi-select-selection-text',
    '.ivu-select-selected-value', '.mtd-select-rendered', '[aria-selected="true"]',
    '[class*="selected-value"]', '[class*="selectedValue"]', '[class*="selection-item"]',
  ].join(','));
  if (selected?.textContent?.trim()) return selected.textContent.trim();
  const input = firstWritable(root);
  if (input && (isInputElement(input) || isTextAreaElement(input))) return input.value;
  return root.textContent?.trim() || '';
}

export function readBackControlAdapter(match: MatchedControlAdapter): unknown {
  const { family } = match.adapter;
  const root = match.root;
  if (family === 'checkbox') {
    return isInputElement(root)
      ? root.checked
      : root.getAttribute('aria-checked') === 'true' || root.getAttribute('aria-pressed') === 'true';
  }
  if (family === 'radio') {
    if (isInputElement(root) && root.type === 'radio' && root.checked) {
      return root.value || root.parentElement?.textContent?.trim() || true;
    }
    const checked = root.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    return checked?.value || checked?.parentElement?.textContent?.trim() || root.getAttribute('aria-checked') === 'true';
  }
  if (family === 'date-range') {
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input'));
    return { startDate: inputs[0]?.value || '', endDate: inputs[1]?.value || '' };
  }
  if (family === 'phone') {
    return Array.from(root.querySelectorAll<HTMLInputElement>('input')).map((input) => input.value).join(' ')
      || (isInputElement(root) ? root.value : '');
  }
  if (family === 'select' || family === 'search-select' || family === 'cascader' || family === 'dialog') {
    if (isSelectElement(root)) return root.options[root.selectedIndex]?.text.trim() || root.value;
    return selectedText(root);
  }
  if (family === 'date') {
    const input = firstWritable(root);
    return input && (isInputElement(input) || isTextAreaElement(input)) ? input.value : selectedText(root);
  }
  const writable = firstWritable(root);
  if (writable && (isInputElement(writable) || isTextAreaElement(writable))) return writable.value;
  return writable?.innerText || writable?.textContent || '';
}

export function isControlAdapterValueEquivalent(
  match: MatchedControlAdapter,
  actual: unknown,
  expected: unknown,
): boolean | undefined {
  if (match.adapter.family !== 'phone') return undefined;
  const actualDigits = String(actual ?? '').replace(/\D/g, '');
  const expectedDigits = String(expected ?? '').replace(/\D/g, '');
  return !!actualDigits && !!expectedDigits
    && (actualDigits.endsWith(expectedDigits) || expectedDigits.endsWith(actualDigits));
}
