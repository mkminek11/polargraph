import { mmToPx, type Viewport } from '../../../core/machine/coordinates';
import type { Point } from '../../../core/model/types';

export function drawPen(ctx: CanvasRenderingContext2D, viewport: Viewport, position: Point, color: string): void {
  const px = mmToPx(position, viewport);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
  ctx.stroke();

  const crossSize = 9;
  ctx.beginPath();
  ctx.moveTo(px.x - crossSize, px.y);
  ctx.lineTo(px.x + crossSize, px.y);
  ctx.moveTo(px.x, px.y - crossSize);
  ctx.lineTo(px.x, px.y + crossSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px.x, px.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
