export interface LoadedImage {
  imageData: ImageData;
  width: number;
  height: number;
}

/** Loads an image file into pixel data, downscaling to a max dimension for performance. */
export async function loadImageData(file: File, maxDimension = 800): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context to process the image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  bitmap.close();
  return { imageData, width, height };
}
