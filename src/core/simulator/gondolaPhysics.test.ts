import { describe, expect, it } from 'vitest';
import { stepGondolaPhysics, type GondolaPhysicsState } from './gondolaPhysics';
import { distance } from '../model/geometry';

const motorLeft = { x: 0, y: 0 };
const motorRight = { x: 600, y: 0 };

describe('stepGondolaPhysics', () => {
  it('settles at the point equidistant per both cord lengths when both are taut', () => {
    const target = { x: 300, y: 400 };
    const leftLen = distance(motorLeft, target);
    const rightLen = distance(motorRight, target);

    let state: GondolaPhysicsState = { position: { x: 300, y: 100 }, previousPosition: { x: 300, y: 100 } };
    for (let i = 0; i < 600; i++) {
      state = stepGondolaPhysics(state, motorLeft, motorRight, leftLen, rightLen, 1 / 60);
    }
    expect(state.position.x).toBeCloseTo(target.x, 0);
    expect(state.position.y).toBeCloseTo(target.y, 0);
  });

  it('never lets either cord stretch beyond its target length', () => {
    let state: GondolaPhysicsState = { position: { x: 300, y: 50 }, previousPosition: { x: 300, y: 50 } };
    const leftLen = 350;
    const rightLen = 350;
    for (let i = 0; i < 120; i++) {
      state = stepGondolaPhysics(state, motorLeft, motorRight, leftLen, rightLen, 1 / 60);
      // Small numerical slack from iterative (Gauss-Seidel) constraint relaxation, not a real stretch.
      expect(distance(motorLeft, state.position)).toBeLessThanOrEqual(leftLen + 0.01);
      expect(distance(motorRight, state.position)).toBeLessThanOrEqual(rightLen + 0.01);
    }
  });

  it('goes slack (free-falls) on a side whose cord suddenly lengthens', () => {
    // Start resting at equilibrium for a near point, then let the left cord out a lot.
    const nearTarget = { x: 300, y: 200 };
    const nearLeftLen = distance(motorLeft, nearTarget);
    const nearRightLen = distance(motorRight, nearTarget);
    let state: GondolaPhysicsState = { position: nearTarget, previousPosition: nearTarget };
    for (let i = 0; i < 100; i++) {
      state = stepGondolaPhysics(state, motorLeft, motorRight, nearLeftLen, nearRightLen, 1 / 60);
    }
    const settled = state.position;

    // Now let the left cord out substantially while keeping the right cord fixed:
    // gravity should pull the gondola down/right before the left cord (if ever) draws taut again.
    const afterOneStep = stepGondolaPhysics(state, motorLeft, motorRight, nearLeftLen + 100, nearRightLen, 1 / 60);
    expect(afterOneStep.position.y).toBeGreaterThan(settled.y);
  });

  it('does not move when dt is zero', () => {
    const state: GondolaPhysicsState = { position: { x: 5, y: 5 }, previousPosition: { x: 4, y: 4 } };
    const result = stepGondolaPhysics(state, motorLeft, motorRight, 100, 100, 0);
    expect(result).toEqual(state);
  });

  it('stays finite under a large dt spike', () => {
    let state: GondolaPhysicsState = { position: { x: 300, y: 200 }, previousPosition: { x: 300, y: 200 } };
    state = stepGondolaPhysics(state, motorLeft, motorRight, 400, 400, 5);
    expect(Number.isFinite(state.position.x)).toBe(true);
    expect(Number.isFinite(state.position.y)).toBe(true);
  });
});
