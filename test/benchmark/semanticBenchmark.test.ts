import { describe, it, expect } from 'vitest';
import { calculateSemanticSimilarity } from '@/core/matcher/similarityEngine';
import { RESUME_DICTIONARY } from '@/core/matcher/dictionary';

interface BenchmarkTestCase {
  label: string;
  expectedResumeKey: string;
  category: string;
}

/**
 * 当前为 38 个脱敏网申标签的回归集。它用于保护词典变更，不代表真实站点总体准确率；
 * 真实站点留出集应在取得脱敏样本后单独维护，避免把词典开发样本当成泛化评测。
 */
const GOLD_STANDARD_BENCHMARK_DATASET: BenchmarkTestCase[] = [
  // 1. 基础信息类
  { label: '真实姓名 *', expectedResumeKey: 'basics.name', category: 'basics' },
  { label: '应聘者中文姓名', expectedResumeKey: 'basics.name', category: 'basics' },
  { label: 'Applicant Name', expectedResumeKey: 'basics.name', category: 'basics' },
  { label: 'Full Name', expectedResumeKey: 'basics.name', category: 'basics' },
  { label: '手机号码 (用于接收面试通知)', expectedResumeKey: 'basics.phone', category: 'basics' },
  { label: '常用联系电话', expectedResumeKey: 'basics.phone', category: 'basics' },
  { label: 'Mobile Phone', expectedResumeKey: 'basics.phone', category: 'basics' },
  { label: '常用电子邮箱 (请勿填写QQ邮箱)', expectedResumeKey: 'basics.email', category: 'basics' },
  { label: 'E-mail Address', expectedResumeKey: 'basics.email', category: 'basics' },
  { label: '居民身份证号码 (18位)', expectedResumeKey: 'basics.idCardNumber', category: 'basics' },
  { label: '证件号码 (大陆居民身份证)', expectedResumeKey: 'basics.idCardNumber', category: 'basics' },
  { label: '出生年月日 (YYYY-MM-DD)', expectedResumeKey: 'basics.birthDate', category: 'basics' },
  { label: '生理性别', expectedResumeKey: 'basics.gender', category: 'basics' },
  { label: '政治面貌 (中共党员/共青团员/群众)', expectedResumeKey: 'basics.politicalStatus', category: 'basics' },
  { label: '民族类别', expectedResumeKey: 'basics.ethnicity', category: 'basics' },
  { label: '生源地所在省市', expectedResumeKey: 'basics.nativePlace.city', category: 'basics' },
  { label: '户籍所在地 (非现住址)', expectedResumeKey: 'basics.hukouLocation.city', category: 'basics' },
  { label: '目前常住城市', expectedResumeKey: 'basics.currentLocation.city', category: 'basics' },
  { label: '税前期望月薪 (元/月)', expectedResumeKey: 'basics.expectedSalaryMin', category: 'basics' },
  { label: '意向应聘岗位', expectedResumeKey: 'basics.expectedRole', category: 'basics' },
  { label: '自我评价与核心优势自述', expectedResumeKey: 'basics.selfEvaluation', category: 'basics' },

  // 2. 教育背景经历
  { label: '最高学历就读大学全称', expectedResumeKey: 'educations.0.schoolName', category: 'education' },
  { label: '本科就读学校 (全称)', expectedResumeKey: 'educations.0.schoolName', category: 'education' },
  { label: 'University / College', expectedResumeKey: 'educations.0.schoolName', category: 'education' },
  { label: '所学专业名称', expectedResumeKey: 'educations.0.major', category: 'education' },
  { label: '主修学科专业', expectedResumeKey: 'educations.0.major', category: 'education' },
  { label: 'Academic Major', expectedResumeKey: 'educations.0.major', category: 'education' },
  { label: '学历层次 (本科/硕士/博士)', expectedResumeKey: 'educations.0.degree', category: 'education' },
  { label: '最高学历学位', expectedResumeKey: 'educations.0.degree', category: 'education' },
  { label: '平均学分绩点 (GPA/成绩排名)', expectedResumeKey: 'educations.0.gpa', category: 'education' },
  { label: 'Grade Point Average (GPA)', expectedResumeKey: 'educations.0.gpa', category: 'education' },

  // 3. 工作与实习经历
  { label: '前雇主/实习单位名称', expectedResumeKey: 'experiences.0.company', category: 'experience' },
  { label: '最近就职企业全称', expectedResumeKey: 'experiences.0.company', category: 'experience' },
  { label: 'Company / Employer Name', expectedResumeKey: 'experiences.0.company', category: 'experience' },
  { label: '担任职位/岗位名称', expectedResumeKey: 'experiences.0.title', category: 'experience' },
  { label: 'Job Title / Position', expectedResumeKey: 'experiences.0.title', category: 'experience' },

  // 4. 项目经历
  { label: '主要核心项目名称', expectedResumeKey: 'projects.0.projectName', category: 'project' },
  { label: 'Project Name / Title', expectedResumeKey: 'projects.0.projectName', category: 'project' },
];

describe('Semantic label regression corpus (not a population accuracy estimate)', () => {
  it('preserves the correct top-ranked key for every one of the 38 named labels', () => {
    for (const sample of GOLD_STANDARD_BENCHMARK_DATASET) {
      const ranked = RESUME_DICTIONARY.map(item => ({ key: item.resumeKey, score: calculateSemanticSimilarity(sample.label, item.resumeKey) })).sort((a, b) => b.score - a.score);
      expect(ranked[0].key, sample.label).toBe(sample.expectedResumeKey);
      expect(ranked[0].score, sample.label).toBeGreaterThanOrEqual(0.45);
    }
  });
});
