import { mmToPx, type Viewport } from '../../../core/machine/coordinates';
import type { MachineProfile, Point } from '../../../core/model/types';

const PULLEY_RADIUS_PX = 8;
const DASH_PATTERN_MM: [number, number] = [5, 5];

export interface CableMotionState {
  leftAngleRad: number;
  rightAngleRad: number;
  leftDashOffsetMm: number;
  rightDashOffsetMm: number;
}

function drawCable(ctx: CanvasRenderingContext2D, viewport: Viewport, anchor: Point, pen: Point, dashOffsetMm: number) {
  const anchorPx = mmToPx(anchor, viewport);
  const penPx = mmToPx(pen, viewport);
  const dashPx: [number, number] = [DASH_PATTERN_MM[0] * viewport.zoom, DASH_PATTERN_MM[1] * viewport.zoom];

  ctx.save();
  ctx.strokeStyle = '#8a8c85';
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dashPx);
  ctx.lineDashOffset = dashOffsetMm * viewport.zoom;
  ctx.beginPath();
  ctx.moveTo(anchorPx.x, anchorPx.y);
  ctx.lineTo(penPx.x, penPx.y);
  ctx.stroke();
  ctx.restore();
}

function drawPulley(ctx: CanvasRenderingContext2D, anchorPx: Point, angleRad: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(anchorPx.x, anchorPx.y, PULLEY_RADIUS_PX, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#6b6d66';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Spokes rotate with the pulley so its motion is visible, not just the cable dashes.
  ctx.translate(anchorPx.x, anchorPx.y);
  ctx.rotate(angleRad);
  ctx.strokeStyle = '#6b6d66';
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 3; i++) {
    const spokeAngle = (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(spokeAngle) * PULLEY_RADIUS_PX * 0.8, Math.sin(spokeAngle) * PULLEY_RADIUS_PX * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(anchorPx.x, anchorPx.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#6b6d66';
  ctx.fill();
  ctx.restore();
}

/** Draws the two motor pulleys (rotating as cord feeds through) and the dashed, animated cables running to the gondola. */
export function drawCablesAndPulleys(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  profile: MachineProfile,
  gondolaPosition: Point,
  motion: CableMotionState,
): void {
  drawCable(ctx, viewport, profile.motorLeft, gondolaPosition, motion.leftDashOffsetMm);
  drawCable(ctx, viewport, profile.motorRight, gondolaPosition, motion.rightDashOffsetMm);

  drawPulley(ctx, mmToPx(profile.motorLeft, viewport), motion.leftAngleRad);
  drawPulley(ctx, mmToPx(profile.motorRight, viewport), motion.rightAngleRad);
}
