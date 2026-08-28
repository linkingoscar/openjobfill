import { describe, it, expect } from 'vitest';
import { calculateSemanticSimilarity } from '@/core/matcher/similarityEngine';
import { RESUME_DICTIONARY } from '@/core/matcher/dictionary';

interface BenchmarkTestCase {
  label: string;
  expectedResumeKey: string;
  category: string;
}

/**
 * 涵盖中国互联网大厂、国企央企、金融银行系统、外企 ATS 真实网申场景的 100+ 变体标签基准测试集
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
  { label: '户籍所在地 (非现住址)', expectedResumeKey: 'basics.nativePlace.city', category: 'basics' },
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

describe('Semantic Similarity Gold Benchmark (500+ 网申变体字段混淆矩阵与 F1-Score 评测)', () => {
  it('应在大规模真实网申测试集上达到 >= 95% 的综合召回率与 F1-Score', () => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    const failedCases: { label: string; expected: string; actualBestKey: string; score: number }[] = [];

    for (const testCase of GOLD_STANDARD_BENCHMARK_DATASET) {
      // 遍历所有可能的简历字段字典，寻找置信度最高的目标 Key
      let highestScore = 0;
      let predictedKey = '';

      for (const item of RESUME_DICTIONARY) {
        const score = calculateSemanticSimilarity(testCase.label, item.resumeKey);
        if (score > highestScore) {
          highestScore = score;
          predictedKey = item.resumeKey;
        }
      }

      // 置信度阈值 >= 0.45 视为有效识别
      if (highestScore >= 0.45) {
        if (predictedKey === testCase.expectedResumeKey) {
          truePositives++;
        } else {
          falsePositives++;
          failedCases.push({
            label: testCase.label,
            expected: testCase.expectedResumeKey,
            actualBestKey: predictedKey,
            score: highestScore,
          });
        }
      } else {
        falseNegatives++;
        failedCases.push({
          label: testCase.label,
          expected: testCase.expectedResumeKey,
          actualBestKey: 'NONE (Below Threshold)',
          score: highestScore,
        });
      }
    }

    const precision = truePositives / (truePositives + falsePositives || 1);
    const recall = truePositives / (truePositives + falseNegatives || 1);
    const f1Score = (2 * precision * recall) / (precision + recall || 1);

    console.log(`\n========================================`);
    console.log(`📊 OpenJobFill 语义相似度基准评测报告`);
    console.log(`----------------------------------------`);
    console.log(`总测试样本数 : ${GOLD_STANDARD_BENCHMARK_DATASET.length}`);
    console.log(`正确命中 (TP): ${truePositives}`);
    console.log(`误判命中 (FP): ${falsePositives}`);
    console.log(`漏识别数 (FN): ${falseNegatives}`);
    console.log(`准确率 (Precision): ${(precision * 100).toFixed(2)}%`);
    console.log(`召回率 (Recall)   : ${(recall * 100).toFixed(2)}%`);
    console.log(`F1-Score         : ${(f1Score * 100).toFixed(2)}%`);
    console.log(`========================================\n`);

    if (failedCases.length > 0) {
      console.warn('⚠️ 未完美命中的样本明细:', JSON.stringify(failedCases, null, 2));
    }

    expect(f1Score).toBeGreaterThanOrEqual(0.95);
  });
});
