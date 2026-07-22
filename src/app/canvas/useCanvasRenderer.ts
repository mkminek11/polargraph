import { useEffect, useRef } from 'react';
import { boundsOf, distance } from '../../core/model/geometry';
import { stepGondolaPhysics, type GondolaPhysicsState } from '../../core/simulator/gondolaPhysics';
import { samplePenPositionAt } from '../../core/simulator/SimulationEngine';
import { useProjectStore } from '../../store/useProjectStore';
import { useSimStore } from '../../store/useSimStore';
import { useUIStore } from '../../store/useUIStore';
import { drawCablesAndPulleys, type CableMotionState } from './renderers/drawCables';
import { drawGrid } from './renderers/drawGrid';
import { drawPen } from './renderers/drawPen';
import { drawSelectionOverlay } from './renderers/drawSelection';
import { drawSimulationProgress } from './renderers/drawSimulation';
import { drawStrokes } from './renderers/drawStrokes';
import type { Point } from '../../core/model/types';

const PEN_COLOR = '#d65f2b';
const PULLEY_PHYSICAL_RADIUS_MM = 5; // used only to convert cord feed (mm) into a rotation angle

/**
 * Continuous render loop for the machine canvas. Reads current store state
 * directly on each frame (rather than subscribing) so this hook never causes
 * React re-renders itself -- only the canvas pixels change per frame.
 */
export function useCanvasRenderer(canvasRef: React.RefObject<HTMLCanvasElement>): void {
  const physicsRef = useRef<GondolaPhysicsState | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const cableMotionRef = useRef<CableMotionState>({
    leftAngleRad: 0,
    rightAngleRad: 0,
    leftDashOffsetMm: 0,
    rightDashOffsetMm: 0,
  });
  const prevCordLengthsRef = useRef<{ left: number; right: number } | null>(null);

  useEffect(() => {
    let frameId: number;

    const render = (timestampMs: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        const { viewport } = useUIStore.getState();
        const { machineProfile, art, simPenPosition } = useProjectStore.getState().project;
        const { timeline, currentTimeMs, playing } = useSimStore.getState();

        drawGrid(ctx, viewport, machineProfile);

        // The pen never lifts on this gantry, so travel is real ink -- the
        // default (untouched) preview shows the complete result, travel
        // lines included, rather than hiding them until playback starts.
        // Once the user plays or scrubs, the engaged time takes over so the
        // scrubber/playhead can inspect any point along the plot.
        let target: Point;

        if (timeline && art) {
          const engaged = playing || currentTimeMs > 0;
          const displayTimeMs = engaged ? currentTimeMs : timeline.totalDurationMs;

          const styles = getComputedStyle(document.documentElement);
          const travelColor = styles.getPropertyValue('--color-travel').trim() || '#9a9c96';
          drawSimulationProgress(ctx, viewport, timeline, displayTimeMs, art.penColor, travelColor);

          // The physical pen position tracks playback only once the user has
          // engaged with it; otherwise the jog panel's simPenPosition rules.
          target = engaged ? samplePenPositionAt(timeline, displayTimeMs, machineProfile.homePosition).position : simPenPosition;
        } else {
          if (art) drawStrokes(ctx, viewport, art);
          target = simPenPosition;
        }

        if (art && art.strokes.length > 0) {
          drawSelectionOverlay(ctx, viewport, boundsOf(art.strokes.flatMap((s) => s.points)));
        }

        // Real gravity + cord-constraint physics: the motors define target cord
        // lengths for wherever the drawing wants the pen; the gondola's actual
        // position is derived by falling under gravity and being caught by
        // whichever cords are taut, so it swings rather than teleporting.
        const lastTime = lastFrameTimeRef.current;
        const dtSeconds = lastTime != null ? (timestampMs - lastTime) / 1000 : 0;
        lastFrameTimeRef.current = timestampMs;

        const targetLeftLength = distance(machineProfile.motorLeft, target);
        const targetRightLength = distance(machineProfile.motorRight, target);

        if (!physicsRef.current) {
          physicsRef.current = { position: { ...target }, previousPosition: { ...target } };
        }
        physicsRef.current = stepGondolaPhysics(
          physicsRef.current,
          machineProfile.motorLeft,
          machineProfile.motorRight,
          targetLeftLength,
          targetRightLength,
          dtSeconds,
        );
        const gondolaPosition = physicsRef.current.position;

        const actualLeftLength = distance(machineProfile.motorLeft, gondolaPosition);
        const actualRightLength = distance(machineProfile.motorRight, gondolaPosition);
        const prevLengths = prevCordLengthsRef.current ?? { left: actualLeftLength, right: actualRightLength };
        const deltaLeft = actualLeftLength - prevLengths.left;
        const deltaRight = actualRightLength - prevLengths.right;
        prevCordLengthsRef.current = { left: actualLeftLength, right: actualRightLength };

        const motion = cableMotionRef.current;
        motion.leftAngleRad += deltaLeft / PULLEY_PHYSICAL_RADIUS_MM;
        motion.rightAngleRad += deltaRight / PULLEY_PHYSICAL_RADIUS_MM;
        motion.leftDashOffsetMm -= deltaLeft;
        motion.rightDashOffsetMm -= deltaRight;

        drawCablesAndPulleys(ctx, viewport, machineProfile, gondolaPosition, motion);
        drawPen(ctx, viewport, gondolaPosition, PEN_COLOR);
      }
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [canvasRef]);
}
