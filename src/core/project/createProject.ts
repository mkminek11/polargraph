import { createId } from '../model/id';
import { CURRENT_SCHEMA_VERSION, type MachineProfile, type Project } from '../model/types';

// Fixed by the physical build -- this gantry's drawing surface is a hardcoded
// size, not something adjusted per-project.
export const HARDCODED_CANVAS_WIDTH_MM = 600;
export const HARDCODED_CANVAS_HEIGHT_MM = 800;

export function createDefaultMachineProfile(): MachineProfile {
  const canvasWidthMm = HARDCODED_CANVAS_WIDTH_MM;
  const canvasHeightMm = HARDCODED_CANVAS_HEIGHT_MM;
  return {
    id: createId('profile'),
    name: 'Default Polargraph',
    canvasWidthMm,
    canvasHeightMm,
    motorLeft: { x: 0, y: 0 },
    motorRight: { x: canvasWidthMm, y: 0 },
    penGondolaOffset: { x: 0, y: 0 },
    homePosition: { x: canvasWidthMm / 2, y: canvasHeightMm / 2 },
    speedMmPerSec: 80,
  };
}

export function createEmptyProject(name = 'Untitled Drawing'): Project {
  const machineProfile = createDefaultMachineProfile();
  const now = new Date().toISOString();
  return {
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    machineProfile,
    art: null,
    simPenPosition: { ...machineProfile.homePosition },
  };
}
