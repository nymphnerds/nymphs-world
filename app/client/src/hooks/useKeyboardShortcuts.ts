import { useState, useCallback, useEffect, useRef } from 'react';

export type KeyCombo = string;

export interface KeyBindingDef {
  id: string;
  label: string;
  description: string;
  defaultKey: KeyCombo;
  category: 'app' | 'editor' | 'ai';
}

export type KeyBindings = Record<string, KeyCombo>;

const STORAGE_KEY = 'wbu_keybindings';

export const DEFAULT_BINDINGS: KeyBindingDef[] = [
  {
    id: 'save',
    label: 'Save Document',
    description: 'Save the current document',
    defaultKey: 'Ctrl+S',
    category: 'app',
  },
  {
    id: 'newTemplate',
    label: 'New from Template',
    description: 'Open the New from Template modal',
    defaultKey: 'Ctrl+Shift+N',
    category: 'app',
  },
  {
    id: 'find',
    label: 'Toggle Find',
    description: 'Toggle the Find & Replace bar',
    defaultKey: 'Ctrl+F',
    category: 'editor',
  },
  {
    id: 'replace',
    label: 'Find and Replace',
    description: 'Open the Find & Replace bar',
    defaultKey: 'Ctrl+H',
    category: 'editor',
  },
  {
    id: 'aiComplete',
    label: 'AI Complete',
    description: 'Trigger AI completion suggestion at cursor',
    defaultKey: 'Ctrl+Space',
    category: 'ai',
  },
  {
    id: 'aiAccept',
    label: 'Accept AI Suggestion',
    description: 'Accept the AI ghost text suggestion',
    defaultKey: 'Tab',
    category: 'ai',
  },
  {
    id: 'aiDecline',
    label: 'Decline AI Suggestion',
    description: 'Dismiss the AI ghost text suggestion',
    defaultKey: 'Escape',
    category: 'ai',
  },
];

function loadBindings(): KeyBindings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  // Return defaults
  const defaults: KeyBindings = {};
  for (const def of DEFAULT_BINDINGS) {
    defaults[def.id] = def.defaultKey;
  }
  return defaults;
}

function saveBindings(bindings: KeyBindings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

function resetBindings(): KeyBindings {
  const defaults: KeyBindings = {};
  for (const def of DEFAULT_BINDINGS) {
    defaults[def.id] = def.defaultKey;
  }
  saveBindings(defaults);
  return defaults;
}

// Parse a key combo string like "Ctrl+Shift+S" into modifiers + key
function parseKeyCombo(combo: KeyCombo): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } {
  const parts = combo.split('+');
  const key = parts.pop() || '';
  const has = (p: string) => parts.includes(p);
  return {
    ctrl: has('Ctrl'),
    shift: has('Shift'),
    alt: has('Alt'),
    meta: has('Meta'),
    key: key,
  };
}

// Check if a KeyboardEvent matches a KeyCombo string
function eventMatchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  const { ctrl, shift, alt, meta, key } = parseKeyCombo(combo);
  // Normalize key comparison
  const eventKey = e.key.toLowerCase();
  const targetKey = key.toLowerCase();

  // Check modifiers
  const hasCtrl = e.ctrlKey && !e.metaKey;
  const hasMeta = e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;

  const modifierMatch =
    (ctrl === hasCtrl || (ctrl && hasMeta)) &&
    (meta === hasMeta || (meta && hasCtrl)) &&
    shift === hasShift &&
    alt === hasAlt;

  const keyMatch = eventKey === targetKey || e.key === key;

  return modifierMatch && keyMatch;
}

// Format a key combo for display (e.g., "⌘+S" on Mac, "Ctrl+S" on Windows/Linux)
function formatKeyCombo(combo: KeyCombo): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return combo.replace(/Ctrl/g, isMac ? '⌘' : 'Ctrl').replace(/Meta/g, isMac ? '⌘' : 'Win');
}

// Find conflicts — return array of binding IDs that share the same key combo
function findConflicts(bindings: KeyBindings): Map<string, string[]> {
  const comboToIds = new Map<string, string[]>();
  for (const [id, combo] of Object.entries(bindings)) {
    const normalized = combo.toUpperCase();
    if (!comboToIds.has(normalized)) {
      comboToIds.set(normalized, []);
    }
    comboToIds.get(normalized)!.push(id);
  }
  // Only keep entries with more than one ID (actual conflicts)
  const conflicts = new Map<string, string[]>();
  for (const [combo, ids] of comboToIds) {
    if (ids.length > 1) {
      conflicts.set(combo, ids);
    }
  }
  return conflicts;
}

interface UseKeyboardShortcutsReturn {
  bindings: KeyBindings;
  setBinding: (id: string, combo: KeyCombo) => void;
  resetAll: () => void;
  getBinding: (id: string) => KeyCombo;
  formatCombo: (combo: KeyCombo) => string;
  definitions: KeyBindingDef[];
  conflicts: Map<string, string[]>;
  checkShortcut: (id: string, e: KeyboardEvent) => boolean;
}

export function useKeyboardShortcuts(): UseKeyboardShortcutsReturn {
  const [bindings, setBindingsState] = useState<KeyBindings>(loadBindings);
  const definitions = DEFAULT_BINDINGS;
  const conflicts = findConflicts(bindings);

  const setBinding = useCallback((id: string, combo: KeyCombo) => {
    setBindingsState(prev => {
      const next = { ...prev, [id]: combo };
      saveBindings(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const defaults = resetBindings();
    setBindingsState(defaults);
  }, []);

  const getBinding = useCallback((id: string) => {
    return bindings[id] || DEFAULT_BINDINGS.find(d => d.id === id)?.defaultKey || '';
  }, [bindings]);

  const checkShortcut = useCallback((id: string, e: KeyboardEvent): boolean => {
    const combo = bindings[id];
    if (!combo) return false;
    return eventMatchesCombo(e, combo);
  }, [bindings]);

  return {
    bindings,
    setBinding,
    resetAll,
    getBinding,
    formatCombo: formatKeyCombo,
    definitions,
    conflicts,
    checkShortcut,
  };
}

// Standalone helpers for use outside the hook
export { parseKeyCombo, eventMatchesCombo, formatKeyCombo, findConflicts, loadBindings, saveBindings, resetBindings };