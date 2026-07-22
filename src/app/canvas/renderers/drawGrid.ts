import type { Viewport } from '../../../core/machine/coordinates';
import { mmToPx } from '../../../core/machine/coordinates';
import type { MachineProfile } from '../../../core/model/types';

const MINOR_SPACING_MM = 10;
const MAJOR_EVERY = 10; // every 10th minor line is major (= 100mm)

export function drawGrid(ctx: CanvasRenderingContext2D, viewport: Viewport, profile: MachineProfile): void {
  const { canvasWidthMm, canvasHeightMm } = profile;
  const topLeft = mmToPx({ x: 0, y: 0 }, viewport);
  const bottomRight = mmToPx({ x: canvasWidthMm, y: canvasHeightMm }, viewport);

  ctx.save();

  // Machine canvas background
  const styles = getComputedStyle(document.documentElement);
  ctx.fillStyle = styles.getPropertyValue('--color-surface').trim() || '#ffffff';
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.clip();

  const minorColor = styles.getPropertyValue('--color-grid').trim() || '#e2e3df';
  const majorColor = styles.getPropertyValue('--color-grid-major').trim() || '#d0d1cc';

  let index = 0;
  for (let x = 0; x <= canvasWidthMm + 0.001; x += MINOR_SPACING_MM, index++) {
    const isMajor = index % MAJOR_EVERY === 0;
    const px = mmToPx({ x, y: 0 }, viewport);
    ctx.strokeStyle = isMajor ? majorColor : minorColor;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(px.x, topLeft.y);
    ctx.lineTo(px.x, bottomRight.y);
    ctx.stroke();
  }

  index = 0;
  for (let y = 0; y <= canvasHeightMm + 0.001; y += MINOR_SPACING_MM, index++) {
    const isMajor = index % MAJOR_EVERY === 0;
    const py = mmToPx({ x: 0, y }, viewport);
    ctx.strokeStyle = isMajor ? majorColor : minorColor;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, py.y);
    ctx.lineTo(bottomRight.x, py.y);
    ctx.stroke();
  }

  ctx.restore();

  // Boundary outline
  ctx.strokeStyle = styles.getPropertyValue('--color-border-strong').trim() || '#9a9c96';
  ctx.lineWidth = 1;
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

  ctx.restore();
}
