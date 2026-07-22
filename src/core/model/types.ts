/** A point in millimeters, machine/world space (not screen pixels). */
export interface Point {
  x: number;
  y: number;
}

/** Pen state for a path segment. */
export type PenMode = 'draw' | 'travel';

/**
 * A single continuous pen path: an ordered list of points sharing one PenMode.
 * The atomic reorderable unit for the optimizer and the atomic drawn-or-not
 * unit for the simulator.
 */
export interface Stroke {
  id: string;
  points: Point[];
  mode: PenMode;
  closed?: boolean;
}

export type ImagePresetParams =
  | { preset: 'outline'; threshold: number; blur: number }
  | { preset: 'hatching'; lineSpacingMm: number; angleDeg: number; darkThreshold: number };

/** The single auto-generated, resizable drawing on the canvas. */
export interface ImageArt {
  id: string;
  strokes: Stroke[];
  preset: 'outline' | 'hatching';
  params: ImagePresetParams;
  sourceImageId: string;
  penColor: string;
  strokeWidthMm: number;
}

/**
 * Machine/plotter geometry & kinematics config. The pen is permanently down
 * on this gantry (no lift mechanism), so there is a single movement speed
 * and no pen up/down transition cost -- every move, "travel" included,
 * leaves a mark. canvasWidthMm/canvasHeightMm are fixed by the physical
 * build and not user-editable.
 */
export interface MachineProfile {
  id: string;
  name: string;
  canvasWidthMm: number;
  canvasHeightMm: number;
  motorLeft: Point;
  motorRight: Point;
  penGondolaOffset: Point;
  homePosition: Point;
  speedMmPerSec: number;
}

/** Top-level saveable document: a machine profile plus at most one piece of art. */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  machineProfile: MachineProfile;
  art: ImageArt | null;
  simPenPosition: Point;
}

export const CURRENT_SCHEMA_VERSION = 2;
