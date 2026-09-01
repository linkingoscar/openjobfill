import { computed, ref, type Ref } from 'vue';
import {
  calculateFloatingBallLayout,
  clampFloatingBallPosition,
  getResponsiveDrawerHeight,
  getResponsiveDrawerWidth,
  type FloatingBallPosition,
} from '@/core/ui/floatingBallPosition';

const FLOATING_POSITION_KEY = 'openjobfill_floating_ball_position';

/** 悬浮球位置、拖拽和抽屉尺寸的唯一状态边界。 */
export function useFloatingPosition(isDrawerOpen: Ref<boolean>, isDisabled?: Ref<boolean>) {
  const viewportWidth = ref(window.innerWidth);
  const viewportHeight = ref(window.innerHeight);
  const floatingPosition = ref<FloatingBallPosition>(clampFloatingBallPosition(
    { x: window.innerWidth, bottom: 96 },
    window.innerWidth,
    window.innerHeight,
  ));
  const savedDrawerWidth = Number(localStorage.getItem('openjobfill_drawer_width'));
  const drawerWidth = ref(Number.isFinite(savedDrawerWidth)
    ? Math.max(320, Math.min(680, savedDrawerWidth))
    : 384);
  const drawerHeight = ref(Number(localStorage.getItem('openjobfill_drawer_height')) || 620);

  let isDraggingBall = false;
  let dragMoved = false;
  const suppressNextBubbleClick = ref(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPosition: FloatingBallPosition = { ...floatingPosition.value };
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let initialWidth = 384;
  let initialHeight = 620;
  let resizeHorizontalDirection = -1;

  const loadFloatingPosition = () => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.get([FLOATING_POSITION_KEY], (result) => {
      const saved = result[FLOATING_POSITION_KEY] as Partial<FloatingBallPosition> | undefined;
      if (typeof saved?.x !== 'number' || typeof saved?.bottom !== 'number') return;
      floatingPosition.value = clampFloatingBallPosition(
        { x: saved.x, bottom: saved.bottom },
        viewportWidth.value,
        viewportHeight.value,
      );
    });
  };

  const saveFloatingPosition = () => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.set({ [FLOATING_POSITION_KEY]: floatingPosition.value });
  };

  const handleViewportResize = () => {
    viewportWidth.value = window.innerWidth;
    viewportHeight.value = window.innerHeight;
    floatingPosition.value = clampFloatingBallPosition(
      floatingPosition.value,
      viewportWidth.value,
      viewportHeight.value,
    );
  };

  const stopBallDrag = () => {
    if (!isDraggingBall) return;
    isDraggingBall = false;
    window.removeEventListener('pointermove', handleBallDragMove);
    window.removeEventListener('pointerup', stopBallDrag);
    window.removeEventListener('pointercancel', stopBallDrag);
    if (dragMoved) {
      suppressNextBubbleClick.value = true;
      saveFloatingPosition();
      window.setTimeout(() => { suppressNextBubbleClick.value = false; }, 0);
    }
  };

  const handleBallDragMove = (event: PointerEvent) => {
    if (!isDraggingBall) return;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    if (!dragMoved && Math.hypot(deltaX, deltaY) < 5) return;
    dragMoved = true;
    floatingPosition.value = clampFloatingBallPosition({
      x: dragStartPosition.x + deltaX,
      bottom: dragStartPosition.bottom - deltaY,
    }, viewportWidth.value, viewportHeight.value);
  };

  const startBallDrag = (event: PointerEvent) => {
    if (event.button !== 0 || isDisabled?.value) return;
    isDraggingBall = true;
    dragMoved = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartPosition = { ...floatingPosition.value };
    window.addEventListener('pointermove', handleBallDragMove);
    window.addEventListener('pointerup', stopBallDrag);
    window.addEventListener('pointercancel', stopBallDrag);
  };

  const responsiveDrawerWidth = computed(() => getResponsiveDrawerWidth(
    drawerWidth.value,
    viewportWidth.value,
  ));
  const responsiveDrawerHeight = computed(() => getResponsiveDrawerHeight(
    drawerHeight.value,
    viewportHeight.value,
    floatingPosition.value.bottom,
  ));
  const floatingLayout = computed(() => calculateFloatingBallLayout(
    floatingPosition.value,
    viewportWidth.value,
    isDrawerOpen.value,
    responsiveDrawerWidth.value,
  ));
  const floatingRootStyle = computed(() => ({
    left: `${floatingLayout.value.left}px`,
    bottom: `${floatingLayout.value.bottom}px`,
  }));

  const startResize = (event: MouseEvent) => {
    isResizing = true;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    initialWidth = drawerWidth.value;
    initialHeight = drawerHeight.value;
    resizeHorizontalDirection = floatingLayout.value.opensLeft ? -1 : 1;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', stopResize);
    event.preventDefault();
  };

  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = (event.clientX - resizeStartX) * resizeHorizontalDirection;
    const deltaY = resizeStartY - event.clientY;
    drawerWidth.value = Math.max(320, Math.min(680, initialWidth + deltaX));
    drawerHeight.value = Math.max(400, Math.min(window.innerHeight - 80, initialHeight + deltaY));
  };

  const stopResize = () => {
    if (!isResizing) return;
    isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', stopResize);
    localStorage.setItem('openjobfill_drawer_width', String(drawerWidth.value));
    localStorage.setItem('openjobfill_drawer_height', String(drawerHeight.value));
  };

  const cleanup = () => {
    stopBallDrag();
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', stopResize);
  };

  return {
    viewportWidth,
    viewportHeight,
    floatingPosition,
    drawerWidth,
    responsiveDrawerWidth,
    drawerHeight,
    responsiveDrawerHeight,
    floatingLayout,
    floatingRootStyle,
    loadFloatingPosition,
    handleViewportResize,
    startBallDrag,
    stopBallDrag,
    startResize,
    handleResizeMove,
    stopResize,
    cleanup,
    suppressNextBubbleClick,
    clearSuppressNextBubbleClick: () => { suppressNextBubbleClick.value = false; },
  };
}
