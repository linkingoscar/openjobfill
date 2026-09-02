/**
 * 10 大标准域 Option Resolver (下拉选项语义归一化解析器)
 * 将简历数据转换为领域标准枚举 (Canonical Enum)，并在页面实际选项数组中匹配出最佳 Option 字符串
 */

export type CanonicalDomain =
  | 'degree'
  | 'academicDegree'
  | 'gender'
  | 'politicalStatus'
  | 'maritalStatus'
  | 'jobType'
  | 'availability'
  | 'languageLevel'
  | 'jobStatus'
  | 'ethnicity';

export enum CanonicalDegree {
  DOCTOR = 'DOCTOR',
  MASTER = 'MASTER',
  BACHELOR = 'BACHELOR',
  ASSOCIATE = 'ASSOCIATE',
  HIGH_SCHOOL = 'HIGH_SCHOOL',
  OTHER = 'OTHER',
}

export enum CanonicalGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum CanonicalPoliticalStatus {
  CCP_MEMBER = 'CCP_MEMBER',
  PROBATIONARY_MEMBER = 'PROBATIONARY_MEMBER',
  YOUTH_LEAGUE = 'YOUTH_LEAGUE',
  MASSES = 'MASSES',
  DEMOCRATIC_PARTY = 'DEMOCRATIC_PARTY',
}

export enum CanonicalMaritalStatus {
  UNMARRIED = 'UNMARRIED',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  OTHER = 'OTHER',
}

export enum CanonicalJobType {
  FULL_TIME = 'FULL_TIME',
  INTERNSHIP = 'INTERNSHIP',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
}

export enum CanonicalAvailability {
  IMMEDIATELY = 'IMMEDIATELY',
  WITHIN_1_WEEK = 'WITHIN_1_WEEK',
  WITHIN_1_MONTH = 'WITHIN_1_MONTH',
  WITHIN_3_MONTHS = 'WITHIN_3_MONTHS',
  NEGOTIABLE = 'NEGOTIABLE',
}

export enum CanonicalJobStatus {
  EMPLOYED_CONSIDERING = 'EMPLOYED_CONSIDERING',
  EMPLOYED_NOT_CONSIDERING = 'EMPLOYED_NOT_CONSIDERING',
  UNEMPLOYED = 'UNEMPLOYED',
  STUDENT_GRADUATING = 'STUDENT_GRADUATING',
}

/**
 * 各标准枚举在中英文网申中可能出现的别名关键词映射
 */
const CANONICAL_MAPPINGS: Record<CanonicalDomain, Record<string, string[]>> = {
  degree: {
    [CanonicalDegree.DOCTOR]: ['博士', '博士研究生', 'phd', 'doctor', 'doctorate', '博士后'],
    [CanonicalDegree.MASTER]: ['硕士', '硕士研究生', '研究生', 'master', 'postgraduate', 'mba', 'emba'],
    [CanonicalDegree.BACHELOR]: ['本科', '大学本科', '学士', '本科生', 'bachelor', 'bachelors', 'undergraduate', 'b.s.', 'b.a.'],
    [CanonicalDegree.ASSOCIATE]: ['专科', '大专', '高职', '专科生', 'associate', 'college diploma', 'diploma'],
    [CanonicalDegree.HIGH_SCHOOL]: ['高中', '中专', '职高', 'high school', 'secondary'],
  },
  academicDegree: {
    [CanonicalDegree.DOCTOR]: ['博士学位', '工学博士', '理学博士', 'doctorate degree'],
    [CanonicalDegree.MASTER]: ['硕士学位', '工学硕士', '理学硕士', 'master degree'],
    [CanonicalDegree.BACHELOR]: ['学士学位', '工学学士', '理学学士', 'bachelor degree'],
  },
  gender: {
    [CanonicalGender.MALE]: ['男', '男性', 'male', 'm', 'sir', 'mr'],
    [CanonicalGender.FEMALE]: ['女', '女性', 'female', 'f', 'miss', 'ms', 'mrs'],
  },
  politicalStatus: {
    [CanonicalPoliticalStatus.CCP_MEMBER]: ['中共党员', '党员', '正式党员', 'ccp member', 'party member'],
    [CanonicalPoliticalStatus.PROBATIONARY_MEMBER]: ['预备党员', '中共预备党员', 'probationary'],
    [CanonicalPoliticalStatus.YOUTH_LEAGUE]: ['共青团员', '团员', 'youth league'],
    [CanonicalPoliticalStatus.MASSES]: ['群众', '普通公民', 'masses', 'citizen'],
    [CanonicalPoliticalStatus.DEMOCRATIC_PARTY]: ['民主党派', '无党派民主人士', 'democratic'],
  },
  maritalStatus: {
    [CanonicalMaritalStatus.UNMARRIED]: ['未婚', '单身', 'unmarried', 'single'],
    [CanonicalMaritalStatus.MARRIED]: ['已婚', '已婚已育', '已婚未育', 'married'],
    [CanonicalMaritalStatus.DIVORCED]: ['离异', '丧偶', 'divorced'],
  },
  jobType: {
    [CanonicalJobType.FULL_TIME]: ['全职', '全职工作', '正式', '社招', 'full-time', 'full time', 'regular'],
    [CanonicalJobType.INTERNSHIP]: ['实习', '实习生', '日常实习', '校招实习', 'internship', 'intern'],
    [CanonicalJobType.PART_TIME]: ['兼职', 'part-time', 'part time'],
    [CanonicalJobType.CONTRACT]: ['外包', '劳务派遣', '合同制', 'contract', 'contractor'],
  },
  availability: {
    [CanonicalAvailability.IMMEDIATELY]: ['随时到岗', '即时', '立即', 'immediately', 'asap'],
    [CanonicalAvailability.WITHIN_1_WEEK]: ['1周内', '一周内', '7天内', 'within 1 week', 'within one week'],
    [CanonicalAvailability.WITHIN_1_MONTH]: ['1个月内', '1-2周', '30天内', 'within 1 month', '1 month'],
    [CanonicalAvailability.WITHIN_3_MONTHS]: ['1-3个月', '3个月内', 'within 3 months'],
    [CanonicalAvailability.NEGOTIABLE]: ['面议', '协商', '待定', 'negotiable'],
  },
  languageLevel: {
    fluent: ['精通', '流利', '母语', 'native', 'fluent', 'professional'],
    cet6: ['英语六级', '六级', 'cet-6', 'cet6', 'cet 6'],
    cet4: ['英语四级', '四级', 'cet-4', 'cet4', 'cet 4'],
    tem8: ['专业八级', '专八', 'tem-8', 'tem8'],
    ielts: ['雅思', 'ielts'],
    toefl: ['托福', 'toefl'],
  },
  jobStatus: {
    [CanonicalJobStatus.EMPLOYED_CONSIDERING]: ['在职-考虑机会', '在职看机会', '离职中', '在职', 'employed'],
    [CanonicalJobStatus.STUDENT_GRADUATING]: ['应届生', '在校生', '即将毕业', '应届毕业生', 'student', 'graduating'],
    [CanonicalJobStatus.UNEMPLOYED]: ['离职-随时到岗', '待业', '离职', 'unemployed'],
  },
  ethnicity: {
    han: ['汉族', '汉', 'han'],
    other: ['少数民族', 'minority'],
  },
};

export class OptionResolver {
  /**
   * 将输入的原始文本归一化为目标领域的标准 Canonical 标识符
   */
  toCanonical(domain: CanonicalDomain, rawValue: string): string | null {
    if (!rawValue) return null;
    const clean = rawValue.toLowerCase().replace(/[\s_\-()（）【】\[\]/]/g, '');
    const domainMap = CANONICAL_MAPPINGS[domain];
    if (!domainMap) return null;

    // 1. 优先完全一致匹配 (防止 '预备党员' 包含 '党员' 被误判为正式党员)
    for (const [canonicalKey, keywords] of Object.entries(domainMap)) {
      for (const kw of keywords) {
        const cleanKw = kw.toLowerCase().replace(/[\s_\-()（）【】\[\]/]/g, '');
        if (clean === cleanKw) {
          return canonicalKey;
        }
      }
    }

    // 2. 其次进行包含匹配
    for (const [canonicalKey, keywords] of Object.entries(domainMap)) {
      // 预备党员排斥正式党员
      if (canonicalKey === CanonicalPoliticalStatus.CCP_MEMBER && clean.includes('预备')) {
        continue;
      }
      for (const kw of keywords) {
        const cleanKw = kw.toLowerCase().replace(/[\s_\-()（）【】\[\]/]/g, '');
        if (clean.includes(cleanKw) || cleanKw.includes(clean)) {
          return canonicalKey;
        }
      }
    }
    return null;
  }

  /**
   * 在页面下拉选项列表中，找到与输入值语义最匹配的真实 Option 文本
   */
  resolveOptionValue(
    availableOptions: string[],
    domain: CanonicalDomain,
    targetValue: string
  ): string | null {
    if (!availableOptions || availableOptions.length === 0 || !targetValue) {
      return null;
    }

    // 1. 尝试完全匹配与去符号匹配
    const cleanTarget = targetValue.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
    for (const opt of availableOptions) {
      const cleanOpt = opt.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
      if (cleanOpt === cleanTarget) {
        return opt;
      }
    }

    // 2. 基于 Canonical Enum 归一化匹配
    const canonicalKey = this.toCanonical(domain, targetValue);
    if (canonicalKey) {
      const domainMap = CANONICAL_MAPPINGS[domain];
      const synonymKeywords = domainMap[canonicalKey] || [];

      // 2.1 优先完全命中同义词 (例如 "中共党员" 精确优先于包含 "党员" 的 "中共预备党员")
      for (const opt of availableOptions) {
        const cleanOpt = opt.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
        for (const syn of synonymKeywords) {
          const cleanSyn = syn.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
          if (cleanOpt === cleanSyn) {
            return opt;
          }
        }
      }

      // 2.2 其次进行包含匹配 (跳过如 "预备" 等具有排斥语义的选项)
      for (const opt of availableOptions) {
        const cleanOpt = opt.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
        // 如果是正式党员，排除"预备"
        if (canonicalKey === CanonicalPoliticalStatus.CCP_MEMBER && cleanOpt.includes('预备')) {
          continue;
        }
        for (const syn of synonymKeywords) {
          const cleanSyn = syn.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
          if (cleanOpt.includes(cleanSyn) || cleanSyn.includes(cleanOpt)) {
            return opt;
          }
        }
      }
    }

    // 3. 通用包含子串回退
    for (const opt of availableOptions) {
      const cleanOpt = opt.toLowerCase().replace(/[\s:：*_\-()（）]/g, '');
      if (cleanOpt.includes(cleanTarget) || cleanTarget.includes(cleanOpt)) {
        return opt;
      }
    }

    return null;
  }
}

export const optionResolver = new OptionResolver();
