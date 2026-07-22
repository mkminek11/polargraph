import { createId } from '../model/id';
import type { Point, Stroke } from '../model/types';
import { sampleBilinear, toGrayscale } from './grayscale';

export interface HatchingParams {
  spacingPx: number;
  darkThreshold: number; // 0..1, pixels darker than this get inked
  angleDeg: number;
}

/**
 * Classic engraving-style hatching: a family of parallel scan lines: each
 * contiguous dark run along a line becomes one straight draw stroke.
 * Returned points are in source-image pixel space (not yet mm).
 */
export function traceHatching(imageData: ImageData, params: HatchingParams): Stroke[] {
  const { width, height } = imageData;
  const gray = toGrayscale(imageData);
  const strokes: Stroke[] = [];

  const angleRad = (params.angleDeg * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);
  const normalX = -dirY;
  const normalY = dirX;

  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];

  let minOffset = Infinity;
  let maxOffset = -Infinity;
  for (const [cx, cy] of corners) {
    const proj = cx * normalX + cy * normalY;
    minOffset = Math.min(minOffset, proj);
    maxOffset = Math.max(maxOffset, proj);
  }

  const stepPx = 1;
  const spacing = Math.max(1, params.spacingPx);

  for (let offset = minOffset; offset <= maxOffset; offset += spacing) {
    const centerX = offset * normalX;
    const centerY = offset * normalY;

    let minT = Infinity;
    let maxT = -Infinity;
    for (const [cx, cy] of corners) {
      const t = (cx - centerX) * dirX + (cy - centerY) * dirY;
      minT = Math.min(minT, t);
      maxT = Math.max(maxT, t);
    }

    let runStart: Point | null = null;
    let lastPoint: Point | null = null;

    for (let t = minT; t <= maxT; t += stepPx) {
      const x = centerX + t * dirX;
      const y = centerY + t * dirY;
      const inside = x >= 0 && x < width - 1 && y >= 0 && y < height - 1;
      const brightness = inside ? sampleBilinear(gray, width, height, x, y) : 1;
      const dark = inside && brightness < params.darkThreshold;
      const point = { x, y };

      if (dark && !runStart) runStart = point;
      if (!dark && runStart) {
        strokes.push({ id: createId('stroke'), mode: 'draw', points: [runStart, lastPoint ?? point] });
        runStart = null;
      }
      lastPoint = point;
    }
    if (runStart && lastPoint) {
      strokes.push({ id: createId('stroke'), mode: 'draw', points: [runStart, lastPoint] });
    }
  }

  return strokes;
}
