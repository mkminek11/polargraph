import { describe, expect, it } from 'vitest';
import { fitViewport, mmToPx, pxToMm } from './coordinates';

describe('mmToPx / pxToMm round trip', () => {
  it('round-trips an arbitrary point through a viewport transform', () => {
    const viewport = { panX: 10, panY: -5, zoom: 1.5 };
    const original = { x: 123.4, y: 56.7 };
    const px = mmToPx(original, viewport);
    const mm = pxToMm(px, viewport);
    expect(mm.x).toBeCloseTo(original.x, 9);
    expect(mm.y).toBeCloseTo(original.y, 9);
  });

  it('maps the origin to the pan offset', () => {
    const viewport = { panX: 20, panY: 30, zoom: 2 };
    expect(mmToPx({ x: 0, y: 0 }, viewport)).toEqual({ x: 20, y: 30 });
  });
});

describe('fitViewport', () => {
  it('centers a machine canvas within the available viewport', () => {
    const viewport = fitViewport(600, 800, 1000, 1000, 0);
    // height-constrained: zoom = 1000/800 = 1.25
    expect(viewport.zoom).toBeCloseTo(1.25, 9);
    // content width = 600*1.25 = 750, centered in 1000 -> panX = 125
    expect(viewport.panX).toBeCloseTo(125, 9);
    expect(viewport.panY).toBeCloseTo(0, 9);
  });

  it('keeps the whole machine canvas within bounds after fitting', () => {
    const canvasWidthMm = 600;
    const canvasHeightMm = 800;
    const viewport = fitViewport(canvasWidthMm, canvasHeightMm, 500, 1200, 16);
    const topLeftPx = mmToPx({ x: 0, y: 0 }, viewport);
    const bottomRightPx = mmToPx({ x: canvasWidthMm, y: canvasHeightMm }, viewport);
    expect(topLeftPx.x).toBeGreaterThanOrEqual(0);
    expect(topLeftPx.y).toBeGreaterThanOrEqual(0);
    expect(bottomRightPx.x).toBeLessThanOrEqual(500);
    expect(bottomRightPx.y).toBeLessThanOrEqual(1200);
  });
});
