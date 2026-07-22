import { cumulativeLengths, distance, lerp } from '../model/geometry';
import type { MachineProfile, PenMode, Point, Stroke } from '../model/types';

export interface TimedSegment {
  strokeId: string;
  mode: PenMode;
  startTimeMs: number;
  endTimeMs: number;
  points: Point[];
  cumulativeLengths: number[];
}

export interface SimulationTimeline {
  segments: TimedSegment[];
  totalDurationMs: number;
  totalDrawLengthMm: number;
  totalTravelLengthMm: number;
}

const TRAVEL_GAP_EPSILON_MM = 0.05;

/**
 * Builds a timeline from an ordered list of draw strokes, synthesizing
 * travel segments wherever consecutive strokes don't already connect. The
 * pen never lifts on this gantry, so travel segments move at the same
 * single speed as draw segments and leave a mark just like any other move --
 * there's no pen up/down transition cost to account for.
 */
export function buildTimeline(strokes: Stroke[], profile: MachineProfile, startPosition: Point): SimulationTimeline {
  const segments: TimedSegment[] = [];
  let currentTimeMs = 0;
  let currentPos = startPosition;
  let totalDrawLengthMm = 0;
  let totalTravelLengthMm = 0;

  const pushSegment = (points: Point[], mode: PenMode, strokeId: string) => {
    const lengths = cumulativeLengths(points);
    const lengthMm = lengths[lengths.length - 1];
    const durationMs = profile.speedMmPerSec > 0 ? (lengthMm / profile.speedMmPerSec) * 1000 : 0;
    const startTimeMs = currentTimeMs;
    const endTimeMs = startTimeMs + durationMs;
    segments.push({ strokeId, mode, startTimeMs, endTimeMs, points, cumulativeLengths: lengths });
    currentTimeMs = endTimeMs;
    if (mode === 'draw') totalDrawLengthMm += lengthMm;
    else totalTravelLengthMm += lengthMm;
    currentPos = points[points.length - 1];
  };

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const gap = distance(currentPos, stroke.points[0]);
    if (gap > TRAVEL_GAP_EPSILON_MM) {
      pushSegment([currentPos, stroke.points[0]], 'travel', `travel-${stroke.id}`);
    }
    pushSegment(stroke.points, 'draw', stroke.id);
  }

  return { segments, totalDurationMs: currentTimeMs, totalDrawLengthMm, totalTravelLengthMm };
}

export interface PenSample {
  position: Point;
  segmentIndex: number;
  penMode: PenMode;
}

/** Interpolates the exact pen position at a given time along the timeline. */
export function samplePenPositionAt(timeline: SimulationTimeline, timeMs: number, fallback: Point): PenSample {
  if (timeline.segments.length === 0) {
    return { position: fallback, segmentIndex: -1, penMode: 'travel' };
  }

  const t = Math.max(0, Math.min(timeMs, timeline.totalDurationMs));
  let segmentIndex = timeline.segments.length - 1;
  for (let i = 0; i < timeline.segments.length; i++) {
    if (t <= timeline.segments[i].endTimeMs) {
      segmentIndex = i;
      break;
    }
  }
  const segment = timeline.segments[segmentIndex];
  const position = pointAlongSegment(segment, t);
  return { position, segmentIndex, penMode: segment.mode };
}

function pointAlongSegment(segment: TimedSegment, timeMs: number): Point {
  const duration = segment.endTimeMs - segment.startTimeMs;
  const localT = duration > 0 ? (timeMs - segment.startTimeMs) / duration : 1;
  const totalLen = segment.cumulativeLengths[segment.cumulativeLengths.length - 1];
  const targetLen = Math.max(0, Math.min(1, localT)) * totalLen;
  return pointAtLength(segment.points, segment.cumulativeLengths, targetLen);
}

function pointAtLength(points: Point[], lengths: number[], targetLen: number): Point {
  if (points.length === 1) return points[0];
  let idx = 0;
  while (idx < lengths.length - 2 && lengths[idx + 1] < targetLen) idx++;
  const segStart = points[idx];
  const segEnd = points[idx + 1];
  const segStartLen = lengths[idx];
  const segEndLen = lengths[idx + 1];
  const segLenDiff = segEndLen - segStartLen;
  const frac = segLenDiff > 0 ? (targetLen - segStartLen) / segLenDiff : 0;
  return lerp(segStart, segEnd, Math.max(0, Math.min(1, frac)));
}

/** The subset of a segment's points actually traversed by the given time -- for progressive rendering. */
export function pointsDrawnSoFar(segment: TimedSegment, timeMs: number): Point[] {
  const duration = segment.endTimeMs - segment.startTimeMs;
  const localT = duration > 0 ? (timeMs - segment.startTimeMs) / duration : 1;
  const totalLen = segment.cumulativeLengths[segment.cumulativeLengths.length - 1];
  const targetLen = Math.max(0, Math.min(1, localT)) * totalLen;

  if (segment.points.length === 1) return segment.points;
  let idx = 0;
  while (idx < segment.cumulativeLengths.length - 2 && segment.cumulativeLengths[idx + 1] < targetLen) idx++;
  const head = segment.points.slice(0, idx + 1);
  const interpolated = pointAtLength(segment.points, segment.cumulativeLengths, targetLen);
  return [...head, interpolated];
}
