import { describe, it, expect, beforeEach } from 'vitest';
import { optionResolver, CanonicalDegree, CanonicalGender, CanonicalPoliticalStatus } from '@/core/resolvers/optionResolver';
import { locationResolver } from '@/core/resolvers/locationResolver';
import { dateEngine } from '@/core/resolvers/dateEngine';
import { fillDatePicker, fillDateRangePicker } from '@/core/engine/datepicker';

describe('Resolvers & Domain Engines (核心结构化解析器套件)', () => {
  describe('OptionResolver (10 大标准域下拉选项语义解析器)', () => {
    it('应该能将各类学历别名转换为标准 CanonicalDegree.BACHELOR', () => {
      expect(optionResolver.toCanonical('degree', '大学本科')).toBe(CanonicalDegree.BACHELOR);
      expect(optionResolver.toCanonical('degree', '本科生')).toBe(CanonicalDegree.BACHELOR);
      expect(optionResolver.toCanonical('degree', "Bachelor's Degree")).toBe(CanonicalDegree.BACHELOR);
      expect(optionResolver.toCanonical('degree', '学士')).toBe(CanonicalDegree.BACHELOR);
      expect(optionResolver.toCanonical('degree', '硕士研究生')).toBe(CanonicalDegree.MASTER);
      expect(optionResolver.toCanonical('degree', '大专')).toBe(CanonicalDegree.ASSOCIATE);
    });

    it('应该在页面实际存在的选项列表中精准匹配出真实 Option 字符串', () => {
      const degreeOptions = ['请选择学历', '高中及以下', '大专/专科', '大学本科（学士）', '硕士研究生', '博士研究生'];
      const matched = optionResolver.resolveOptionValue(degreeOptions, 'degree', '本科');
      expect(matched).toBe('大学本科（学士）');

      const englishDegreeOptions = ['Select Degree', 'Associate', "Bachelor's Degree", "Master's Degree", 'PhD'];
      const matchedEn = optionResolver.resolveOptionValue(englishDegreeOptions, 'degree', '本科');
      expect(matchedEn).toBe("Bachelor's Degree");
    });

    it('应该正确处理政治面貌与性别归一化', () => {
      const polOptions = ['群众', '共青团员', '中共预备党员', '中共党员'];
      expect(optionResolver.resolveOptionValue(polOptions, 'politicalStatus', '党员')).toBe('中共党员');
      expect(optionResolver.resolveOptionValue(polOptions, 'politicalStatus', '预备党员')).toBe('中共预备党员');

      const genderOptions = ['Male (男)', 'Female (女)'];
      expect(optionResolver.resolveOptionValue(genderOptions, 'gender', '男')).toBe('Male (男)');
      expect(optionResolver.resolveOptionValue(genderOptions, 'gender', '女')).toBe('Female (女)');
    });
  });

  describe('LocationResolver (省市层级定位与标准化引擎)', () => {
    it('应该能将各类中文与拼音别名归一化为标准省市', () => {
      const loc1 = locationResolver.normalizeLocation('北京市海淀区');
      expect(loc1.province).toBe('北京市');
      expect(loc1.city).toBe('北京市');

      const loc2 = locationResolver.normalizeLocation('山东省青岛市市南区');
      expect(loc2.province).toBe('山东省');
      expect(loc2.city).toBe('青岛市');

      const loc3 = locationResolver.normalizeLocation('Shenzhen, Guangdong');
      expect(loc3.province).toBe('广东省');
      expect(loc3.city).toBe('深圳市');
    });

    it('应该能从复杂下拉选项数组中匹配出复合城市选项', () => {
      const options = ['请选择城市', '中国 - 北京市', '中国 - 上海市', '广东省 - 深圳市', '浙江省 - 杭州市'];
      
      expect(locationResolver.matchLocationOption(options, '北京')).toBe('中国 - 北京市');
      expect(locationResolver.matchLocationOption(options, '深圳')).toBe('广东省 - 深圳市');
      expect(locationResolver.matchLocationOption(options, '杭州市')).toBe('浙江省 - 杭州市');
    });
  });

  describe('DateEngine (结构化日期解析与注入引擎)', () => {
    it('应该能准确解析多样化日期字符串为 SemanticDate 结构', () => {
      const d1 = dateEngine.parseSemanticDate('2023-09');
      expect(d1.year).toBe(2023);
      expect(d1.month).toBe(9);
      expect(d1.isPresent).toBe(false);

      const d2 = dateEngine.parseSemanticDate('2020年06月15日');
      expect(d2.year).toBe(2020);
      expect(d2.month).toBe(6);
      expect(d2.day).toBe(15);

      const d3 = dateEngine.parseSemanticDate('至今');
      expect(d3.isPresent).toBe(true);

      const d4 = dateEngine.parseSemanticDate('07/2024');
      expect(d4.year).toBe(2024);
      expect(d4.month).toBe(7);
      expect(d4.valid).toBe(true);

      expect(dateEngine.parseSemanticDate('2024-19').valid).toBe(false);
      expect(dateEngine.parseSemanticDate('2023-02-29').valid).toBe(false);
      expect(dateEngine.parseSemanticDate('2024-02-29').valid).toBe(true);
    });

    it('formatDate 应该能输出各种格式要求', () => {
      const semantic = { year: 2024, month: 7, day: 1, isPresent: false, raw: '2024-07' };

      expect(dateEngine.formatDate(semantic, 'YYYY-MM')).toBe('2024-07');
      expect(dateEngine.formatDate(semantic, 'YYYY-MM-DD')).toBe('2024-07-01');
      expect(dateEngine.formatDate(semantic, 'YYYY年MM月')).toBe('2024年07月');
      expect(dateEngine.formatDate(semantic, 'MM/YYYY')).toBe('07/2024');
    });

    it('injectSemanticDate 应该能正确注入年/月双下拉框组合', async () => {
      document.body.innerHTML = `
        <div class="form-item date-range">
          <label>入学年月</label>
          <select id="yearSelect">
            <option value="">年</option>
            <option value="2021">2021</option>
            <option value="2022">2022</option>
            <option value="2023">2023</option>
          </select>
          <select id="monthSelect">
            <option value="">月</option>
            <option value="08">8</option>
            <option value="09">9</option>
            <option value="10">10</option>
          </select>
        </div>
      `;

      const yearSelect = document.getElementById('yearSelect') as HTMLSelectElement;
      const success = await dateEngine.injectSemanticDate(yearSelect, '2022-09');

      expect(success).toBe(true);
      expect(yearSelect.value).toBe('2022');
      const monthSelect = document.getElementById('monthSelect') as HTMLSelectElement;
      expect(monthSelect.value).toBe('09');
    });

    it('native date 不应写入非法的“至今”，正常日期需读回确认且恢复只读状态', async () => {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.readOnly = true;
      document.body.appendChild(dateInput);

      expect(await dateEngine.injectSemanticDate(dateInput, '至今')).toBe(false);
      expect(dateInput.value).toBe('');
      expect(dateInput.readOnly).toBe(true);

      expect(await dateEngine.injectSemanticDate(dateInput, '2023-9')).toBe(true);
      expect(dateInput.value).toBe('2023-09-01');
      expect(dateInput.readOnly).toBe(true);
    });

    it('日期范围只在每个实际日期都写入成功时返回成功', async () => {
      const container = document.createElement('div');
      container.innerHTML = '<input type="date"><input type="date">';
      document.body.appendChild(container);

      expect(await fillDateRangePicker(container, '2023-01', '至今')).toBe(false);
      expect((container.querySelectorAll('input')[0] as HTMLInputElement).value).toBe('2023-01-01');
      expect((container.querySelectorAll('input')[1] as HTMLInputElement).value).toBe('');
    });
  });
});
