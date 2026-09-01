export interface FloatingBallPosition {
  x: number;
  bottom: number;
}

export interface FloatingBallLayout {
  left: number;
  bottom: number;
  opensLeft: boolean;
}

const EDGE_GAP = 8;
const CONTROL_WIDTH = 74;
const CONTROL_HEIGHT = 80;
const DRAWER_GAP = 12;
const MIN_DRAWER_WIDTH = 160;
const MIN_DRAWER_HEIGHT = 160;

/**
 * 计算小屏上实际渲染的抽屉宽度。
 * 抽屉不是页面唯一控件，还要给悬浮球、两者间距和左右安全边距留出空间。
 * requestedWidth 仍保留用户在桌面端的设置，视口变宽后会自动恢复。
 */
export function getResponsiveDrawerWidth(requestedWidth: number, viewportWidth: number): number {
  const requested = Number.isFinite(requestedWidth) ? requestedWidth : 384;
  const maxForViewport = Math.max(
    MIN_DRAWER_WIDTH,
    viewportWidth - CONTROL_WIDTH - DRAWER_GAP - EDGE_GAP * 2,
  );
  return Math.min(Math.max(MIN_DRAWER_WIDTH, requested), maxForViewport);
}

/** 根据悬浮球底部偏移计算抽屉在当前视口中可用的最大高度。 */
export function getResponsiveDrawerHeight(
  requestedHeight: number,
  viewportHeight: number,
  bottomOffset: number,
): number {
  const requested = Number.isFinite(requestedHeight) ? requestedHeight : 620;
  const available = Math.max(MIN_DRAWER_HEIGHT, viewportHeight - Math.max(0, bottomOffset) - EDGE_GAP);
  return Math.min(Math.max(MIN_DRAWER_HEIGHT, requested), available);
}

export function clampFloatingBallPosition(
  position: FloatingBallPosition,
  viewportWidth: number,
  viewportHeight: number,
): FloatingBallPosition {
  const maxX = Math.max(EDGE_GAP, viewportWidth - CONTROL_WIDTH - EDGE_GAP);
  const maxBottom = Math.max(EDGE_GAP, viewportHeight - CONTROL_HEIGHT - EDGE_GAP);
  return {
    x: Math.min(maxX, Math.max(EDGE_GAP, position.x)),
    bottom: Math.min(maxBottom, Math.max(EDGE_GAP, position.bottom)),
  };
}

export function calculateFloatingBallLayout(
  position: FloatingBallPosition,
  viewportWidth: number,
  drawerOpen: boolean,
  drawerWidth: number,
): FloatingBallLayout {
  const spaceLeft = position.x - EDGE_GAP;
  const spaceRight = viewportWidth - position.x - CONTROL_WIDTH - EDGE_GAP;
  const opensLeft = spaceLeft >= drawerWidth + DRAWER_GAP || spaceLeft >= spaceRight;
  if (!drawerOpen) return { left: position.x, bottom: position.bottom, opensLeft };

  const totalWidth = drawerWidth + DRAWER_GAP + CONTROL_WIDTH;
  const desiredLeft = opensLeft ? position.x - drawerWidth - DRAWER_GAP : position.x;
  return {
    left: Math.min(Math.max(EDGE_GAP, desiredLeft), Math.max(EDGE_GAP, viewportWidth - totalWidth - EDGE_GAP)),
    bottom: position.bottom,
    opensLeft,
  };
}
