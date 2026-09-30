import { describe, expect, it } from 'vitest';
import { validateResumeImageFile } from '@/core/importers/resumeImagePreparation';

describe('resumeImagePreparation', () => {
  it('接受常用图片格式并限制体积', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(() => validateResumeImageFile({ type, size: 12 * 1024 * 1024 })).not.toThrow();
    }
    expect(() => validateResumeImageFile({ type: 'application/pdf', size: 1024 })).toThrow('JPG、PNG 或 WebP');
    expect(() => validateResumeImageFile({ type: 'image/png', size: 0 })).toThrow('图片文件为空');
    expect(() => validateResumeImageFile({ type: 'image/png', size: 12 * 1024 * 1024 + 1 })).toThrow('12 MB');
  });
});
