import { useRef } from 'react';
import { mmToPx, pxToMm } from '../../core/machine/coordinates';
import { boundsOf, type Bounds } from '../../core/model/geometry';
import type { Point } from '../../core/model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const OPPOSITE: Record<Corner, Corner> = {
  topLeft: 'bottomRight',
  topRight: 'bottomLeft',
  bottomLeft: 'topRight',
  bottomRight: 'topLeft',
};

const HANDLE_HIT_RADIUS_PX = 22; // generous for touch

function cornerPoint(bbox: Bounds, corner: Corner): Point {
  switch (corner) {
    case 'topLeft':
      return { x: bbox.minX, y: bbox.minY };
    case 'topRight':
      return { x: bbox.maxX, y: bbox.minY };
    case 'bottomLeft':
      return { x: bbox.minX, y: bbox.maxY };
    case 'bottomRight':
      return { x: bbox.maxX, y: bbox.maxY };
  }
}

/**
 * Resize-only interaction for the single piece of art on the canvas: drag a
 * corner handle to scale it uniformly about the opposite corner. There is no
 * move/drag-to-reposition -- the art is always centered by the generator.
 */
export function useArtResize(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const activeHandleRef = useRef<Corner | null>(null);

  const toMm = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const viewport = useUIStore.getState().viewport;
    return pxToMm({ x: clientX - rect.left, y: clientY - rect.top }, viewport);
  };

  const hitTestHandle = (clientX: number, clientY: number): Corner | null => {
    const art = useProjectStore.getState().project.art;
    if (!art || art.strokes.length === 0) return null;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pointerPx = { x: clientX - rect.left, y: clientY - rect.top };
    const viewport = useUIStore.getState().viewport;
    const bbox = boundsOf(art.strokes.flatMap((s) => s.points));

    const corners: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    for (const corner of corners) {
      const px = mmToPx(cornerPoint(bbox, corner), viewport);
      if (Math.hypot(px.x - pointerPx.x, px.y - pointerPx.y) <= HANDLE_HIT_RADIUS_PX) return corner;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
    if (e.button !== 0) return false;
    const handle = hitTestHandle(e.clientX, e.clientY);
    if (!handle) return false;
    activeHandleRef.current = handle;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    return true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
    const handle = activeHandleRef.current;
    if (!handle) return false;
    const art = useProjectStore.getState().project.art;
    if (!art) return false;

    const bbox = boundsOf(art.strokes.flatMap((s) => s.points));
    const pivot = cornerPoint(bbox, OPPOSITE[handle]);
    const handleCorner = cornerPoint(bbox, handle);
    const pointerMm = toMm(e.clientX, e.clientY);

    const oldDist = Math.max(0.001, Math.hypot(handleCorner.x - pivot.x, handleCorner.y - pivot.y));
    const newDist = Math.hypot(pointerMm.x - pivot.x, pointerMm.y - pivot.y);
    const factor = Math.min(20, Math.max(0.05, newDist / oldDist));
    useProjectStore.getState().scaleArt(factor, pivot);
    return true;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
    if (!activeHandleRef.current) return false;
    activeHandleRef.current = null;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    return true;
  };

  return { onPointerDown, onPointerMove, onPointerUp, isActive: () => activeHandleRef.current !== null };
}
