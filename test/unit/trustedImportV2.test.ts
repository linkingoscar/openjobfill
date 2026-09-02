import { describe, expect, it } from 'vitest';
import { buildTrustedImportReview } from '@/core/importers/trustedImport';
import { parseVisionResumeResponse } from '@/core/importers/visionResumeImporter';

describe('trusted import AI document v2', () => {
  it('starts AI-only imports from a blank trusted seed and accepts only evidence-backed confident facts', () => {
    const aiResume = parseVisionResumeResponse(JSON.stringify({
      candidates: [
        { path: 'basics.name', value: '张三', confidence: 0.97, evidence: { page: 1, quote: '姓名 张三' } },
        { path: 'basics.phone', value: '13800138000', confidence: 0.96 },
        { path: 'basics.expectedRole', value: '前端工程师', confidence: 0.62, evidence: { page: 1, quote: '求职意向 前端工程师' } },
      ],
      warnings: [],
    }), 'scan.pdf');

    const review = buildTrustedImportReview({ aiResume, fileName: 'scan.pdf', now: 1000 });
    expect(review.resume.basics.name).toBe('张三');
    expect(review.resume.basics.phone).toBe('');
    expect(review.resume.basics.expectedRole).toBe('');
    expect(review.acceptedPaths).toContain('basics.name');
    expect(review.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'basics.phone', reason: 'no-evidence' }),
      expect.objectContaining({ path: 'basics.expectedRole', reason: 'low-confidence' }),
    ]));
  });

  it('drops fabricated unpaged quotes when local document text does not contain them', () => {
    const aiResume = parseVisionResumeResponse(JSON.stringify({
      candidates: [
        { path: 'basics.email', value: 'candidate@example.com', confidence: 0.98, evidence: { quote: 'candidate@example.com' } },
      ],
      warnings: [],
    }), 'resume.docx');

    const review = buildTrustedImportReview({
      aiResume,
      documentText: '这份本地提取文本没有邮箱地址',
      fileName: 'resume.docx',
      now: 1000,
    });
    expect(review.resume.basics.email).toBe('');
    expect(review.conflicts).toContainEqual(expect.objectContaining({ path: 'basics.email', reason: 'no-evidence' }));
  });
});
