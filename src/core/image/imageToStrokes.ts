import type { ImagePresetParams, Stroke } from '../model/types';
import { traceHatching } from './hatching';
import { traceOutline } from './outline';

export interface ImagePlacement {
  x: number; // mm, top-left of placed image
  y: number;
  width: number; // mm, placed width (height is derived by the caller to preserve aspect ratio)
}

/** Runs the selected preset and maps its pixel-space output into mm space at the given placement. */
export function imageToStrokes(imageData: ImageData, params: ImagePresetParams, placement: ImagePlacement): Stroke[] {
  const scaleMmPerPx = placement.width / imageData.width;

  let strokes: Stroke[];
  switch (params.preset) {
    case 'outline':
      strokes = traceOutline(imageData, { threshold: params.threshold, blur: params.blur });
      break;
    case 'hatching':
      strokes = traceHatching(imageData, {
        spacingPx: params.lineSpacingMm / scaleMmPerPx,
        darkThreshold: params.darkThreshold,
        angleDeg: params.angleDeg,
      });
      break;
  }

  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({
      x: placement.x + p.x * scaleMmPerPx,
      y: placement.y + p.y * scaleMmPerPx,
    })),
  }));
}
