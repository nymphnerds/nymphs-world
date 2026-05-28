// Shared timeline era configuration stored in localStorage
// (Categories have been removed — use file tags instead for event color/type)

const ERAS_KEY = 'wbu_timeline_eras';

export const DEFAULT_ERAS = [
  'First Age',
  'Second Age',
  'Third Age',
  'Fourth Age',
  'Future',
  'Unknown',
];

export function getEras(): string[] {
  try {
    const stored = localStorage.getItem(ERAS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_ERAS];
}

export function saveEras(eras: string[]): void {
  localStorage.setItem(ERAS_KEY, JSON.stringify(eras));
}

// Reset to defaults
export function resetEras(): string[] {
  saveEras([...DEFAULT_ERAS]);
  return [...DEFAULT_ERAS];
}