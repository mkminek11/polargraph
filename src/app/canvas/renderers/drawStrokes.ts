import { mmToPx, type Viewport } from '../../../core/machine/coordinates';
import type { ImageArt, Point } from '../../../core/model/types';

function pathFromPoints(ctx: CanvasRenderingContext2D, points: Point[], viewport: Viewport) {
  if (points.length === 0) return;
  const first = mmToPx(points[0], viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = mmToPx(points[i], viewport);
    ctx.lineTo(p.x, p.y);
  }
}

/** Draws the art's strokes: draw-strokes solid in the art's pen color, travel-strokes solid but neutral. */
export function drawStrokes(ctx: CanvasRenderingContext2D, viewport: Viewport, art: ImageArt): void {
  for (const stroke of art.strokes) {
    if (stroke.points.length === 0) continue;

    // Zero-length 2-point stroke = a dot: render as a filled circle.
    const isDot =
      stroke.points.length === 2 && stroke.points[0].x === stroke.points[1].x && stroke.points[0].y === stroke.points[1].y;

    if (isDot && stroke.mode === 'draw') {
      const center = mmToPx(stroke.points[0], viewport);
      const radiusPx = Math.max(0.5, (art.strokeWidthMm / 2) * viewport.zoom);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = art.penColor;
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    pathFromPoints(ctx, stroke.points, viewport);
    if (stroke.closed) ctx.closePath();

    ctx.strokeStyle = art.penColor;
    ctx.lineWidth = Math.max(0.75, art.strokeWidthMm * viewport.zoom);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
