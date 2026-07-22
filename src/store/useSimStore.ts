import { create } from 'zustand';
import type { SimulationTimeline } from '../core/simulator/SimulationEngine';

interface SimState {
  timeline: SimulationTimeline | null;
  currentTimeMs: number;
  playing: boolean;
  speedMultiplier: number;
  setTimeline: (timeline: SimulationTimeline | null) => void;
  setCurrentTimeMs: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  timeline: null,
  currentTimeMs: 0,
  playing: false,
  speedMultiplier: 1,
  setTimeline: (timeline) => {
    const current = get().currentTimeMs;
    const clamped = timeline ? Math.min(current, timeline.totalDurationMs) : 0;
    set({ timeline, currentTimeMs: clamped });
  },
  setCurrentTimeMs: (t) => set({ currentTimeMs: Math.max(0, t) }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () =>
    set((state) => {
      // Restart from the beginning if playback already reached the end.
      if (!state.playing && state.timeline && state.currentTimeMs >= state.timeline.totalDurationMs) {
        return { playing: true, currentTimeMs: 0 };
      }
      return { playing: !state.playing };
    }),
}));
