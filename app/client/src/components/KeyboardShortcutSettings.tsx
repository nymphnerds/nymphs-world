import { useState, useCallback, useEffect, useRef } from 'react';
import { Keyboard, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { useKeyboardShortcuts, type KeyBindingDef } from '../hooks/useKeyboardShortcuts';

const inputClass = 'w-full rounded-md bg-[#2a2a3a] px-3 py-2 text-sm text-[#e0e0e0] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]';

type CategoryTab = 'all' | 'app' | 'editor' | 'ai';

interface KeyCaptureModalProps {
  bindingId: string;
  label: string;
  currentCombo: string;
  onSave: (combo: string) => void;
  onClose: () => void;
}

function KeyCaptureModal({ bindingId, label, currentCombo, onSave, onClose }: KeyCaptureModalProps) {
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Meta');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    // Normalize special keys
    if (key === ' ') key = 'Space';
    if (key === 'Control' || key === 'Meta' || key === 'Shift' || key === 'Alt') return;

    parts.push(key);
    const combo = parts.join('+');

    if (!combo || parts.length === 0) {
      setError('Please press a valid key combination');
      return;
    }

    setCaptured(combo);
    setError(null);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    // Auto-dismiss after 10 seconds of inactivity
    timerRef.current = setTimeout(() => {
      onClose();
    }, 10000);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e2e] rounded-lg shadow-2xl border border-[#3a3a4a] p-6 w-full max-w-sm">
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-2">Record Shortcut</h3>
        <p className="text-xs text-[#888] mb-4">
          Press the key combination for <span className="text-[#a78bfa] font-medium">{label}</span>, then wait or click Save.
        </p>

        <div className="rounded-md bg-[#2a2a3a] p-4 mb-4 text-center min-h-[56px] flex items-center justify-center border border-dashed border-[#3a3a4a]">
          {captured ? (
            <span className="text-base font-mono text-white px-3 py-1 bg-[#3a3a4a] rounded">
              {captured}
            </span>
          ) : (
            <span className="text-sm text-[#888] animate-pulse">Press any key...</span>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md bg-[#3a3a4a] text-[#e0e0e0] hover:bg-[#4a4a5a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (captured) {
                onSave(captured);
              }
            }}
            disabled={!captured}
            className="px-3 py-1.5 text-xs rounded-md bg-[#a78bfa]/20 text-[#a78bfa] hover:bg-[#a78bfa]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcutSettings() {
  const {
    bindings,
    setBinding,
    resetAll,
    definitions,
    conflicts,
    formatCombo,
  } = useKeyboardShortcuts();

  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Get the definition currently being captured
  const captureDef = captureId ? definitions.find(d => d.id === captureId) : null;

  const filteredDefs = definitions.filter(def => {
    if (categoryTab === 'all') return true;
    return def.category === categoryTab;
  });

  const handleSaveCapture = useCallback((combo: string) => {
    if (captureId) {
      setBinding(captureId, combo);
      setCaptureId(null);
      setSavedId(captureId);
      setTimeout(() => setSavedId(null), 2000);
    }
  }, [captureId, setBinding]);

  const handleResetSingle = useCallback((id: string) => {
    const def = definitions.find(d => d.id === id);
    if (def) {
      setBinding(id, def.defaultKey);
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }, [definitions, setBinding]);

  const handleResetAll = useCallback(() => {
    resetAll();
  }, [resetAll]);

  // Check if a binding ID is in conflict
  const isInConflict = (id: string): boolean => {
    for (const [, conflictingIds] of conflicts) {
      if (conflictingIds.length > 1 && conflictingIds.includes(id)) return true;
    }
    return false;
  };

  const categoryIcons = {
    all: '⌨️',
    app: '📱',
    editor: '✏️',
    ai: '🤖',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Keyboard size={14} /> Keyboard Shortcuts
          </h3>
          <p className="text-[11px] text-[#888] mt-1">
            Customize hotkeys for common actions. Click a shortcut to rebind it.
          </p>
        </div>
        <button
          onClick={handleResetAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#3a3a4a] text-[#e0e0e0] hover:bg-[#4a4a5a] transition-colors"
          title="Reset all shortcuts to defaults"
        >
          <RotateCcw size={12} />
          Reset All
        </button>
      </div>

      {/* Conflict Warning */}
      {conflicts.size > 0 && (
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Shortcut Conflicts Detected</p>
              <p className="text-amber-300/80 mt-0.5">
                Some shortcuts are assigned to multiple actions. Reassign to resolve.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 border-b border-[#3a3a4a]">
        {(['all', 'app', 'editor', 'ai'] as CategoryTab[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryTab(cat)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 capitalize ${
              categoryTab === cat
                ? 'border-[#a78bfa] text-white'
                : 'border-transparent text-[#6a6a7a] hover:text-[#8a8a9a]'
            }`}
          >
            {categoryIcons[cat]} {cat === 'app' ? 'App' : cat === 'editor' ? 'Editor' : cat === 'ai' ? 'AI' : 'All'}
          </button>
        ))}
      </div>

      {/* Shortcut List */}
      <div className="space-y-1">
        {filteredDefs.map((def) => {
          const combo = bindings[def.id] || def.defaultKey;
          const isCustom = combo !== def.defaultKey;
          const hasConflict = isInConflict(def.id);
          const justSaved = savedId === def.id;

          return (
            <div
              key={def.id}
              className={`flex items-center justify-between py-2.5 px-3 rounded-md group hover:bg-[#2a2a3a] transition-colors ${
                hasConflict ? 'border border-amber-500/30' : ''
              }`}
            >
              {/* Left side: action info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-[#e0e0e0] truncate">{def.label}</p>
                  {isCustom && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#a78bfa]/20 text-[#a78bfa] flex-shrink-0">
                      custom
                    </span>
                  )}
                  {hasConflict && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex-shrink-0">
                      conflict
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#888] mt-0.5 truncate">{def.description}</p>
              </div>

              {/* Right side: shortcut + actions */}
              <div className="flex items-center gap-2 ml-3">
                {/* Current shortcut - clickable to rebind */}
                <button
                  onClick={() => setCaptureId(def.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2a2a3a] border border-[#3a3a4a] hover:border-[#a78bfa]/50 transition-colors min-w-[100px] justify-center"
                  title="Click to change"
                >
                  <kbd className="text-xs font-mono text-[#e0e0e0]">
                    {formatCombo(combo)}
                  </kbd>
                </button>

                {/* Reset to default (only show when customized) */}
                {isCustom && (
                  <button
                    onClick={() => handleResetSingle(def.id)}
                    className="p-1 rounded text-[#888] hover:text-[#e0e0e0] transition-colors opacity-0 group-hover:opacity-100"
                    title={`Reset to ${formatCombo(def.defaultKey)}`}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}

                {/* Saved indicator */}
                {justSaved && (
                  <span className="text-green-400">
                    <Check size={12} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-[10px] text-[#6a6a7a] pt-2 border-t border-[#3a3a4a]">
        <p>Tip: On macOS, Ctrl is displayed as ⌘. Key bindings are saved locally in your browser.</p>
      </div>

      {/* Key Capture Modal */}
      {captureId && captureDef && (
        <KeyCaptureModal
          bindingId={captureId}
          label={captureDef.label}
          currentCombo={bindings[captureId] || captureDef.defaultKey}
          onSave={handleSaveCapture}
          onClose={() => setCaptureId(null)}
        />
      )}
    </div>
  );
}