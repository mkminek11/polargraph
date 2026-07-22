import type { Project } from '../model/types';

const AUTOSAVE_KEY = 'polargraph:autosave';
const PROJECT_INDEX_KEY = 'polargraph:projectIndex';
const PROJECT_KEY_PREFIX = 'polargraph:project:';

export interface SavedProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

function readIndex(): SavedProjectSummary[] {
  try {
    const raw = localStorage.getItem(PROJECT_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SavedProjectSummary[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SavedProjectSummary[]): void {
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(index));
}

export function autosaveProject(project: Project): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown storage error' };
  }
}

export function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function listSavedProjects(): SavedProjectSummary[] {
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveProjectAs(project: Project): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, JSON.stringify(project));
    const index = readIndex().filter((s) => s.id !== project.id);
    index.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
    writeIndex(index);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown storage error' };
  }
}

export function loadProjectById(id: string): Project | null {
  try {
    const raw = localStorage.getItem(`${PROJECT_KEY_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(`${PROJECT_KEY_PREFIX}${id}`);
  writeIndex(readIndex().filter((s) => s.id !== id));
}
