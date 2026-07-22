import { describe, expect, it } from 'vitest';
import { boundsOf, cumulativeLengths, distance, pathLength, perpendicularDistance } from './geometry';

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('pathLength / cumulativeLengths', () => {
  it('sums segment lengths along a polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 0 },
    ];
    expect(pathLength(points)).toBeCloseTo(9, 9);
    expect(cumulativeLengths(points)).toEqual([0, 5, 9]);
  });
});

describe('boundsOf', () => {
  it('finds the bounding box of a point set', () => {
    const bounds = boundsOf([
      { x: -2, y: 5 },
      { x: 10, y: -3 },
      { x: 4, y: 1 },
    ]);
    expect(bounds).toEqual({ minX: -2, minY: -3, maxX: 10, maxY: 5 });
  });
});

describe('perpendicularDistance', () => {
  it('measures distance from a point to a line segment', () => {
    const d = perpendicularDistance({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBeCloseTo(5, 9);
  });
});
