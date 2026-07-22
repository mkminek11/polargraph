import { useEffect, useRef } from 'react';
import { fitViewport } from '../../core/machine/coordinates';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';
import { useArtResize } from './useArtResize';
import { useCanvasRenderer } from './useCanvasRenderer';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;

export function CanvasViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const machineProfile = useProjectStore((s) => s.project.machineProfile);
  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);

  const resize = useArtResize(canvasRef);
  useCanvasRenderer(canvasRef);

  // Keep the backing canvas sized (in device pixels) to match its container,
  // and always re-fit the view to it -- the control bar grows/shrinks as
  // photos are loaded or the calibration sheet opens, and the drawing area
  // should stay fully visible and centered rather than keeping a stale fit.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = container;
      canvas.width = Math.max(1, Math.round(clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(clientHeight * dpr));
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;

      if (clientWidth > 0 && clientHeight > 0) {
        setViewport(fitViewport(machineProfile.canvasWidthMm, machineProfile.canvasHeightMm, clientWidth, clientHeight));
      }
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineProfile.canvasWidthMm, machineProfile.canvasHeightMm]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = Math.exp(-e.deltaY * 0.0015);
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * zoomFactor));
    const scaleChange = nextZoom / viewport.zoom;

    // Keep the point under the cursor stationary while zooming.
    const panX = cursorX - (cursorX - viewport.panX) * scaleChange;
    const panY = cursorY - (cursorY - viewport.panY) * scaleChange;

    setViewport({ panX, panY, zoom: nextZoom });
  };

  // A corner handle takes priority; anywhere else on the canvas pans the view
  // (there's no separate tool mode to switch -- resize is always available).
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (resize.onPointerDown(e)) return;
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (resize.isActive()) {
      resize.onPointerMove(e);
      return;
    }
    if (isPanning.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setViewport({ ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (resize.onPointerUp(e)) return;
    isPanning.current = false;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          display: 'block',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
