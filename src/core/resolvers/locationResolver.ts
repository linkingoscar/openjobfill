/**
 * Location Resolver (省市层级定位与标准化引擎)
 * 支持中英文别名、多级省市区解析与复杂级联下拉匹配 (如 "中国-北京", "北京市/海淀区", "Beijing, China")
 */

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

const CITY_DATABASE: CityMapping[] = [
  // 直辖市
  { province: '北京市', city: '北京市', aliases: ['北京', '北京市', 'beijing', 'bj', '海淀', '朝阳', '西城', '东城'] },
  { province: '上海市', city: '上海市', aliases: ['上海', '上海市', 'shanghai', 'sh', '浦东', '徐汇', '黄浦', '杨浦'] },
  { province: '天津市', city: '天津市', aliases: ['天津', '天津市', 'tianjin', 'tj', '滨海新区'] },
  { province: '重庆市', city: '重庆市', aliases: ['重庆', '重庆市', 'chongqing', 'cq', '渝中'] },

  // 广东省
  { province: '广东省', city: '广州市', aliases: ['广州', '广州市', 'guangzhou', 'gz', '天河', '番禺'] },
  { province: '广东省', city: '深圳市', aliases: ['深圳', '深圳市', 'shenzhen', 'sz', '南山', '福田', '宝安'] },
  { province: '广东省', city: '珠海市', aliases: ['珠海', '珠海市', 'zhuhai'] },
  { province: '广东省', city: '东莞市', aliases: ['东莞', '东莞市', 'dongguan'] },
  { province: '广东省', city: '佛山市', aliases: ['佛山', '佛山市', 'foshan'] },

  // 浙江省
  { province: '浙江省', city: '杭州市', aliases: ['杭州', '杭州市', 'hangzhou', 'hz', '西湖', '余杭', '滨江'] },
  { province: '浙江省', city: '宁波市', aliases: ['宁波', '宁波市', 'ningbo'] },

  // 江苏省
  { province: '江苏省', city: '南京市', aliases: ['南京', '南京市', 'nanjing', 'nj', '江宁', '雨花台'] },
  { province: '江苏省', city: '苏州市', aliases: ['苏州', '苏州市', 'suzhou', '工业园区', '姑苏'] },
  { province: '江苏省', city: '无锡市', aliases: ['无锡', '无锡市', 'wuxi'] },

  // 四川省
  { province: '四川省', city: '成都市', aliases: ['成都', '成都市', 'chengdu', 'cd', '高新区', '武侯', '锦江'] },

  // 湖北省
  { province: '湖北省', city: '武汉市', aliases: ['武汉', '武汉市', 'wuhan', 'wh', '光谷', '洪山', '武昌'] },

  // 陕西省
  { province: '陕西省', city: '西安市', aliases: ['西安', '西安市', 'xian', 'xa', '雁塔', '高新'] },

  // 山东省
  { province: '山东省', city: '青岛市', aliases: ['青岛', '青岛市', 'qingdao', 'qd', '市南', '崂山'] },
  { province: '山东省', city: '济南市', aliases: ['济南', '济南市', 'jinan', 'jn', '历下'] },

  // 福建省
  { province: '福建省', city: '厦门市', aliases: ['厦门', '厦门市', 'xiamen', 'xm', '思明'] },
  { province: '福建省', city: '福州市', aliases: ['福州', '福州市', 'fuzhou', 'fz'] },

  // 湖南省
  { province: '湖南省', city: '长沙市', aliases: ['长沙', '长沙市', 'changsha', '岳麓'] },

  // 河南省
  { province: '河南省', city: '郑州市', aliases: ['郑州', '郑州市', 'zhengzhou', '金水'] },

  // 安徽省
  { province: '安徽省', city: '合肥市', aliases: ['合肥', '合肥市', 'hefei', '蜀山'] },

  // 辽宁省
  { province: '辽宁省', city: '大连市', aliases: ['大连', '大连市', 'dalian', 'dl'] },
  { province: '辽宁省', city: '沈阳市', aliases: ['沈阳', '沈阳市', 'shenyang'] },

  // 香港 & 澳门 & 台湾
  { province: '香港特别行政区', city: '香港', aliases: ['香港', 'hong kong', 'hk'] },
  { province: '澳门特别行政区', city: '澳门', aliases: ['澳门', 'macau', 'mo'] },
  { province: '台湾省', city: '台北市', aliases: ['台北', 'taipei', '台湾', 'taiwan'] },
];

export class LocationResolver {
  /**
   * 将输入的原始城市/地址文本标准化为 CanonicalLocation
   */
  normalizeLocation(rawText: string): CanonicalLocation {
    if (!rawText) {
      return { country: '中国', province: '', city: '', raw: '' };
    }

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
        if (clean.includes(cleanAlias) || cleanAlias.includes(clean)) {
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
      if (cleanOpt.includes(cleanCity) || (cleanProv && cleanOpt.includes(cleanProv))) {
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
