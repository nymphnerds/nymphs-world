import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, X, ChevronUp, ChevronDown, Pencil, Plus, Trash2, Film, MapPin, Calendar } from 'lucide-react';
import { getTimeline, getLocations, type TimelineEra, type TimelineScene } from '../services/api';
import { getEras, saveEras, DEFAULT_ERAS } from '../utils/timelineConfig';
import { createScene } from '../services/api';

interface TimelineViewProps {
  onFileSelect: (path: string) => void;
  refreshKey?: number;
}

// Skeleton loading placeholder
const TimelineSkeleton: React.FC = () => (
  <div className="timeline-skeleton">
    <div className="timeline-skeleton-era" />
    <div className="timeline-skeleton-event" />
    <div className="timeline-skeleton-event" />
    <div className="timeline-skeleton-era" />
    <div className="timeline-skeleton-event" />
  </div>
);

// ============================================================
// Settings Modal Components
// ============================================================

interface ManageItemProps {
  name: string;
  index: number;
  total: number;
  onEdit: (name: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showReorder: boolean;
}

const ManageItem: React.FC<ManageItemProps> = ({ name, index, total, onEdit, onDelete, onMoveUp, onMoveDown, showReorder }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== name) {
      onEdit(editValue.trim());
    } else {
      setEditValue(name);
    }
    setEditing(false);
  };

  return (
    <div className="timeline-manage-item">
      {editing ? (
        <input
          ref={inputRef}
          className="timeline-manage-edit-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setEditValue(name); setEditing(false); }
          }}
        />
      ) : (
        <span className="timeline-manage-item-name">{name}</span>
      )}
      <div className="timeline-manage-item-actions">
        {showReorder && (
          <>
            <button
              className="timeline-manage-action-btn"
              onClick={onMoveUp}
              disabled={index === 0}
              title="Move up"
            >
              <ChevronUp size={12} />
            </button>
            <button
              className="timeline-manage-action-btn"
              onClick={onMoveDown}
              disabled={index === total - 1}
              title="Move down"
            >
              <ChevronDown size={12} />
            </button>
          </>
        )}
        <button
          className="timeline-manage-action-btn"
          onClick={() => { setEditValue(name); setEditing(true); }}
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          className="timeline-manage-action-btn timeline-manage-action-delete"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

// Settings modal (Eras)
interface SettingsModalProps {
  onClose: () => void;
  onErasChange: (eras: string[]) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onErasChange }) => {
  const [eras, setEras] = useState<string[]>(getEras());
  const [newEra, setNewEra] = useState('');

  const addEra = () => {
    const val = newEra.trim();
    if (val && !eras.includes(val)) {
      const updated = [...eras, val];
      setEras(updated);
      saveEras(updated);
      onErasChange(updated);
      setNewEra('');
    }
  };

  const editEra = (oldName: string, newName: string) => {
    const updated = eras.map((e) => (e === oldName ? newName : e));
    setEras(updated);
    saveEras(updated);
    onErasChange(updated);
  };

  const deleteEra = (name: string) => {
    if (eras.length <= 1) return;
    const updated = eras.filter((e) => e !== name);
    setEras(updated);
    saveEras(updated);
    onErasChange(updated);
  };

  const moveEra = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= eras.length) return;
    const updated = [...eras];
    const [item] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, item);
    setEras(updated);
    saveEras(updated);
    onErasChange(updated);
  };

  return (
    <>
      <div className="timeline-modal-overlay" onClick={onClose} />
      <div className="timeline-modal">
        <div className="timeline-modal-header">
          <span>Timeline Settings</span>
          <button className="timeline-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="timeline-modal-content">
          <div className="timeline-manage-list">
            {eras.map((era, i) => (
              <ManageItem
                key={era}
                name={era}
                index={i}
                total={eras.length}
                onEdit={(newName) => editEra(era, newName)}
                onDelete={() => deleteEra(era)}
                onMoveUp={() => moveEra(i, i - 1)}
                onMoveDown={() => moveEra(i, i + 1)}
                showReorder={true}
              />
            ))}
            <div className="timeline-manage-add">
              <input
                className="timeline-manage-add-input"
                placeholder="New era name..."
                value={newEra}
                onChange={(e) => setNewEra(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addEra(); }}
              />
              <button
                className="timeline-manage-add-btn"
                onClick={addEra}
                disabled={!newEra.trim() || eras.includes(newEra.trim())}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>

        <div className="timeline-modal-footer">
          <button className="timeline-modal-reset-btn" onClick={() => {
            const reset = [...DEFAULT_ERAS];
            setEras(reset);
            saveEras(reset);
            onErasChange(reset);
          }}>
            Reset to Defaults
          </button>
          <button className="timeline-modal-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
};

// ============================================================
// Create Scene Modal
// ============================================================

interface CreateSceneModalProps {
  onClose: () => void;
  onCreateScene: (name: string, era: string, date: string, locationName: string) => void;
  eras: string[];
  locations: string[];
}

const CreateSceneModal: React.FC<CreateSceneModalProps> = ({ onClose, onCreateScene, eras, locations }) => {
  const [name, setName] = useState('');
  const [era, setEra] = useState(eras[0] || '');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Scene name is required');
      return;
    }
    if (!era) {
      setError('Era is required');
      return;
    }
    if (!location) {
      setError('Location is required');
      return;
    }
    try {
      onCreateScene(trimmedName, era, date.trim(), location);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
    }
  };

  return (
    <>
      <div className="timeline-modal-overlay" onClick={onClose} />
      <div className="timeline-modal timeline-modal-sm">
        <div className="timeline-modal-header">
          <span><Film size={14} style={{ marginRight: '0.5rem' }} />New Scene</span>
          <button className="timeline-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="timeline-modal-content">
          {error && <div className="timeline-form-error">{error}</div>}

          <div className="timeline-form-group">
            <label className="timeline-form-label">Scene Name</label>
            <input
              ref={nameRef}
              className="timeline-form-input"
              placeholder="e.g. The Battle of Moria"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          <div className="timeline-form-group">
            <label className="timeline-form-label"><Calendar size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />Era</label>
            <select className="timeline-form-select" value={era} onChange={(e) => setEra(e.target.value)}>
              {eras.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="timeline-form-group">
            <label className="timeline-form-label">Date / Period</label>
            <input
              className="timeline-form-input"
              placeholder="e.g. 3019"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          <div className="timeline-form-group">
            <label className="timeline-form-label"><MapPin size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />Location</label>
            <select className="timeline-form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Select location...</option>
              {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
        </div>

        <div className="timeline-modal-footer">
          <button className="timeline-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="timeline-modal-done-btn"
            onClick={handleSubmit}
            disabled={!name.trim() || !era || !location}
          >
            <Plus size={14} style={{ marginRight: '0.25rem' }} />Create Scene
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================================
// Scene Entry
// ============================================================

const SceneEntry: React.FC<{
  scene: TimelineScene;
  onFileClick: (path: string) => void;
}> = ({ scene, onFileClick }) => {
  const [expanded, setExpanded] = useState(scene.files.length <= 3);

  return (
    <div className="timeline-scene" title={`Scene: ${scene.name}`}>
      <div className="timeline-scene-header" onClick={() => setExpanded(!expanded)}>
        <span className={`timeline-scene-arrow ${!expanded ? 'collapsed' : ''}`}>▶</span>
        <Film size={12} className="timeline-scene-icon" />
        <span className="timeline-scene-name">{scene.name}</span>
        {scene.date && <span className="timeline-scene-date">{scene.date}</span>}
        {scene.locationName && <span className="timeline-scene-location">{scene.locationName}</span>}
        <span className="timeline-scene-file-count">({scene.files.length})</span>
      </div>

      {expanded && scene.files.length > 0 && (
        <div className="timeline-scene-files">
          {scene.files.map((f) => (
            <div key={f.path} className="timeline-scene-file" onClick={() => onFileClick(f.path)}>
              <span className="timeline-scene-file-name">{f.name}</span>
              {f.tags && f.tags.length > 0 && (
                <span className="timeline-scene-file-tag" style={{ color: f.tags[0].color }}>
                  {f.tags[0].name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Era Section
// ============================================================

const EraSection: React.FC<{
  era: TimelineEra;
  onFileClick: (path: string) => void;
}> = ({ era, onFileClick }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="timeline-era">
      <button
        className="timeline-era-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className={`timeline-era-arrow ${collapsed ? 'collapsed' : ''}`}>▶</span>
        <span className="timeline-era-name">{era.name}</span>
        <span className="timeline-era-count">({era.scenes.length} scene{era.scenes.length !== 1 ? 's' : ''})</span>
      </button>
      {!collapsed && (
        <div className="timeline-era-scenes">
          {era.scenes.map((scene) => (
            <SceneEntry
              key={scene.id}
              scene={scene}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main TimelineView
// ============================================================

const TimelineView: React.FC<TimelineViewProps> = ({ onFileSelect, refreshKey }) => {
  const [eras, setEras] = useState<TimelineEra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [userEraOrder, setUserEraOrder] = useState<string[]>(getEras());
  const [locationNames, setLocationNames] = useState<string[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const fetchTimeline = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 500) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        fetchTimeline();
      }, 500);
      return;
    }
    lastRefreshRef.current = now;

    try {
      setLoading(true);
      setError(null);
      const eraList = getEras();
      const data = await getTimeline(eraList);
      setEras(data.eras);

      // Locations are now fetched separately via getLocations() API

      // Update era filter to include all eras from data
      const eraNames = data.eras.map((e) => e.name);
      if (eraNames.length > 0) {
        setSelectedEras(new Set(eraNames));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    fetchTimeline();
  }, [refreshKey, fetchTimeline]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Fetch locations from location API for the create-scene dropdown
  useEffect(() => {
    (async () => {
      try {
        const locs = await getLocations();
        setLocationNames(locs.map((l: any) => l.name).sort());
      } catch { /* ignore */ }
    })();
  }, []);

  // Era filter
  const [selectedEras, setSelectedEras] = useState<Set<string>>(new Set());
  const eraOptions = eras.map((e) => e.name);

  const filteredEras = eras
    .map((era) => ({
      ...era,
      scenes: era.scenes.filter((s) => selectedEras.has(era.name)),
    }))
    .filter((era) => era.scenes.length > 0);

  const totalScenes = filteredEras.reduce((sum, era) => sum + era.scenes.length, 0);

  const toggleEra = (era: string) => {
    setSelectedEras((prev) => {
      const next = new Set(prev);
      if (next.has(era)) next.delete(era);
      else next.add(era);
      return next;
    });
  };

  const selectAllEras = () => setSelectedEras(new Set(eraOptions));
  const deselectAllEras = () => setSelectedEras(new Set());

  const handleCreateScene = async (name: string, era: string, date: string, locationName: string) => {
    await createScene(name, era, date, locationName);
    fetchTimeline();
  };

  const handleErasChange = (newEras: string[]) => {
    setUserEraOrder(newEras);
    fetchTimeline();
  };

  // Multi-select dropdown (reuse existing styles)
  const MultiSelectDropdown: React.FC<{
    label: string;
    options: string[];
    selected: Set<string>;
    onToggle: (option: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
  }> = ({ label, options, selected, onToggle, onSelectAll, onDeselectAll }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allSelected = options.length > 0 && selected.size === options.length;

    return (
      <div ref={ref} className="timeline-filter-dropdown">
        <button
          className="timeline-filter-btn"
          onClick={() => setOpen(!open)}
          title={label}
        >
          {label}: {selected.size === 0 ? 'None' : selected.size === options.length ? 'All' : `${selected.size}`}
          <span className={`timeline-filter-arrow ${open ? 'open' : ''}`}>▾</span>
        </button>
        {open && (
          <div className="timeline-filter-menu">
            <div className="timeline-filter-actions">
              <button onClick={allSelected ? onDeselectAll : onSelectAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="timeline-filter-options">
              {options.map((option) => (
                <label key={option} className="timeline-filter-option">
                  <input
                    type="checkbox"
                    checked={selected.has(option)}
                    onChange={() => onToggle(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <span>Timeline</span>
        <div className="timeline-header-right">
          <span className="timeline-event-total">{totalScenes} scene{totalScenes !== 1 ? 's' : ''}</span>
          <button
            className="timeline-add-scene-btn"
            onClick={() => setShowCreateScene(true)}
            title="New Scene"
          >
            <Plus size={14} />
          </button>
          <button
            className="timeline-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Manage Eras"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Era Filter */}
      {eraOptions.length > 1 && (
        <div className="timeline-filters">
          <MultiSelectDropdown
            label="Eras"
            options={eraOptions}
            selected={selectedEras}
            onToggle={toggleEra}
            onSelectAll={selectAllEras}
            onDeselectAll={deselectAllEras}
          />
        </div>
      )}

      {/* Content */}
      <div className="timeline-content">
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="timeline-error">
            <p>Could not load timeline.</p>
            <p><span style={{ color: 'hsl(var(--muted-foreground))' }}>{error}</span></p>
            <button className="timeline-retry-btn" onClick={fetchTimeline}>Retry</button>
          </div>
        ) : filteredEras.length === 0 && !loading ? (
          <div className="timeline-empty">
            <p>No scenes in timeline.</p>
            <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>
              Click + to create a scene, then assign scenes to files from the Information Panel.
            </p>
          </div>
        ) : (
          filteredEras.map((era) => (
            <EraSection
              key={era.name}
              era={era}
              onFileClick={onFileSelect}
            />
          ))
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onErasChange={handleErasChange}
        />
      )}

      {/* Create Scene Modal */}
      {showCreateScene && (
        <CreateSceneModal
          onClose={() => setShowCreateScene(false)}
          onCreateScene={handleCreateScene}
          eras={getEras()}
          locations={locationNames}
        />
      )}
    </div>
  );
};

export default TimelineView;