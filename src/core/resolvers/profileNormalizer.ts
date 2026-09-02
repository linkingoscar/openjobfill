/**
 * 招聘表单常见枚举与级联值的归一化工具。
 * 数据表来自旧版 OpenJobFill_Plugin，并收敛为无 DOM 依赖的纯函数。
 */

import { ADMINISTRATIVE_PROVINCES, findRegionPath, normalizeRegionName } from '../data/regions';
import majors from '../data/undergraduate-majors-2026.json';

export const PROVINCE_CITY_MAP: Record<string, string[]> = Object.fromEntries(
  ADMINISTRATIVE_PROVINCES.map((province) => [province.name, [...new Set(province.cities.map((city) => city.name))]]),
);
export const MAJOR_CATALOG = majors;

export interface MajorCategory {
  category: string;
  subCategory: string;
  majors: string[];
}

export const MAJOR_CATEGORY_TREE: MajorCategory[] = Object.values(majors.majors.reduce<Record<string, MajorCategory>>((groups, major) => {
  const key = major.category + '/' + major.subCategory;
  groups[key] ||= { category: major.category, subCategory: major.subCategory, majors: [] };
  groups[key].majors.push(major.name);
  return groups;
}, {}));

export function inferMajorHierarchy(majorName: string): string[] {
  const cleanMajor = majorName.trim().replace(/专业$/, '');
  if (!cleanMajor) return [];
  const exact = majors.majors.find((entry) => entry.name === cleanMajor || entry.code === cleanMajor);
  if (exact) return [exact.category, exact.subCategory, exact.name].filter(Boolean);
  // Only expand an unambiguous sufficiently long name; short prefixes such as 金融 must not select 金融学 blindly.
  const candidates = cleanMajor.length >= 4 ? majors.majors.filter((entry) => cleanMajor.includes(entry.name)) : [];
  candidates.sort((a, b) => b.name.length - a.name.length);
  if (candidates.length && (candidates.length === 1 || candidates[0].name.length > candidates[1].name.length)) {
    const match = candidates[0];
    return [match.category, match.subCategory, match.name].filter(Boolean);
  }
  return [cleanMajor];
}

export function normalizeLocationName(name: string): string {
  return normalizeRegionName(name);
}

export function inferLocationPath(cityName: string, provinceName?: string): string[] {
  if (!cityName.trim()) return [];
  return findRegionPath(cityName, provinceName) || (provinceName ? [provinceName, cityName] : [cityName]);
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
