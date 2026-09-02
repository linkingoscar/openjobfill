import { describe, expect, it } from 'vitest';
import { getMatchingControlAdapters, type ControlAdapterId } from '@/core/adapters/controlAdapters';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import type { DriverType, FieldDescriptor, FieldType } from '@/types/pipeline';

interface RouteFixture {
  id: ControlAdapterId;
  markup: string;
  driver: DriverType;
  url?: string;
  label?: string;
}

const fixtures: RouteFixture[] = [
  { id: 'MeituanMtdSelect', markup: '<div data-fixture class="mtd-select"></div>', driver: 'select', url: 'https://zhaopin.meituan.com/apply' },
  { id: 'MeituanMtdMonthPicker', markup: '<div data-fixture class="mtd-month-picker"></div>', driver: 'date', url: 'https://zhaopin.meituan.com/apply' },
  { id: 'AntSelectSearchInput', markup: '<div data-fixture class="ant-select-show-search"></div>', driver: 'select' },
  { id: 'HotjobLinkedAntSelect', markup: '<div data-fixture class="ant-select"></div>', driver: 'cascader', url: 'https://career.hotjob.cn/apply', label: '省市联动' },
  { id: 'AntSelect', markup: '<div data-fixture class="ant-select"></div>', driver: 'select' },
  { id: 'HotjobMajorModal', markup: '<div class="major"><div data-fixture class="ant-select"></div></div>', driver: 'cascader', url: 'https://career.hotjob.cn/apply' },
  { id: 'GuoPinAntCascader', markup: '<div data-fixture class="ant-cascader"></div>', driver: 'cascader', url: 'https://www.iguopin.com/apply' },
  { id: 'AntCascader', markup: '<div data-fixture class="ant-cascader"></div>', driver: 'cascader' },
  { id: 'AntDateRangePicker', markup: '<div data-fixture class="ant-picker-range"></div>', driver: 'date-range' },
  { id: 'AntDatePicker', markup: '<div data-fixture class="ant-picker"></div>', driver: 'date' },
  { id: 'ZhaopinCampusElementSelect', markup: '<div data-fixture class="el-select"></div>', driver: 'select', url: 'https://xiaoyuan.zhaopin.com/scrd/resume2' },
  { id: 'GreeyunElementSelect', markup: '<div data-fixture class="el-select"></div>', driver: 'select', url: 'https://career.greeyun.com/apply' },
  { id: 'ElementSelect', markup: '<div data-fixture class="el-select"></div>', driver: 'select' },
  { id: 'AUISelect', markup: '<div data-fixture class="aui-select"></div>', driver: 'select' },
  { id: 'ElementAutocomplete', markup: '<div data-fixture class="el-autocomplete"></div>', driver: 'input' },
  { id: 'Job51ThreeLayerSelect', markup: '<div data-fixture class="job51-three-layer"></div>', driver: 'cascader', url: 'https://jobs.51job.com/apply' },
  { id: 'ZhaopinCampusRegionCascader', markup: '<div data-fixture class="el-cascader"></div>', driver: 'cascader', url: 'https://xiaoyuan.zhaopin.com/scrd/resume2' },
  { id: 'ElementCascader', markup: '<div data-fixture class="el-cascader"></div>', driver: 'cascader' },
  { id: 'ZhaopinCampusDateInput', markup: '<input data-fixture class="date-input">', driver: 'date', url: 'https://xiaoyuan.zhaopin.com/scrd/resume2' },
  { id: 'ElementDatePicker', markup: '<div data-fixture class="el-date-editor"></div>', driver: 'date' },
  { id: 'PhoenixInput', markup: '<input data-fixture class="phoenix-input">', driver: 'input', url: 'https://join.qq.com/apply' },
  { id: 'HcSuperSelector', markup: '<div data-fixture class="hc-super-selector"></div>', driver: 'cascader' },
  { id: 'PhoenixSelect', markup: '<div data-fixture class="phoenix-select"></div>', driver: 'select', url: 'https://join.qq.com/apply' },
  { id: 'AtsxSelect', markup: '<div data-fixture class="atsx-select"></div>', driver: 'select' },
  { id: 'AtsxDatePicker', markup: '<div data-fixture class="atsx-date-picker"></div>', driver: 'date' },
  { id: 'UdSelect', markup: '<div data-fixture class="ud-select"></div>', driver: 'select' },
  { id: 'TpLinkSelectBox', markup: '<div data-fixture class="tp-select-box"></div>', driver: 'select', url: 'https://career.tp-link.com/apply' },
  { id: 'TpLinkEthnicPicker', markup: '<div data-fixture class="tp-ethnic-picker"></div>', driver: 'select', url: 'https://career.tp-link.com/apply' },
  { id: 'TpLinkDatePicker', markup: '<div data-fixture class="tp-date-picker"></div>', driver: 'date', url: 'https://career.tp-link.com/apply' },
  { id: 'SdInput', markup: '<input data-fixture class="sd-input">', driver: 'input' },
  { id: 'MokahrRegionDropdown', markup: '<div data-fixture class="mokahr-region-dropdown"></div>', driver: 'cascader', url: 'https://app.mokahr.com/apply' },
  { id: 'MokahrSearchDropdown', markup: '<div data-fixture class="mokahr-search-dropdown"></div>', driver: 'select', url: 'https://app.mokahr.com/apply' },
  { id: 'MokahrDateDropdown', markup: '<div data-fixture class="mokahr-date-dropdown"></div>', driver: 'date', url: 'https://app.mokahr.com/apply' },
  { id: 'MokahrSimpleDropdown', markup: '<div data-fixture class="mokahr-simple-dropdown"></div>', driver: 'select', url: 'https://app.mokahr.com/apply' },
  { id: 'SdDropdown', markup: '<div data-fixture class="sd-dropdown"></div>', driver: 'select' },
  { id: 'LayUISelect', markup: '<div data-fixture class="layui-form-select"></div>', driver: 'select' },
  { id: 'IViewSelect', markup: '<div data-fixture class="ivu-select"></div>', driver: 'select' },
  { id: 'IViewCascader', markup: '<div data-fixture class="ivu-cascader"></div>', driver: 'cascader' },
  { id: 'ZhipinSelect', markup: '<div data-fixture class="zhipin-select"></div>', driver: 'select', url: 'https://www.zhipin.com/apply' },
  { id: 'ZhipinDatePicker', markup: '<div data-fixture class="zhipin-date-picker"></div>', driver: 'date', url: 'https://www.zhipin.com/apply' },
  { id: 'ZhipinDialog', markup: '<div data-fixture class="zhipin-dialog-trigger"></div>', driver: 'select', url: 'https://www.zhipin.com/apply' },
  { id: 'LagouCalendarPicker', markup: '<div data-fixture class="lagou-calendar"></div>', driver: 'date', url: 'https://www.lagou.com/apply' },
  { id: 'LagouEditor', markup: '<div data-fixture class="lagou-editor" contenteditable="true"></div>', driver: 'contenteditable', url: 'https://www.lagou.com/apply' },
  { id: 'ShixisengCity', markup: '<div data-fixture class="shixiseng-city"></div>', driver: 'cascader', url: 'https://www.shixiseng.com/apply' },
  { id: 'CheckboxInput', markup: '<input data-fixture type="checkbox">', driver: 'checkbox' },
  { id: 'RadioGroup', markup: '<div data-fixture class="radio-group"></div>', driver: 'radio' },
  { id: 'DateRangeCalendar', markup: '<div data-fixture class="date-range"></div>', driver: 'date-range' },
  { id: 'ThundersoftFeishuMonthRange', markup: '<div data-fixture class="feishu-month-range"></div>', driver: 'date-range', url: 'https://career.thundersoft.com/apply' },
  { id: 'MokahrSingleMonth', markup: '<div data-fixture class="moka-month"></div>', driver: 'date', url: 'https://app.mokahr.com/apply', label: '年月' },
  { id: 'MokahrMonthRange', markup: '<div data-fixture class="moka-month-range"></div>', driver: 'date-range', url: 'https://app.mokahr.com/apply' },
  { id: 'Job51LinkedSelect', markup: '<div data-fixture class="linked-select"></div>', driver: 'cascader', url: 'https://jobs.51job.com/apply' },
  { id: 'Job51PhoneField', markup: '<div data-fixture class="phone-field"></div>', driver: 'input', url: 'https://jobs.51job.com/apply' },
  { id: 'Job51ComboboxSelect', markup: '<div data-fixture role="combobox"></div>', driver: 'select', url: 'https://jobs.51job.com/apply' },
  { id: 'NativeSelect', markup: '<select data-fixture></select>', driver: 'select' },
  { id: 'Job51SetdayDate', markup: '<input data-fixture class="setday">', driver: 'date', url: 'https://jobs.51job.com/apply' },
  { id: 'Job51Input', markup: '<input data-fixture>', driver: 'input', url: 'https://jobs.51job.com/apply' },
  { id: 'BankCommPopPanel', markup: '<div data-fixture class="bankcomm-select"></div>', driver: 'select', url: 'https://job.bankcomm.com/apply' },
  { id: 'My97Date', markup: '<input data-fixture class="Wdate">', driver: 'date' },
];

const fieldTypeFor = (driver: DriverType): FieldType => driver === 'input' ? 'text' : driver;

function createField(element: HTMLElement, driver: DriverType, label = '测试字段'): FieldDescriptor {
  return {
    id: 'fixture-field',
    element,
    type: fieldTypeFor(driver),
    label,
    placeholder: '',
    name: '',
    ariaLabel: '',
    required: false,
    disabled: false,
    readOnly: false,
    currentValue: '',
    contextText: label,
  };
}

describe('复杂控件 Adapter 路由契约', () => {
  it('每个登记 Adapter 都应能被自身结构和站点证据实际路由', () => {
    expect(fixtures).toHaveLength(58);
    for (const fixture of fixtures) {
      document.body.innerHTML = fixture.markup;
      const element = document.querySelector<HTMLElement>('[data-fixture]');
      expect(element, fixture.id).not.toBeNull();
      const matches = getMatchingControlAdapters({
        field: createField(element!, fixture.driver, fixture.label),
        driverType: fixture.driver,
        pageUrl: fixture.url || 'https://example.com/apply',
      });
      expect(matches.some((match) => match.adapter.id === fixture.id), fixture.id).toBe(true);
    }
  });

  it('没有内部 input 的站点控件也应被页面扫描并分配正确 Driver', () => {
    const scannerFixtures: Array<{ id: string; className: string; type: FieldType }> = [
      { id: 'TP-Link 民族', className: 'tp-ethnic-picker', type: 'select' },
      { id: '直聘 Dialog', className: 'zhipin-dialog-trigger', type: 'select' },
      { id: '拉勾日历', className: 'lagou-calendar', type: 'date' },
      { id: '飞书年月区间', className: 'feishu-month-range', type: 'date-range' },
      { id: 'Moka 单年月', className: 'moka-month', type: 'date' },
      { id: 'Moka 年月区间', className: 'moka-month-range', type: 'date-range' },
      { id: '51Job 联动', className: 'linked-select', type: 'cascader' },
      { id: '51Job Setday', className: 'setday', type: 'date' },
      { id: '交通银行弹层', className: 'bankcomm-select', type: 'select' },
    ];

    for (const fixture of scannerFixtures) {
      document.body.innerHTML = `<form class="application-form"><div class="${fixture.className}"></div></form>`;
      const fields = pageAnalyzer.analyzePage(document);
      expect(fields, fixture.id).toHaveLength(1);
      expect(fields[0].type, fixture.id).toBe(fixture.type);
    }
  });
});
