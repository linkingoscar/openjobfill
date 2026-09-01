import { describe, expect, it } from 'vitest';
import {
  inferLocationPath,
  inferMajorHierarchy,
  matchDegreeOption,
  normalizeLocationName,
} from '@/core/resolvers/profileNormalizer';

describe('profileNormalizer', () => {
  it('反查教育部专业门类路径', () => {
    expect(inferMajorHierarchy('软件工程专业')).toEqual(['工学', '计算机类', '软件工程']);
    expect(inferMajorHierarchy('金融学')).toEqual(['经济学', '金融学类', '金融学']);
    expect(inferMajorHierarchy('未知交叉学科')).toEqual(['未知交叉学科']);
  });

  it('根据城市补全省市级联路径', () => {
    expect(inferLocationPath('杭州')).toEqual(['浙江省', '杭州市']);
    expect(inferLocationPath('深圳市')).toEqual(['广东省', '深圳市']);
    expect(normalizeLocationName('广西壮族自治区')).toBe('广西');
  });

  it('把标准学历匹配到网站枚举文案', () => {
    expect(matchDegreeOption('硕士', ['请选择', '本科', '硕士研究生'])).toBe('硕士研究生');
    expect(matchDegreeOption('博士', ['本科', '硕士'])).toBeNull();
  });
});
