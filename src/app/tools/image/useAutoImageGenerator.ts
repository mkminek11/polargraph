import { useRef, useState } from 'react';
import { suggestHatchingParams, suggestOutlineParams } from '../../../core/image/autoParams';
import { imageToStrokes } from '../../../core/image/imageToStrokes';
import { loadImageData, type LoadedImage } from '../../../core/image/loadImage';
import { createId } from '../../../core/model/id';
import type { ImagePresetParams } from '../../../core/model/types';
import { reorderStrokes } from '../../../core/optimizer/reorder';
import { useProjectStore } from '../../../store/useProjectStore';

export type ArtStyle = 'outline' | 'hatching';

const PLACEMENT_WIDTH_FRACTION = 0.6; // fraction of the canvas width the art is centered/sized to initially

export function useAutoImageGenerator() {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [style, setStyleState] = useState<ArtStyle>('outline');
  const [busy, setBusy] = useState(false);
  const sourceImageIdRef = useRef<string | null>(null);

  const setArt = useProjectStore((s) => s.setArt);
  const clearArtAction = useProjectStore((s) => s.clearArt);

  const generate = (image: LoadedImage, targetStyle: ArtStyle, sourceImageId: string) => {
    const profile = useProjectStore.getState().project.machineProfile;
    const params: ImagePresetParams =
      targetStyle === 'outline'
        ? { preset: 'outline', ...suggestOutlineParams(image.imageData) }
        : { preset: 'hatching', angleDeg: 45, ...suggestHatchingParams(image.imageData) };

    const placementWidth = profile.canvasWidthMm * PLACEMENT_WIDTH_FRACTION;
    const placementHeight = placementWidth * (image.height / image.width);
    const placement = {
      x: (profile.canvasWidthMm - placementWidth) / 2,
      y: (profile.canvasHeightMm - placementHeight) / 2,
      width: placementWidth,
    };

    const rawStrokes = imageToStrokes(image.imageData, params, placement);
    const optimized = reorderStrokes(rawStrokes, profile.homePosition);

    setArt({
      id: createId('art'),
      strokes: optimized,
      preset: targetStyle,
      params,
      sourceImageId,
      penColor: '#1b1c19',
      strokeWidthMm: 0.5,
    });
  };

  const pickImage = async (file: File) => {
    setBusy(true);
    try {
      const image = await loadImageData(file);
      const sourceImageId = createId('image');
      sourceImageIdRef.current = sourceImageId;
      setLoaded(image);
      generate(image, style, sourceImageId);
    } finally {
      setBusy(false);
    }
  };

  const setStyle = (nextStyle: ArtStyle) => {
    setStyleState(nextStyle);
    if (loaded && sourceImageIdRef.current) generate(loaded, nextStyle, sourceImageIdRef.current);
  };

  const clear = () => {
    setLoaded(null);
    sourceImageIdRef.current = null;
    clearArtAction();
  };

  return { pickImage, style, setStyle, clear, busy, canSwitchStyle: loaded !== null };
}
