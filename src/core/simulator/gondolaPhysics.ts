import type { Point } from '../model/types';

export interface GondolaPhysicsState {
  position: Point;
  previousPosition: Point;
}

// Tuned well above real-world gravity: at this canvas's mm scale, real g (9800mm/s^2)
// produces a multi-second pendulum period that reads as sluggish for a control UI.
// This settles a full-canvas swing in roughly a second while still clearly swinging.
const GRAVITY_MM_PER_S2 = 12000;
const VELOCITY_DAMPING = 0.955; // air/friction loss per step
const CONSTRAINT_ITERATIONS = 6;
const MAX_DT_SECONDS = 1 / 30;

/**
 * Clamps a point to within `maxLength` of `anchor` (a cord can go slack --
 * distance less than maxLength -- but never stretch beyond it).
 */
function applyCordConstraint(p: Point, anchor: Point, maxLength: number): Point {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxLength || dist === 0) return p;
  const scale = maxLength / dist;
  return { x: anchor.x + dx * scale, y: anchor.y + dy * scale };
}

/**
 * Verlet-integrates the gondola under real gravity, then satisfies both cord
 * constraints via position-based relaxation. Cords can only pull (never
 * push): if the motors let a cord out faster than gravity would carry the
 * gondola, that side goes slack and the gondola swings freely on the other
 * cord until it draws taut again -- the same behavior a real two-cord
 * gondola shows, rather than teleporting to the target position.
 */
export function stepGondolaPhysics(
  state: GondolaPhysicsState,
  motorLeft: Point,
  motorRight: Point,
  targetLeftLength: number,
  targetRightLength: number,
  dtSeconds: number,
): GondolaPhysicsState {
  const dt = Math.min(Math.max(dtSeconds, 0), MAX_DT_SECONDS);
  if (dt === 0) return state;

  const vx = (state.position.x - state.previousPosition.x) * VELOCITY_DAMPING;
  const vy = (state.position.y - state.previousPosition.y) * VELOCITY_DAMPING;

  let next: Point = {
    x: state.position.x + vx,
    y: state.position.y + vy + GRAVITY_MM_PER_S2 * dt * dt,
  };
  const previous = state.position;

  for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) {
    next = applyCordConstraint(next, motorLeft, targetLeftLength);
    next = applyCordConstraint(next, motorRight, targetRightLength);
  }

  return { position: next, previousPosition: previous };
}
