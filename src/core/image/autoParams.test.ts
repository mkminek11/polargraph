import { describe, expect, it } from 'vitest';
import { computeOtsuThreshold, suggestOutlineParams } from './autoParams';

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

describe('computeOtsuThreshold', () => {
  it('finds the split point between two well-separated brightness clusters', () => {
    const gray = new Float32Array(1000);
    for (let i = 0; i < 500; i++) gray[i] = 0.1; // dark cluster
    for (let i = 500; i < 1000; i++) gray[i] = 0.9; // light cluster
    const threshold = computeOtsuThreshold(gray);
    expect(threshold).toBeGreaterThan(0.1);
    expect(threshold).toBeLessThan(0.9);
  });

  it('stays within 0..1 for a uniform image', () => {
    const gray = new Float32Array(100).fill(0.5);
    const threshold = computeOtsuThreshold(gray);
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(1);
  });
});

describe('suggestOutlineParams', () => {
  it('suggests a threshold between the two halves of a half-black-half-white image', () => {
    const size = 40;
    const image = makeImageData(size, size, (x) => (x < size / 2 ? 0 : 255));
    const { threshold, blur } = suggestOutlineParams(image);
    expect(threshold).toBeGreaterThan(0.2);
    expect(threshold).toBeLessThan(0.8);
    expect(blur).toBeGreaterThanOrEqual(0);
  });
});
