import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Plus, ChevronUp, ChevronDown, Trash2, User, UserCircle } from 'lucide-react';
import { Scene, DialogueParticipant, DialogueLine } from '../services/api';
import { useDialogue } from '../hooks/useDialogue';

interface DialogueEditorModalProps {
  scene: Scene;
  onClose: () => void;
}

export const DialogueEditorModal: React.FC<DialogueEditorModalProps> = ({ scene, onClose }) => {
  const {
    lines,
    participants,
    loading,
    saving,
    error,
    loadDialogue,
    saveDialogue,
    addLine: apiAddLine,
    updateLine: apiUpdateLine,
    removeLine: apiRemoveLine,
    moveLineUp: apiMoveLineUp,
    moveLineDown: apiMoveLineDown,
  } = useDialogue();

  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  // Load dialogue when modal opens
  useEffect(() => {
    loadDialogue(scene);
    setDirty(false);
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set default selected speaker when participants load
  useEffect(() => {
    if (participants.length > 0 && !selectedSpeaker) {
      setSelectedSpeaker(participants[0].name);
    }
  }, [participants, selectedSpeaker]);

  // Wrappers that mark dirty on any change
  const addLine = useCallback(() => {
    apiAddLine();
    setDirty(true);
  }, [apiAddLine]);

  const updateLine = useCallback((id: string, updates: Partial<DialogueLine>) => {
    apiUpdateLine(id, updates);
    setDirty(true);
  }, [apiUpdateLine]);

  const removeLine = useCallback((id: string) => {
    apiRemoveLine(id);
    setDirty(true);
  }, [apiRemoveLine]);

  const moveLineUp = useCallback((id: string) => {
    apiMoveLineUp(id);
    setDirty(true);
  }, [apiMoveLineUp]);

  const moveLineDown = useCallback((id: string) => {
    apiMoveLineDown(id);
    setDirty(true);
  }, [apiMoveLineDown]);

  // Close on Escape key, Save on Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, lines, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    const ok = await saveDialogue(scene);
    if (ok) {
      setDirty(false);
    }
  }, [saveDialogue, scene]);

  const handleSpeakerChange = useCallback((lineId: string, speakerName: string) => {
    const participant = participants.find(p => p.name === speakerName);
    updateLine(lineId, {
      speakerName: speakerName,
      speakerPath: participant?.path || '',
    });
    setSelectedSpeaker(speakerName);
  }, [participants, updateLine]);

  if (loading) {
    return (
      <div className="dialogue-modal-overlay" onClick={onClose}>
        <div className="dialogue-modal" onClick={e => e.stopPropagation()}>
          <div className="dialogue-modal-loading">
            <span>Loading dialogue...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dialogue-modal-overlay" onClick={onClose}>
        <div className="dialogue-modal" onClick={e => e.stopPropagation()}>
          <div className="dialogue-modal-header">
            <span>Error</span>
            <button className="dialogue-modal-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="dialogue-modal-error">
            <span>{error}</span>
            <button className="dialogue-modal-retry-btn" onClick={() => loadDialogue(scene)}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialogue-modal-overlay" onClick={onClose}>
      <div className="dialogue-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dialogue-modal-header">
          <div className="dialogue-modal-header-left">
            <span>Dialogue Editor</span>
            <span className="dialogue-modal-scene-name">— {scene.name}</span>
          </div>
          <div className="dialogue-modal-header-right">
            <div className="dialogue-scene-meta">
              <span>{scene.era}</span>
              {scene.date && (
                <>
                  <span className="dialogue-scene-meta-sep">·</span>
                  <span>{scene.date}</span>
                </>
              )}
              {scene.locationName && (
                <>
                  <span className="dialogue-scene-meta-sep">·</span>
                  <span>{scene.locationName}</span>
                </>
              )}
            </div>
            <button
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors ${dirty ? 'save-btn-dirty' : ''}`}
              onClick={handleSave}
              disabled={saving || lines.length === 0}
              title="Save (Ctrl+S)"
            >
              <Save size={12} />
              Save
            </button>
            <button className="dialogue-modal-close" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="dialogue-modal-body">
          {/* Participants bar */}
          {participants.length > 0 && (
            <div className="dialogue-participants-bar">
              <span className="dialogue-participants-label">Participants:</span>
              {participants.map(p => (
                <button
                  key={p.path}
                  className={`dialogue-participant-chip ${p.type} ${selectedSpeaker === p.name ? 'selected' : ''}`}
                  onClick={() => setSelectedSpeaker(p.name)}
                  title={`${p.name} (${p.type})`}
                >
                  {p.type === 'npc' ? <UserCircle size={12} /> : <User size={12} />}
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Lines */}
          <div className="dialogue-lines-container">
            {lines.length === 0 ? (
              <div className="dialogue-modal-empty">
                <span>No dialogue lines yet.</span>
                <span style={{ fontSize: '0.65rem' }}>
                  Click "Add Line" below to start writing dialogue.
                </span>
              </div>
            ) : (
              lines
                .sort((a, b) => a.order - b.order)
                .map((line, idx) => (
                  <DialogueLineCard
                    key={line.id}
                    line={line}
                    idx={idx}
                    total={lines.length}
                    participants={participants}
                    selectedSpeaker={selectedSpeaker}
                    onSpeakerChange={handleSpeakerChange}
                    onUpdate={updateLine}
                    onRemove={removeLine}
                    onMoveUp={moveLineUp}
                    onMoveDown={moveLineDown}
                  />
                ))
            )}
          </div>

          {/* Add line button */}
          <button className="dialogue-add-line-btn" onClick={addLine}>
            <Plus size={14} />
            Add Line
          </button>
        </div>

        {/* Footer */}
        <div className="dialogue-modal-footer">
          <span className="dialogue-modal-footer-info">
            {lines.length} line{lines.length !== 1 ? 's' : ''} · {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <div className="dialogue-modal-footer-actions">
            <button className="dialogue-modal-cancel-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Dialogue Line Card Component
// ============================================================

interface DialogueLineCardProps {
  line: DialogueLine;
  idx: number;
  total: number;
  participants: DialogueParticipant[];
  selectedSpeaker: string;
  onSpeakerChange: (lineId: string, speakerName: string) => void;
  onUpdate: (id: string, updates: Partial<DialogueLine>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const DialogueLineCard: React.FC<DialogueLineCardProps> = ({
  line,
  idx,
  total,
  participants,
  selectedSpeaker,
  onSpeakerChange,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  const speakerOptions = participants.map(p => p.name);
  const currentSpeaker = line.speakerName || (participants[0]?.name || '');

  return (
    <div className="dialogue-line-card">
      {/* Top row: speaker select + actions */}
      <div className="dialogue-line-top">
        <select
          className="dialogue-line-speaker-select"
          value={currentSpeaker}
          onChange={e => onSpeakerChange(line.id, e.target.value)}
        >
          {speakerOptions.length === 0 && <option value="">No participants</option>}
          {speakerOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <div className="dialogue-line-actions">
          <button
            className="dialogue-line-action-btn"
            onClick={() => onMoveUp(line.id)}
            disabled={idx === 0}
            title="Move up"
          >
            <ChevronUp size={12} />
          </button>
          <button
            className="dialogue-line-action-btn"
            onClick={() => onMoveDown(line.id)}
            disabled={idx === total - 1}
            title="Move down"
          >
            <ChevronDown size={12} />
          </button>
          <button
            className="dialogue-line-action-btn delete"
            onClick={() => onRemove(line.id)}
            title="Delete line"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Speech */}
      <textarea
        className="dialogue-line-speech"
        placeholder="What does the character say..."
        value={line.speech}
        onChange={e => onUpdate(line.id, { speech: e.target.value })}
        rows={2}
      />

      {/* Action / stage direction */}
      <textarea
        className="dialogue-line-action-input"
        placeholder="Action / stage direction (italic)..."
        value={line.action}
        onChange={e => onUpdate(line.id, { action: e.target.value })}
        rows={1}
      />
    </div>
  );
};