import { useEffect, useRef } from 'react';
import { buildTimeline } from '../../core/simulator/SimulationEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { useSimStore } from '../../store/useSimStore';

/** Rebuilds the simulation timeline whenever the art or machine profile change. */
export function useSyncTimeline(): void {
  const art = useProjectStore((s) => s.project.art);
  const machineProfile = useProjectStore((s) => s.project.machineProfile);
  const setTimeline = useSimStore((s) => s.setTimeline);

  useEffect(() => {
    const drawStrokes = art?.strokes.filter((s) => s.mode === 'draw') ?? [];
    if (drawStrokes.length === 0) {
      setTimeline(null);
      return;
    }
    const timeline = buildTimeline(drawStrokes, machineProfile, machineProfile.homePosition);
    setTimeline(timeline);
  }, [art, machineProfile, setTimeline]);
}

/** Drives currentTimeMs forward each frame while playback is active. */
export function useSimulatorTicker(): void {
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId: number;

    const tick = (now: number) => {
      const { playing, speedMultiplier, currentTimeMs, timeline, setCurrentTimeMs, setPlaying } = useSimStore.getState();
      if (playing && timeline) {
        const last = lastFrameRef.current ?? now;
        const deltaMs = now - last;
        const nextTime = currentTimeMs + deltaMs * speedMultiplier;
        if (nextTime >= timeline.totalDurationMs) {
          setCurrentTimeMs(timeline.totalDurationMs);
          setPlaying(false);
        } else {
          setCurrentTimeMs(nextTime);
        }
      }
      lastFrameRef.current = now;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
