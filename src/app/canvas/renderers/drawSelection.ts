import { mmToPx, type Viewport } from '../../../core/machine/coordinates';
import type { Bounds } from '../../../core/model/geometry';

const HANDLE_SIZE_PX = 8;

export function drawSelectionOverlay(ctx: CanvasRenderingContext2D, viewport: Viewport, bbox: Bounds): void {
  const topLeft = mmToPx({ x: bbox.minX, y: bbox.minY }, viewport);
  const bottomRight = mmToPx({ x: bbox.maxX, y: bbox.maxY }, viewport);

  ctx.save();
  ctx.strokeStyle = '#d65f2b';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.setLineDash([]);

  const corners = [
    topLeft,
    { x: bottomRight.x, y: topLeft.y },
    { x: topLeft.x, y: bottomRight.y },
    bottomRight,
  ];
  for (const c of corners) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c.x - HANDLE_SIZE_PX / 2, c.y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
    ctx.strokeStyle = '#d65f2b';
    ctx.strokeRect(c.x - HANDLE_SIZE_PX / 2, c.y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
  }
  ctx.restore();
}
