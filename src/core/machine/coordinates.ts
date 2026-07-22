import type { Point } from '../model/types';

/** Screen-space view transform: pixels-per-mm zoom plus a pan offset in pixels. */
export interface Viewport {
  panX: number;
  panY: number;
  zoom: number; // px per mm
}

/** Convert a world/machine point (mm) to screen pixel coordinates. */
export function mmToPx(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.panX,
    y: point.y * viewport.zoom + viewport.panY,
  };
}

/** Convert a screen pixel coordinate back to world/machine mm space. */
export function pxToMm(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.panX) / viewport.zoom,
    y: (point.y - viewport.panY) / viewport.zoom,
  };
}

/** A viewport that fits a canvasWidthMm x canvasHeightMm area inside a pixel viewport, centered, with margin. */
export function fitViewport(
  canvasWidthMm: number,
  canvasHeightMm: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  marginPx = 32,
): Viewport {
  const availWidth = Math.max(viewportWidthPx - marginPx * 2, 1);
  const availHeight = Math.max(viewportHeightPx - marginPx * 2, 1);
  const zoom = Math.min(availWidth / canvasWidthMm, availHeight / canvasHeightMm);
  const contentWidthPx = canvasWidthMm * zoom;
  const contentHeightPx = canvasHeightMm * zoom;
  const panX = (viewportWidthPx - contentWidthPx) / 2;
  const panY = (viewportHeightPx - contentHeightPx) / 2;
  return { panX, panY, zoom };
}
