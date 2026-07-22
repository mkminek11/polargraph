import { describe, expect, it } from 'vitest';
import { traceOutline } from './outline';

function makeImageData(width: number, height: number, valueAt: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = valueAt(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('traceOutline', () => {
  it('traces a boundary between a black half and a white half', () => {
    const size = 20;
    const image = makeImageData(size, size, (x) => (x < size / 2 ? 0 : 255));
    const strokes = traceOutline(image, { threshold: 0.5, blur: 0 });
    expect(strokes.length).toBeGreaterThan(0);
    // All segment points should sit close to the vertical boundary at x = size/2.
    for (const stroke of strokes) {
      for (const p of stroke.points) {
        expect(Math.abs(p.x - size / 2)).toBeLessThan(1.01);
      }
    }
  });

  it('produces no contours for a uniform image', () => {
    const image = makeImageData(10, 10, () => 128);
    const strokes = traceOutline(image, { threshold: 0.9, blur: 0 });
    expect(strokes).toHaveLength(0);
  });
});
