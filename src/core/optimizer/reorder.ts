import { distance } from '../model/geometry';
import type { Point, Stroke } from '../model/types';

/**
 * Greedy nearest-neighbor reordering: repeatedly picks whichever remaining
 * stroke has an endpoint closest to the current pen position, reversing the
 * stroke's point order if approaching from its far end is cheaper.
 */
export function reorderStrokes(strokes: Stroke[], startPoint: Point): Stroke[] {
  const remaining = [...strokes];
  const result: Stroke[] = [];
  let current = startPoint;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    let bestReversed = false;

    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      const distFirst = distance(current, first);
      const distLast = distance(current, last);
      if (distFirst < bestDist) {
        bestDist = distFirst;
        bestIndex = i;
        bestReversed = false;
      }
      if (distLast < bestDist) {
        bestDist = distLast;
        bestIndex = i;
        bestReversed = true;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    const oriented = bestReversed ? { ...chosen, points: [...chosen.points].reverse() } : chosen;
    result.push(oriented);
    current = oriented.points[oriented.points.length - 1];
  }

  return result;
}

/** Total pen-up travel distance to visit the given strokes in order, starting from startPoint. */
export function measureTravelDistance(strokes: Stroke[], startPoint: Point): number {
  let total = 0;
  let current = startPoint;
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    total += distance(current, s.points[0]);
    current = s.points[s.points.length - 1];
  }
  return total;
}
