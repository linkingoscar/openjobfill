import { describe, expect, it } from 'vitest';
import { validateResumeImageFile } from '@/core/importers/resumeImagePreparation';

describe('resumeImagePreparation', () => {
  it('接受常用图片格式并限制体积', () => {
    expect(() => validateResumeImageFile({ type: 'image/jpeg', size: 1024 } as File)).not.toThrow();
    expect(() => validateResumeImageFile({ type: 'application/pdf', size: 1024 } as File)).toThrow('JPG、PNG 或 WebP');
    expect(() => validateResumeImageFile({ type: 'image/png', size: 13 * 1024 * 1024 } as File)).toThrow('12 MB');
  });
});
