import type { SimulationTimeline } from './SimulationEngine';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function totalLengthMm(timeline: SimulationTimeline): number {
  return timeline.totalDrawLengthMm + timeline.totalTravelLengthMm;
}
