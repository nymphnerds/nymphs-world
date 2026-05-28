import { useState, useEffect, useRef } from 'react';
import {
  User, Building2, Swords, BookOpen, Gem, Landmark, Bug, FileText, X,
  Users, ClipboardList, Calendar, Receipt, Folder, ChevronDown,
  ChevronUp, FolderPlus, Home, Check
} from 'lucide-react';
import { getTemplates, createFromTemplate, TemplateInfo, listFiles } from '../services/api';
import type { FileItem } from '../services/api';

interface NewFromTemplateModalProps {
  defaultFolder?: string;
  onClose: () => void;
  onSuccess: (path: string, content: string) => void;
}

const TEMPLATE_ICONS: Record<string, any> = {
  playercharacter: User,
  npc: Users,
  location: Building2,
  quest: Swords,
  timeline: BookOpen,
  item: Gem,
  faction: Landmark,
  creature: Bug,
  customer: Users,
  job: ClipboardList,
  booking: Calendar,
  quote: Receipt,
  blank: FileText,
};

export function NewFromTemplateModal({ defaultFolder, onClose, onSuccess }: NewFromTemplateModalProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [folder, setFolder] = useState(defaultFolder || '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load templates and auto-select first (Character) as default
  useEffect(() => {
    const profile = localStorage.getItem('wbu_profile') || 'game';
    getTemplates(profile).then(tpls => {
      setTemplates(tpls);
      // Auto-select the first template (Character for game profile) as default
      if (tpls.length > 0 && !selectedKey) {
        setSelectedKey(tpls[0].key);
        // Only use template's defaultFolder if no defaultFolder prop was passed
        if (tpls[0].defaultFolder && !defaultFolder) {
          setFolder(tpls[0].defaultFolder);
        }
      }
    }).catch(() => setError('Failed to load templates')).finally(() => setLoading(false));
  }, []);

  // Load workspace folders on modal open
  useEffect(() => {
    listFiles('').then(items => {
      const folderItems = items.filter(item => item.type === 'folder');
      setFolders(folderItems);
    }).catch(() => setFolders([]));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!folderDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [folderDropdownOpen]);

  // Update folder when a template is selected — auto-match to existing folder
  const handleSelect = (key: string) => {
    setSelectedKey(key);
    const t = templates.find(t => t.key === key);
    if (t && t.defaultFolder) {
      // Check if a folder with this name already exists
      const existing = folders.find(f => f.name.toLowerCase() === t.defaultFolder.toLowerCase());
      if (existing) {
        setFolder(existing.path || existing.name);
      } else {
        // No matching folder — set the default name for easy creation
        setFolder(t.defaultFolder);
      }
    } else {
      // Template has no defaultFolder — preserve the current explorer folder
      setFolder(defaultFolder || '');
    }
  };

  // Select a folder from the dropdown
  const handleFolderSelect = (folderPath: string) => {
    setFolder(folderPath);
    setFolderDropdownOpen(false);
  };

  // Handle creating a new folder
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
    if (!trimmed) return;
    setFolder(trimmed);
    setNewFolderName('');
    setCreatingFolder(false);
    // Reload folders so the new one appears (server creates it on file creation)
    listFiles('').then(items => {
      const folderItems = items.filter(item => item.type === 'folder');
      setFolders(folderItems);
    }).catch(() => {});
  };

  // Get display name for selected folder
  const getFolderDisplay = () => {
    if (!folder) return 'Root';
    const found = folders.find(f => (f.path || f.name) === folder);
    if (found) return found.name;
    // Folder may not exist yet (new folder to create)
    const parts = folder.split('/');
    return parts[parts.length - 1] || folder;
  };

  // Check if current folder exists
  const folderExists = () => {
    if (!folder) return true; // root always exists
    return folders.some(f => (f.path || f.name) === folder);
  };

  const handleSubmit = async () => {
    if (!selectedKey) return;
    try {
      setError(null);
      const result = await createFromTemplate(selectedKey, name || undefined, folder || undefined);
      onSuccess(result.path, result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file from template');
    }
  };

  const selected = templates.find(t => t.key === selectedKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: '420px' }}>
        <div className="modal-header">
          <h2>New from Template</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p>Loading templates...</p>
          ) : error && !selectedKey ? (
            <p style={{ color: 'var(--error)' }}>{error}</p>
          ) : (
            <>
              {/* Template Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px',
              }}>
                {templates.map(t => {
                  const Icon = TEMPLATE_ICONS[t.key] || FileText;
                  const isActive = selectedKey === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => handleSelect(t.key)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '16px 8px',
                        border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: '8px',
                        background: isActive ? 'var(--accent-alpha)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      title={t.label}
                    >
                      <Icon size={28} style={{ color: isActive ? 'var(--accent)' : 'var(--foreground-muted)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>{t.key === 'timeline' ? 'MainStory' : t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Name input */}
              {selectedKey && selectedKey !== 'blank' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={`My ${selected?.label || 'Document'}`}
                    className="input-field"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Folder dropdown picker */}
              <div style={{ marginBottom: '16px' }} ref={dropdownRef}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
                  Folder
                </label>
                <div style={{ position: 'relative' }}>
                  {/* Dropdown trigger button */}
                  <button
                    type="button"
                    onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#2a2a3a',
                      border: '1px solid #3a3a4a',
                      color: '#e0e0e0',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <Folder size={14} className="text-blue-400 flex-shrink-0" />
                    <span className="truncate">{getFolderDisplay()}</span>
                    {!folderExists() && (
                      <span style={{ fontSize: '10px', color: '#f59e0b', whiteSpace: 'nowrap' }}>new</span>
                    )}
                    {folderDropdownOpen ? (
                      <ChevronUp size={14} className="flex-shrink-0 ml-auto" style={{ color: '#888' }} />
                    ) : (
                      <ChevronDown size={14} className="flex-shrink-0 ml-auto" style={{ color: '#888' }} />
                    )}
                  </button>

                  {/* Dropdown menu */}
                  {folderDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        borderRadius: '6px',
                        background: '#1e1e2e',
                        border: '1px solid #3a3a4a',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 100,
                        maxHeight: '220px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Existing folders */}
                      <div style={{ overflowY: 'auto', maxHeight: '160px' }}>
                        {folders.length === 0 ? (
                          <div
                            className="py-4 text-center text-xs"
                            style={{ color: '#888' }}
                          >
                            No folders yet
                          </div>
                        ) : (
                          folders.map(f => {
                            const fPath = f.path || f.name;
                            const isSelected = folder === fPath;
                            return (
                              <div
                                key={fPath}
                                onClick={() => handleFolderSelect(fPath)}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-[#a78bfa]/20'
                                    : 'hover:bg-[#2a2a3a]'
                                }`}
                                style={
                                  !isSelected
                                    ? { borderBottom: '1px solid #3a3a4a50' }
                                    : {}
                                }
                              >
                                <Folder size={14} className="text-blue-400 flex-shrink-0" />
                                <span className="text-sm flex-1" style={{ color: '#e0e0e0' }}>{f.name}</span>
                                {isSelected && <Check size={12} className="text-[#a78bfa] flex-shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Create new folder section */}
                      {creatingFolder ? (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderTop: '1px solid #3a3a4a',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateFolder();
                              if (e.key === 'Escape') {
                                setCreatingFolder(false);
                                setNewFolderName('');
                              }
                            }}
                            placeholder="Folder name..."
                            autoFocus
                            style={{
                              flex: 1,
                              background: '#2a2a3a',
                              border: '1px solid #3a3a4a',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              color: '#e0e0e0',
                              outline: 'none',
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            onClick={handleCreateFolder}
                            style={{
                              background: '#a78bfa',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Create folder"
                          >
                            <Check size={12} style={{ color: 'white' }} />
                          </button>
                          <button
                            onClick={() => {
                              setCreatingFolder(false);
                              setNewFolderName('');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              color: '#888',
                            }}
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setCreatingFolder(true);
                            // Pre-fill with template default folder name if not exists
                            if (selected && selected.defaultFolder && !folders.some(f => f.name.toLowerCase() === selected.defaultFolder.toLowerCase())) {
                              setNewFolderName(selected.defaultFolder);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[#2a2a3a]"
                          style={{ borderTop: '1px solid #3a3a4a' }}
                        >
                          <FolderPlus size={14} className="flex-shrink-0" style={{ color: '#f59e0b' }} />
                          <span style={{ fontSize: '12px', color: '#f59e0b' }}>Create New Folder...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && <p style={{ color: 'var(--error)', marginBottom: '8px', fontSize: '13px' }}>{error}</p>}

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!selectedKey}
                >
                  Create
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}