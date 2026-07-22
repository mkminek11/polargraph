import { CURRENT_SCHEMA_VERSION } from '../core/model/types';
import { autosaveProject, loadAutosave } from '../core/storage/localStorageRepo';
import { useProjectStore } from './useProjectStore';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function initializeAutosave(): void {
  const existing = loadAutosave();
  if (existing && existing.schemaVersion === CURRENT_SCHEMA_VERSION) {
    useProjectStore.getState().loadProject(existing);
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  useProjectStore.subscribe((state) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const result = autosaveProject(state.project);
      if (!result.ok) console.warn('Autosave failed:', result.error);
    }, AUTOSAVE_DEBOUNCE_MS);
  });
}
