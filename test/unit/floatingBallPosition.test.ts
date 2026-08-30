import { describe, expect, it } from 'vitest';
import { calculateFloatingBallLayout, clampFloatingBallPosition } from '@/core/ui/floatingBallPosition';

describe('悬浮球位置计算', () => {
  it('拖动后应始终把悬浮球限制在可视区域内', () => {
    expect(clampFloatingBallPosition({ x: -200, bottom: -50 }, 1200, 800)).toEqual({ x: 8, bottom: 8 });
    expect(clampFloatingBallPosition({ x: 5000, bottom: 5000 }, 1200, 800)).toEqual({ x: 1118, bottom: 712 });
  });

  it('右侧悬浮球的面板应向左展开并保持在屏幕内', () => {
    const layout = calculateFloatingBallLayout({ x: 1100, bottom: 96 }, 1200, true, 384);
    expect(layout.opensLeft).toBe(true);
    expect(layout.left).toBe(704);
    expect(layout.bottom).toBe(96);
  });

  it('左侧悬浮球的面板应优先向右展开', () => {
    const layout = calculateFloatingBallLayout({ x: 20, bottom: 40 }, 1200, true, 384);
    expect(layout.opensLeft).toBe(false);
    expect(layout.left).toBe(20);
  });
});
