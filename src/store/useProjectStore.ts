import { create } from 'zustand';
import { createEmptyProject } from '../core/project/createProject';
import type { ImageArt, MachineProfile, Point, Project } from '../core/model/types';

interface ProjectState {
  project: Project;
  setMachineProfile: (patch: Partial<MachineProfile>) => void;
  loadProject: (project: Project) => void;

  setArt: (art: ImageArt) => void;
  clearArt: () => void;
  scaleArt: (factor: number, pivot: Point) => void;

  setSimPenPosition: (point: Point) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: createEmptyProject(),

  setMachineProfile: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        machineProfile: { ...state.project.machineProfile, ...patch },
        updatedAt: new Date().toISOString(),
      },
    })),

  loadProject: (project) => set({ project }),

  setArt: (art) => set((state) => ({ project: { ...state.project, art, updatedAt: new Date().toISOString() } })),

  clearArt: () => set((state) => ({ project: { ...state.project, art: null, updatedAt: new Date().toISOString() } })),

  scaleArt: (factor, pivot) =>
    set((state) => {
      const art = state.project.art;
      if (!art) return state;
      return {
        project: {
          ...state.project,
          art: {
            ...art,
            strokes: art.strokes.map((s) => ({
              ...s,
              points: s.points.map((p) => ({
                x: pivot.x + (p.x - pivot.x) * factor,
                y: pivot.y + (p.y - pivot.y) * factor,
              })),
            })),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  setSimPenPosition: (point) => set((state) => ({ project: { ...state.project, simPenPosition: point } })),
}));
