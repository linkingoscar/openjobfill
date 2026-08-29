import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  levenshteinSimilarity,
  jaccardBigramSimilarity,
  calculateSemanticSimilarity,
  FORM_FIELD_SYNONYM_GRAPH,
} from '@/core/matcher/similarityEngine';

describe('SimilarityEngine (语义相似度与混合距离计算引擎)', () => {
  describe('Levenshtein 空间压缩编辑距离', () => {
    it('相同字符串距离应为 0，完全不同字符串距离应正确', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('xyz', '')).toBe(3);
    });

    it('中文编辑距离计算正确', () => {
      expect(levenshteinDistance('毕业院校', '最高学历学校')).toBe(5);
      expect(levenshteinDistance('手机号码', '手机号')).toBe(1);
      expect(levenshteinDistance('期望薪资', '期望薪酬')).toBe(1);
    });

    it('归一化相似度应在 0.0 ~ 1.0 之间', () => {
      expect(levenshteinSimilarity('前端开发', '前端开发')).toBe(1.0);
      expect(levenshteinSimilarity('前端开发', '后端开发')).toBe(0.75);
      expect(levenshteinSimilarity('', '')).toBe(1.0);
    });
  });

  describe('字符级 2-Gram Jaccard 重合度', () => {
    it('完全相同字符串重合度应为 1.0', () => {
      expect(jaccardBigramSimilarity('计算机科学与技术', '计算机科学与技术')).toBe(1.0);
    });

    it('包含关系的字符串应获得极高相似度打分 (>= 0.9)', () => {
      expect(jaccardBigramSimilarity('你的手机号码', '手机号码')).toBeGreaterThanOrEqual(0.9);
      expect(jaccardBigramSimilarity('电子邮箱地址', '电子邮箱')).toBeGreaterThanOrEqual(0.9);
    });

    it('空字符或完全无交集文本相似度应为 0.0', () => {
      expect(jaccardBigramSimilarity('', '姓名')).toBe(0.0);
      expect(jaccardBigramSimilarity('北京', '上海')).toBe(0.0);
    });
  });

  describe('同义词图谱与混合语义打分 (calculateSemanticSimilarity)', () => {
    it('基础信息变体字段应能高置信度命中 (score >= 0.9)', () => {
      // 真实招聘网站上常见的前缀/变体
      expect(calculateSemanticSimilarity('真实姓名 *', 'basics.name')).toBeGreaterThanOrEqual(0.95);
      expect(calculateSemanticSimilarity('常用手机号', 'basics.phone')).toBeGreaterThanOrEqual(0.95);
      expect(calculateSemanticSimilarity('个人邮箱 (E-mail)', 'basics.email')).toBeGreaterThanOrEqual(0.95);
      expect(calculateSemanticSimilarity('身份证号码', 'basics.idCardNumber')).toBeGreaterThanOrEqual(0.95);
      expect(calculateSemanticSimilarity('出生日期', 'basics.birthDate')).toBeGreaterThanOrEqual(0.95);
      expect(calculateSemanticSimilarity('政治面貌(中共党员/预备党员/共青团员/群众)', 'basics.politicalStatus')).toBeGreaterThanOrEqual(0.95);
    });

    it('政企/银行生僻字段应能准确命中', () => {
      expect(calculateSemanticSimilarity('生源地所在地', 'basics.nativePlace.city')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('户口所在地', 'basics.hukouLocation.city')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('常住城市', 'basics.currentLocation.city')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('税前期望薪资', 'basics.expectedSalaryMin')).toBeGreaterThanOrEqual(0.9);
    });

    it('多段经历字段应能准确命中', () => {
      expect(calculateSemanticSimilarity('就读大学/学院', 'educations.0.schoolName')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('主修专业名称', 'educations.0.major')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('学历层次', 'educations.0.degree')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('实习单位/雇主名称', 'experiences.0.company')).toBeGreaterThanOrEqual(0.9);
      expect(calculateSemanticSimilarity('担任职务', 'experiences.0.title')).toBeGreaterThanOrEqual(0.9);
    });

    it('完全无关的字段语义相似度应接近 0', () => {
      expect(calculateSemanticSimilarity('爱好特长', 'basics.phone')).toBeLessThan(0.3);
      expect(calculateSemanticSimilarity('紧急联系人关系', 'basics.idCardNumber')).toBeLessThan(0.3);
    });
  });
});
