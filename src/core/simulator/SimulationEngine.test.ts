import { describe, expect, it } from 'vitest';
import { createDefaultMachineProfile } from '../project/createProject';
import type { Stroke } from '../model/types';
import { buildTimeline, samplePenPositionAt } from './SimulationEngine';

describe('buildTimeline / samplePenPositionAt', () => {
  const profile = createDefaultMachineProfile();

  it('produces zero duration for no strokes', () => {
    const timeline = buildTimeline([], profile, { x: 0, y: 0 });
    expect(timeline.totalDurationMs).toBe(0);
  });

  it('inserts a travel segment between disconnected strokes', () => {
    const strokes: Stroke[] = [
      { id: 's1', mode: 'draw', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { id: 's2', mode: 'draw', points: [{ x: 50, y: 50 }, { x: 60, y: 50 }] },
    ];
    const timeline = buildTimeline(strokes, profile, { x: 0, y: 0 });
    const modes = timeline.segments.map((s) => s.mode);
    expect(modes).toEqual(['draw', 'travel', 'draw']);
    expect(timeline.totalTravelLengthMm).toBeGreaterThan(0);
  });

  it('samples the start and end positions correctly', () => {
    const strokes: Stroke[] = [{ id: 's1', mode: 'draw', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }];
    const timeline = buildTimeline(strokes, profile, { x: 0, y: 0 });

    const atStart = samplePenPositionAt(timeline, 0, { x: 0, y: 0 });
    expect(atStart.position.x).toBeCloseTo(0, 6);

    const atEnd = samplePenPositionAt(timeline, timeline.totalDurationMs, { x: 0, y: 0 });
    expect(atEnd.position.x).toBeCloseTo(100, 6);

    const atHalf = samplePenPositionAt(timeline, timeline.totalDurationMs / 2, { x: 0, y: 0 });
    expect(atHalf.position.x).toBeCloseTo(50, 1);
  });

  it('clamps time outside the timeline range', () => {
    const strokes: Stroke[] = [{ id: 's1', mode: 'draw', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
    const timeline = buildTimeline(strokes, profile, { x: 0, y: 0 });
    const beforeStart = samplePenPositionAt(timeline, -500, { x: 0, y: 0 });
    const afterEnd = samplePenPositionAt(timeline, timeline.totalDurationMs + 5000, { x: 0, y: 0 });
    expect(beforeStart.position.x).toBeCloseTo(0, 6);
    expect(afterEnd.position.x).toBeCloseTo(10, 6);
  });
});
