/**
 * 招聘表单常见枚举与级联值的归一化工具。
 * 数据表来自旧版 OpenJobFill_Plugin，并收敛为无 DOM 依赖的纯函数。
 */

export const PROVINCE_CITY_MAP: Record<string, string[]> = {
  北京市: ['北京市', '海淀区', '朝阳区', '西城区', '东城区', '丰台区', '昌平区', '大兴区'],
  上海市: ['上海市', '浦东新区', '闵行区', '徐汇区', '黄浦区', '杨浦区', '静安区'],
  广东省: ['广州市', '深圳市', '珠海市', '佛山市', '东莞市', '中山市', '惠州市', '汕头市', '江门市'],
  浙江省: ['杭州市', '宁波市', '温州市', '嘉兴市', '绍兴市', '金华市', '台州市', '湖州市'],
  江苏省: ['南京市', '苏州市', '无锡市', '常州市', '南通市', '扬州市', '徐州市', '镇江市', '盐城市'],
  四川省: ['成都市', '绵阳市', '德阳市', '宜宾市', '南充市', '泸州市'],
  湖北省: ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄冈市'],
  陕西省: ['西安市', '咸阳市', '宝鸡市', '汉中市', '延安市'],
  山东省: ['济南市', '青岛市', '烟台市', '潍坊市', '临沂市', '淄博市'],
  福建省: ['福州市', '厦门市', '泉州市', '漳州市'],
  安徽省: ['合肥市', '芜湖市', '蚌埠市', '马鞍山市'],
  湖南省: ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市'],
  河南省: ['郑州市', '洛阳市', '新乡市', '南阳市'],
  河北省: ['石家庄市', '保定市', '唐山市', '廊坊市'],
  辽宁省: ['沈阳市', '大连市', '鞍山市'],
  吉林省: ['长春市', '吉林市'],
  黑龙江省: ['哈尔滨市', '大庆市', '齐齐哈尔市'],
  天津市: ['天津市', '滨海新区', '南开区', '和平区', '河西区'],
  重庆市: ['重庆市', '渝北区', '沙坪坝区', '江北区', '南岸区'],
  江西省: ['南昌市', '赣州市', '九江市'],
  广西壮族自治区: ['南宁市', '桂林市', '柳州市'],
  云南省: ['昆明市', '大理白族自治州', '曲靖市'],
  贵州省: ['贵阳市', '遵义市'],
  山西省: ['太原市', '大同市'],
  内蒙古自治区: ['呼和浩特市', '包头市', '鄂尔多斯市'],
  新疆维吾尔自治区: ['乌鲁木齐市', '克拉玛依市'],
  甘肃省: ['兰州市', '天水市'],
  海南省: ['海口市', '三亚市'],
};

export interface MajorCategory {
  category: string;
  subCategory: string;
  majors: string[];
}

export const MAJOR_CATEGORY_TREE: MajorCategory[] = [
  { category: '工学', subCategory: '计算机类', majors: ['计算机科学与技术', '软件工程', '网络工程', '信息安全', '物联网工程', '数字媒体技术', '智能科学与技术', '空间信息与数字技术', '电子与计算机工程', '数据科学与大数据技术', '网络空间安全', '人工智能', '密码科学与技术', '区块链工程'] },
  { category: '工学', subCategory: '电子信息类', majors: ['电子信息工程', '电子科学与技术', '通信工程', '微电子科学与工程', '光电信息科学与工程', '信息工程', '集成电路设计与集成系统', '人工智能', '医学信息工程'] },
  { category: '工学', subCategory: '自动化类', majors: ['自动化', '轨道交通信号与控制', '机器人工程', '邮电工程', '核电工程'] },
  { category: '工学', subCategory: '机械类', majors: ['机械工程', '机械设计制造及其自动化', '材料成型及控制工程', '机械电子工程', '工业设计', '车辆工程'] },
  { category: '工学', subCategory: '电气类', majors: ['电气工程及其自动化', '智能电网信息工程', '光源与照明', '电气工程与智能控制'] },
  { category: '工学', subCategory: '土木类', majors: ['土木工程', '建筑环境与能源应用工程', '给排水科学与工程', '道路桥梁与渡河工程'] },
  { category: '经济学', subCategory: '金融学类', majors: ['金融学', '金融工程', '保险学', '投资学', '金融数学', '信用管理', '经济与金融', '精算学', '互联网金融'] },
  { category: '经济学', subCategory: '经济学类', majors: ['经济学', '经济统计学', '资源与环境经济学', '商务经济学', '数字经济'] },
  { category: '经济学', subCategory: '财政学类', majors: ['财政学', '税收学'] },
  { category: '经济学', subCategory: '经济与贸易类', majors: ['国际经济与贸易', '贸易经济', '国际商务'] },
  { category: '管理学', subCategory: '工商管理类', majors: ['工商管理', '市场营销', '会计学', '财务管理', '国际商务', '人力资源管理', '审计学', '物业管理', '文化产业管理'] },
  { category: '管理学', subCategory: '管理科学与工程类', majors: ['管理科学', '信息管理与信息系统', '工程管理', '房地产开发与管理', '工程造价', '保密管理'] },
  { category: '管理学', subCategory: '电子商务类', majors: ['电子商务', '电子商务及法律', '跨境电子商务'] },
  { category: '管理学', subCategory: '物流管理与工程类', majors: ['物流管理', '物流工程', '供应链管理'] },
  { category: '管理学', subCategory: '公共管理类', majors: ['行政管理', '公共事业管理', '劳动与社会保障', '土地资源管理'] },
  { category: '理学', subCategory: '数学类', majors: ['数学与应用数学', '信息与计算科学', '数理基础科学', '数据计算及应用'] },
  { category: '理学', subCategory: '物理学类', majors: ['物理学', '应用物理学', '核物理', '声学'] },
  { category: '理学', subCategory: '统计学类', majors: ['统计学', '应用统计学'] },
  { category: '文学', subCategory: '中国语言文学类', majors: ['汉语言文学', '汉语言', '汉语国际教育', '中国少数民族语言文学', '古典文献学', '应用语言学', '秘书学'] },
  { category: '文学', subCategory: '外国语言文学类', majors: ['英语', '俄语', '德语', '法语', '西班牙语', '阿拉伯语', '日语', '韩语', '翻译', '商务英语'] },
  { category: '文学', subCategory: '新闻传播学类', majors: ['新闻学', '广播电视学', '广告学', '传播学', '编辑出版学', '网络与新媒体', '数字出版'] },
  { category: '法学', subCategory: '法学类', majors: ['法学', '知识产权', '监狱学', '信用风险管理与法律防控', '国际经贸规则'] },
];

export function inferMajorHierarchy(majorName: string): string[] {
  const cleanMajor = majorName.trim().replace(/专业$/, '');
  if (!cleanMajor) return [];
  for (const entry of MAJOR_CATEGORY_TREE) {
    const major = entry.majors.find((candidate) => candidate === cleanMajor || cleanMajor.includes(candidate) || candidate.includes(cleanMajor));
    if (major) return [entry.category, entry.subCategory, major];
  }
  return [cleanMajor];
}

export function normalizeLocationName(name: string): string {
  return name.replace(/(省|市|特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|地区|自治州|盟|区|县)$/g, '').trim();
}

export function inferLocationPath(cityName: string, provinceName?: string): string[] {
  const normalizedCity = normalizeLocationName(cityName);
  if (!normalizedCity) return [];
  if (provinceName) return [provinceName, cityName].filter(Boolean);
  for (const [province, cities] of Object.entries(PROVINCE_CITY_MAP)) {
    if (normalizeLocationName(province) === normalizedCity) return [province];
    const city = cities.find((candidate) => normalizeLocationName(candidate) === normalizedCity);
    if (city) return [province, city];
  }
  return [cityName];
}

export function matchDegreeOption(degree: string, candidateOptions: string[]): string | null {
  const aliases: Record<string, string[]> = {
    本科: ['本科', '大学本科', '学士', '全日制统招本科', '普通全日制本科', '学士学位', '本科及以上'],
    硕士: ['硕士', '硕士研究生', '研究生', '硕士及以上', '硕士学位'],
    博士: ['博士', '博士研究生', '博士及以上', '博士学位'],
    大专: ['大专', '专科', '高等专科', '专科及以上'],
  };
  const matches = aliases[degree.trim()] || [degree.trim()];
  return candidateOptions.find((option) => matches.some((alias) => option.trim().includes(alias) || alias.includes(option.trim()))) || null;
}
