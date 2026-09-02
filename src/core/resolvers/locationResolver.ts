/**
 * Location Resolver (省市层级定位与标准化引擎)
 * 支持中英文别名、多级省市区解析与复杂级联下拉匹配 (如 "中国-北京", "北京市/海淀区", "Beijing, China")
 */

import { findRegionPath } from '../data/regions';

export interface CanonicalLocation {
  country: string;
  province: string;
  city: string;
  district?: string;
  raw: string;
}

interface CityMapping {
  province: string;
  city: string;
  aliases: string[];
}

// English abbreviations are a small overlay; Chinese names and hierarchy come only from the full catalog.
const ENGLISH_CITY_ALIASES: Record<string, string[]> = {
  北京市: ['beijing', 'bj'], 上海市: ['shanghai', 'sh'], 天津市: ['tianjin', 'tj'], 重庆市: ['chongqing', 'cq'],
  广州市: ['guangzhou', 'gz'], 深圳市: ['shenzhen', 'sz'], 珠海市: ['zhuhai'], 东莞市: ['dongguan'], 佛山市: ['foshan'],
  杭州市: ['hangzhou', 'hz'], 宁波市: ['ningbo'], 南京市: ['nanjing', 'nj'], 苏州市: ['suzhou'], 无锡市: ['wuxi'],
  成都市: ['chengdu', 'cd'], 武汉市: ['wuhan', 'wh'], 西安市: ['xian', 'xa'], 青岛市: ['qingdao', 'qd'],
  济南市: ['jinan', 'jn'], 厦门市: ['xiamen', 'xm'], 福州市: ['fuzhou', 'fz'], 长沙市: ['changsha'],
  郑州市: ['zhengzhou'], 合肥市: ['hefei'], 大连市: ['dalian', 'dl'], 沈阳市: ['shenyang'],
  香港特别行政区: ['hong kong', 'hk'], 澳门特别行政区: ['macau', 'mo'], 台北市: ['taipei'], 台湾省: ['taiwan'],
};
const CITY_DATABASE: CityMapping[] = Object.entries(ENGLISH_CITY_ALIASES).flatMap(([name, aliases]) => {
  const path = findRegionPath(name);
  return path ? [{ province: path[0], city: path[1] || path[0], aliases }] : [];
});

export class LocationResolver {
  /**
   * 将输入的原始城市/地址文本标准化为 CanonicalLocation
   */
  normalizeLocation(rawText: string): CanonicalLocation {
    if (!rawText) {
      return { country: '中国', province: '', city: '', raw: '' };
    }

    const path = findRegionPath(rawText);
    if (path) return { country: '中国', province: path[0], city: path[1] || path[0], district: path[2], raw: rawText };
    const lowerRaw = rawText.toLowerCase();
    const clean = lowerRaw.replace(/[\s\->—_,\./]/g, '');

    // 收集所有别名项并按别名长度从长到短排序 (防止 'sh' 抢先命中 'shenzhen')
    const allCandidateAliases: { mapping: CityMapping; alias: string }[] = [];
    for (const item of CITY_DATABASE) {
      for (const alias of item.aliases) {
        allCandidateAliases.push({ mapping: item, alias });
      }
    }
    allCandidateAliases.sort((a, b) => b.alias.length - a.alias.length);

    for (const { mapping, alias } of allCandidateAliases) {
      const lowerAlias = alias.toLowerCase();
      // 短于或等于 2 字符的英文缩写 (如 "sh", "bj", "sz")，必须按单词边界匹配
      if (lowerAlias.length <= 2 && /^[a-z0-9]+$/i.test(lowerAlias)) {
        const regex = new RegExp(`(?:^|[^a-z0-9])${lowerAlias}(?:$|[^a-z0-9])`, 'i');
        if (regex.test(lowerRaw)) {
          return {
            country: '中国',
            province: mapping.province,
            city: mapping.city,
            raw: rawText,
          };
        }
      } else {
        const cleanAlias = lowerAlias.replace(/[\s\->—_,\./]/g, '');
        const englishToken = /^[a-z ]+$/i.test(lowerAlias)
          && new RegExp(`(?:^|[^a-z])${lowerAlias}(?:$|[^a-z])`, 'i').test(lowerRaw);
        if (clean === cleanAlias || englishToken) {
          return {
            country: '中国',
            province: mapping.province,
            city: mapping.city,
            raw: rawText,
          };
        }
      }
    }

    return {
      country: '中国',
      province: '',
      city: rawText.replace(/[\s市省区]/g, ''),
      raw: rawText,
    };
  }

  /**
   * 在下拉选项数组中匹配出目标城市的最优 Option
   * 支持 "中国-北京", "北京市 - 海淀区", "Beijing (CN)" 等复合格式
   */
  matchLocationOption(availableOptions: string[], targetLocation: string): string | null {
    if (!availableOptions || availableOptions.length === 0 || !targetLocation) {
      return null;
    }

    const canonical = this.normalizeLocation(targetLocation);
    const cleanTarget = targetLocation.toLowerCase().replace(/[\s\->—_,\./市省区]/g, '');
    const cleanCity = canonical.city.replace(/[\s市省区]/g, '').toLowerCase();
    const cleanProv = canonical.province.replace(/[\s市省区]/g, '').toLowerCase();

    // 1. 完全或别名直接命中
    for (const opt of availableOptions) {
      const cleanOpt = opt.toLowerCase().replace(/[\s\->—_,\./市省区()（）]/g, '');
      if (cleanOpt === cleanCity || cleanOpt === cleanTarget) {
        return opt;
      }
    }

    // 2. 复合层级匹配 (如 "中国-北京市", "广东省-深圳市")
    for (const opt of availableOptions) {
      const cleanOpt = opt.toLowerCase().replace(/[\s\->—_,\./市省区()（）]/g, '');
      if (cleanCity && cleanOpt.includes(cleanCity) && (!canonical.district || !this.normalizeLocation(opt).district)) {
        return opt;
      }
    }

    // 3. 英文城市名或别名匹配
    for (const item of CITY_DATABASE) {
      if (item.city === canonical.city) {
        for (const alias of item.aliases) {
          for (const opt of availableOptions) {
            if (opt.toLowerCase().includes(alias.toLowerCase())) {
              return opt;
            }
          }
        }
      }
    }

    return null;
  }
}

export const locationResolver = new LocationResolver();
