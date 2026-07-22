import { mmToPx, type Viewport } from '../../../core/machine/coordinates';
import { pointsDrawnSoFar, type SimulationTimeline } from '../../../core/simulator/SimulationEngine';
import type { Point } from '../../../core/model/types';

function strokePolyline(ctx: CanvasRenderingContext2D, viewport: Viewport, points: Point[]) {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = mmToPx(points[0], viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = mmToPx(points[i], viewport);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/**
 * Renders the timeline up to currentTimeMs: fully-elapsed segments solid,
 * the in-progress segment drawn partially, later segments not drawn at all.
 * The pen never lifts on this gantry, so travel segments are real ink too --
 * rendered solid (just a neutral, thinner line) rather than dashed, since a
 * dashed line would wrongly suggest they don't actually appear on paper.
 */
export function drawSimulationProgress(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  timeline: SimulationTimeline,
  currentTimeMs: number,
  penColor: string,
  travelColor: string,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const segment of timeline.segments) {
    if (segment.startTimeMs > currentTimeMs) break;

    const isTravel = segment.mode === 'travel';
    ctx.strokeStyle = isTravel ? travelColor : penColor;
    ctx.lineWidth = isTravel ? 1 : 1.5;

    if (segment.endTimeMs <= currentTimeMs) {
      strokePolyline(ctx, viewport, segment.points);
    } else {
      strokePolyline(ctx, viewport, pointsDrawnSoFar(segment, currentTimeMs));
    }
  }

  ctx.restore();
}
