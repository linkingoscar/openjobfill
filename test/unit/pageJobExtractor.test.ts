import { describe, expect, it } from 'vitest';
import { extractPageJobSnapshot, isApplicationSuccessPage } from '../../src/core/tracker/pageJobExtractor';

describe('page job extractor', () => {
  it('优先读取语义明确的岗位、公司、薪资和 JD 节点', () => {
    document.title = '前端开发工程师 - 示例科技';
    document.body.innerHTML = `
      <main>
        <div class="company-name">示例科技</div>
        <h1 class="job-title">高级前端开发工程师</h1>
        <div class="job-salary">25K-35K · 15薪</div>
        <div class="job-city">上海</div>
        <div class="job-description">负责招聘平台前端架构和工程化建设，推动性能与体验持续优化。</div>
      </main>`;

    const snapshot = extractPageJobSnapshot(document, new URL('https://jobs.example.com/123') as unknown as Location);
    expect(snapshot).toMatchObject({
      companyName: '示例科技',
      jobTitle: '高级前端开发工程师',
      salary: '25K-35K · 15薪',
      city: '上海',
      jobUrl: 'https://jobs.example.com/123',
    });
    expect(snapshot.description).toContain('工程化');
  });

  it('识别明确的申请成功页，但不把普通岗位页误判为成功', () => {
    document.body.innerHTML = '<main><h1>申请成功</h1><p>感谢您的申请，我们会尽快与您联系。</p></main>';
    expect(isApplicationSuccessPage(document, new URL('https://jobs.example.com/apply/result') as unknown as Location)).toBe(true);

    document.body.innerHTML = '<main><h1>高级前端开发工程师</h1><p>欢迎投递简历。</p></main>';
    expect(isApplicationSuccessPage(document, new URL('https://jobs.example.com/jobs/123') as unknown as Location)).toBe(false);
  });

  it('优先使用 JSON-LD JobPosting，并记录字段来源', () => {
    document.title = '错误标题 - 错误公司';
    document.body.innerHTML = `
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: '高级产品经理',
        hiringOrganization: { '@type': 'Organization', name: '结构化科技' },
        jobLocation: { address: { addressRegion: '上海市', addressLocality: '浦东新区' } },
        description: '<p>负责产品规划与用户研究</p>',
        baseSalary: { currency: 'CNY', value: { minValue: 25000, maxValue: 35000, unitText: 'MONTH' } },
      })}</script>
      <h1>错误岗位</h1>`;
    const snapshot = extractPageJobSnapshot(document, new URL('https://jobs.example.com/pm') as unknown as Location);
    expect(snapshot).toMatchObject({
      companyName: '结构化科技', jobTitle: '高级产品经理', city: '上海市 浦东新区',
      salary: '25000-35000 MONTH', description: '负责产品规划与用户研究',
    });
    expect(snapshot.fieldSources).toMatchObject({ companyName: 'structured_data', jobTitle: 'structured_data' });
  });
});
