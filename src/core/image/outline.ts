import { createId } from '../model/id';
import type { Point, Stroke } from '../model/types';
import { boxBlur, toGrayscale } from './grayscale';

export interface OutlineParams {
  threshold: number; // 0..1, isovalue traced through the (blurred) grayscale field
  blur: number; // box-blur radius in px, 0 = none
}

type Edge = 0 | 1 | 2 | 3; // TOP, RIGHT, BOTTOM, LEFT
const TOP: Edge = 0;
const RIGHT: Edge = 1;
const BOTTOM: Edge = 2;
const LEFT: Edge = 3;

// Indexed by 4-bit case (TL*8 + TR*4 + BR*2 + BL*1) -> pairs of edges to connect.
const CASE_TABLE: [Edge, Edge][][] = [
  [],
  [[LEFT, BOTTOM]],
  [[BOTTOM, RIGHT]],
  [[LEFT, RIGHT]],
  [[TOP, RIGHT]],
  [
    [TOP, RIGHT],
    [LEFT, BOTTOM],
  ],
  [[TOP, BOTTOM]],
  [[TOP, LEFT]],
  [[TOP, LEFT]],
  [[TOP, BOTTOM]],
  [
    [TOP, LEFT],
    [BOTTOM, RIGHT],
  ],
  [[TOP, RIGHT]],
  [[LEFT, RIGHT]],
  [[BOTTOM, RIGHT]],
  [[LEFT, BOTTOM]],
  [],
];

function crossingFraction(v0: number, v1: number, iso: number): number {
  const d = v1 - v0;
  return d === 0 ? 0.5 : (iso - v0) / d;
}

function edgePoint(edge: Edge, x: number, y: number, va: number, vb: number, vc: number, vd: number, iso: number): Point {
  switch (edge) {
    case TOP:
      return { x: x + crossingFraction(va, vb, iso), y };
    case RIGHT:
      return { x: x + 1, y: y + crossingFraction(vb, vc, iso) };
    case BOTTOM:
      return { x: x + crossingFraction(vd, vc, iso), y: y + 1 };
    case LEFT:
      return { x, y: y + crossingFraction(va, vd, iso) };
    default:
      throw new Error(`Unknown edge: ${edge}`);
  }
}

/**
 * Traces contour lines of constant brightness through the image (marching
 * squares) -- an isophote/outline effect. Each grid-cell crossing becomes its
 * own short 2-point stroke rather than being linked into longer polylines;
 * the optimizer's nearest-neighbor pass reorders them efficiently afterward.
 * Returned points are in source-image pixel space (not yet mm).
 */
export function traceOutline(imageData: ImageData, params: OutlineParams): Stroke[] {
  const { width, height } = imageData;
  const gray = boxBlur(toGrayscale(imageData), width, height, Math.max(0, Math.round(params.blur)));
  const iso = params.threshold;
  const strokes: Stroke[] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const va = gray[y * width + x];
      const vb = gray[y * width + x + 1];
      const vc = gray[(y + 1) * width + x + 1];
      const vd = gray[(y + 1) * width + x];
      const caseIndex = (va >= iso ? 8 : 0) | (vb >= iso ? 4 : 0) | (vc >= iso ? 2 : 0) | (vd >= iso ? 1 : 0);
      const pairs = CASE_TABLE[caseIndex];
      for (const [e1, e2] of pairs) {
        const p1 = edgePoint(e1, x, y, va, vb, vc, vd, iso);
        const p2 = edgePoint(e2, x, y, va, vb, vc, vd, iso);
        strokes.push({ id: createId('stroke'), mode: 'draw', points: [p1, p2] });
      }
    }
  }
  return strokes;
}
