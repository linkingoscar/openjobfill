import { describe, expect, it } from 'vitest';
import { extractPageJobSnapshot } from '../../src/core/tracker/pageJobExtractor';

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
});

