import { describe, expect, it } from 'vitest';
import { ADMINISTRATIVE_PROVINCES, findRegionPath } from '@/core/data/regions';
import { inferLocationPath, inferMajorHierarchy, MAJOR_CATALOG } from '@/core/resolvers/profileNormalizer';
import { locationResolver } from '@/core/resolvers/locationResolver';

describe('versioned reference catalogs', () => {
  it('covers all province-level groups and resolves less common districts, direct counties and Taiwan cities', () => {
    expect(ADMINISTRATIVE_PROVINCES).toHaveLength(34);
    expect(ADMINISTRATIVE_PROVINCES.every((province) => province.cities.length > 0)).toBe(true);
    expect(inferLocationPath('西宁市城西区')).toEqual(['青海省', '西宁市', '城西区']);
    expect(inferLocationPath('640104')).toEqual(['宁夏回族自治区', '银川市', '兴庆区']);
    expect(inferLocationPath('济源市')).toEqual(['河南省', '济源市']);
    expect(inferLocationPath('新北市板桥区')).toEqual(['台湾省', '新北市', '板桥区']);
    expect(findRegionPath('朝阳区')).toBeNull();
    expect(findRegionPath('朝阳区', '北京')).toEqual(['北京市', '北京市', '朝阳区']);
  });
  it('does not match a different city merely because it shares the province', () => {
    expect(locationResolver.matchLocationOption(['广东省-广州市', '广东省-深圳市'], '深圳')).toBe('广东省-深圳市');
    expect(locationResolver.normalizeLocation('Shenzhen, Guangdong').city).toBe('深圳市');
    expect(locationResolver.normalizeLocation('青海省西宁市城西区').district).toBe('城西区');
    expect(locationResolver.matchLocationOption(['北京市-朝阳区', '北京市-海淀区'], '北京市海淀区')).toBe('北京市-海淀区');
    expect(locationResolver.matchLocationOption(['北京市-朝阳区'], '北京市海淀区')).toBeNull();
  });
  it('includes every 2026 undergraduate major, seven-digit codes and the new interdisciplinary ownership', () => {
    expect(Object.keys(MAJOR_CATALOG.categories)).toHaveLength(13);
    expect(Object.keys(MAJOR_CATALOG.classes)).toHaveLength(92);
    expect(MAJOR_CATALOG.majors).toHaveLength(883);
    expect(new Set(MAJOR_CATALOG.majors.map((major) => major.code)).size).toBe(883);
    expect(inferMajorHierarchy('0502107TK')).toEqual(['文学', '外国语言文学类', '语言智能']);
    expect(inferMajorHierarchy('具身智能')).toEqual(['交叉学科', '具身智能']);
    expect(inferMajorHierarchy('软件工程')).toEqual(['工学', '计算机类', '软件工程']);
    expect(inferMajorHierarchy('人工智能')).toEqual(['工学', '电子信息类', '人工智能']);
    expect(inferMajorHierarchy('金融')).toEqual(['金融']);
  });
});
