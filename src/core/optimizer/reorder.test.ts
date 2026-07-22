import { describe, expect, it } from 'vitest';
import { measureTravelDistance, reorderStrokes } from './reorder';
import type { Stroke } from '../model/types';

describe('reorderStrokes', () => {
  it('produces an order with less or equal total travel than a scrambled input', () => {
    const strokes: Stroke[] = [
      { id: 'a', mode: 'draw', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: 'b', mode: 'draw', points: [{ x: 100, y: 100 }, { x: 101, y: 100 }] },
      { id: 'c', mode: 'draw', points: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 'd', mode: 'draw', points: [{ x: 99, y: 100 }, { x: 98, y: 100 }] },
    ];
    const start = { x: 0, y: 0 };
    const before = measureTravelDistance(strokes, start);
    const reordered = reorderStrokes(strokes, start);
    const after = measureTravelDistance(reordered, start);

    expect(reordered).toHaveLength(strokes.length);
    expect(after).toBeLessThanOrEqual(before);
    // The two near-origin strokes should be visited before the two far-away ones.
    expect(['a', 'c']).toContain(reordered[0].id);
    expect(['a', 'c']).toContain(reordered[1].id);
  });

  it('preserves all strokes exactly once', () => {
    const strokes: Stroke[] = [
      { id: 'a', mode: 'draw', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: 'b', mode: 'draw', points: [{ x: 5, y: 5 }, { x: 6, y: 6 }] },
    ];
    const reordered = reorderStrokes(strokes, { x: 0, y: 0 });
    expect(reordered.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});
