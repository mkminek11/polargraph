import { describe, expect, it } from 'vitest';
import { traceHatching } from './hatching';

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

describe('traceHatching', () => {
  it('produces more ink on a solid black image than a solid white image', () => {
    const size = 40;
    const black = makeImageData(size, size, () => 0);
    const white = makeImageData(size, size, () => 255);
    const params = { spacingPx: 4, darkThreshold: 0.5, angleDeg: 0 };
    const blackStrokes = traceHatching(black, params);
    const whiteStrokes = traceHatching(white, params);
    expect(blackStrokes.length).toBeGreaterThan(whiteStrokes.length);
    expect(whiteStrokes).toHaveLength(0);
  });
});
