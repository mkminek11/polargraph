import { toGrayscale } from './grayscale';

/**
 * Otsu's method: finds the threshold (0..1) that best splits the image's
 * brightness histogram into two classes (maximizing between-class variance).
 * This is what makes threshold/darkness-cutoff sliders "just work" per image
 * instead of requiring manual hunting for the right value.
 */
export function computeOtsuThreshold(gray: Float32Array): number {
  const bins = 256;
  const histogram = new Array(bins).fill(0);
  for (let i = 0; i < gray.length; i++) {
    const bin = Math.min(bins - 1, Math.max(0, Math.round(gray[i] * (bins - 1))));
    histogram[bin]++;
  }

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * histogram[i];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  // Track the full run of bins tied for the max (not just the first) --
  // a cleanly bimodal image (e.g. pure black/white line art) produces a
  // plateau of equal variance across the whole gap between the two
  // clusters, and the midpoint of that plateau is the sensible threshold,
  // not whichever end happens to be scanned first.
  let bestRunStart = 0;
  let bestRunEnd = 0;

  for (let i = 0; i < bins; i++) {
    weightB += histogram[i];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += i * histogram[i];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestRunStart = i;
      bestRunEnd = i;
    } else if (variance === maxVariance) {
      bestRunEnd = i;
    }
  }

  const bestBin = (bestRunStart + bestRunEnd) / 2;
  return bestBin / (bins - 1);
}

export interface OutlineAutoParams {
  threshold: number;
  blur: number;
}

export function suggestOutlineParams(imageData: ImageData): OutlineAutoParams {
  const gray = toGrayscale(imageData);
  const threshold = computeOtsuThreshold(gray);
  const blur = Math.min(3, Math.max(0, Math.round(Math.min(imageData.width, imageData.height) / 250)));
  return { threshold, blur };
}

export interface HatchingAutoParams {
  lineSpacingMm: number;
  darkThreshold: number;
}

export function suggestHatchingParams(imageData: ImageData): HatchingAutoParams {
  const gray = toGrayscale(imageData);
  const darkThreshold = computeOtsuThreshold(gray);
  return { lineSpacingMm: 5, darkThreshold };
}
