import { describe, expect, it } from 'vitest';
import { selectCrossOriginFrameRoots } from '@/core/frames/frameCoordinator';

describe('跨域 frame 边界选择', () => {
  it('只选择跨源边界根节点，同源后代交给父 frame 递归扫描', () => {
    const result = selectCrossOriginFrameRoots([
      { frameId: 0, parentFrameId: -1, url: 'https://portal.example/apply' },
      { frameId: 1, parentFrameId: 0, url: 'https://portal.example/form' },
      { frameId: 2, parentFrameId: 0, url: 'https://ats.vendor.test/form' },
      { frameId: 3, parentFrameId: 2, url: 'https://ats.vendor.test/details' },
      { frameId: 4, parentFrameId: 2, url: 'https://uploads.vendor-cdn.test/widget' },
      { frameId: 5, parentFrameId: 0, url: 'about:blank' },
    ]);

    expect(result).toEqual([
      { frameId: 2, url: 'https://ats.vendor.test/form' },
      { frameId: 4, url: 'https://uploads.vendor-cdn.test/widget' },
    ]);
  });
});
