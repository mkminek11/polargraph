import { create } from 'zustand';
import type { Viewport } from '../core/machine/coordinates';

interface UIState {
  viewport: Viewport;
  calibrationOpen: boolean;
  setViewport: (viewport: Viewport) => void;
  toggleCalibration: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewport: { panX: 0, panY: 0, zoom: 1 },
  calibrationOpen: false,
  setViewport: (viewport) => set({ viewport }),
  toggleCalibration: () => set((state) => ({ calibrationOpen: !state.calibrationOpen })),
}));
