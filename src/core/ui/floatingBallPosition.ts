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
