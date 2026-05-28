import { useState, useEffect, useCallback, useRef } from 'react';
import { File, Folder, Home, ChevronRight, Check, X } from 'lucide-react';
import { listFiles } from '../services/api';
import type { FileItem } from '../services/api';

export interface FolderPickerDialogProps {
  open: boolean;
  defaultFolder?: string;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (folderPath: string) => void;
  disableRoot?: boolean;
}

export function FolderPickerDialog({
  open,
  defaultFolder = '',
  title = 'Move to folder',
  message,
  onCancel,
  onConfirm,
  disableRoot = false,
  confirmLabel = 'Create Here',
}: FolderPickerDialogProps) {
  const [currentFolder, setCurrentFolder] = useState('');
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const initialSet = useRef(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && !initialSet.current) {
      setCurrentFolder(defaultFolder);
      setSelectedFolder(defaultFolder);
      initialSet.current = true;
    }
    if (!open) {
      initialSet.current = false;
    }
  }, [open, defaultFolder]);

  useEffect(() => {
    if (open) {
      const segments = currentFolder ? currentFolder.split('/').filter(Boolean) : [];
      setBreadcrumb(segments);
    }
  }, [currentFolder, open]);

  const loadFolders = useCallback(async (folderPath: string) => {
    setLoading(true);
    try {
      const items = await listFiles(folderPath);
      const folderItems = items.filter(item => item.type === 'folder');
      const fileItems = items.filter(item => item.type === 'file');
      setFolders(folderItems);
      setFiles(fileItems);
    } catch {
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadFolders(currentFolder);
    }
  }, [currentFolder, open, loadFolders]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onConfirm(selectedFolder);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel, onConfirm, selectedFolder]);

  if (!open) return null;

  const handleFolderClick = (folder: FileItem) => {
    const newFolder = currentFolder ? `${currentFolder}/${folder.name}` : folder.name;
    setCurrentFolder(newFolder);
    setSelectedFolder(newFolder);
  };

  const handleBack = () => {
    if (currentFolder) {
      const segments = currentFolder.split('/').filter(Boolean);
      segments.pop();
      const newFolder = segments.join('/');
      setCurrentFolder(newFolder);
      setSelectedFolder(newFolder);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const segments = breadcrumb.slice(0, index + 1);
    const newFolder = segments.join('/');
    setCurrentFolder(newFolder);
    setSelectedFolder(newFolder);
  };

  const handleRootClick = () => {
    setCurrentFolder('');
    setSelectedFolder('');
  };

  const handleConfirm = () => {
    onConfirm(selectedFolder);
  };

  const isRootSelected = selectedFolder === '';
  const isCurrentInRoot = currentFolder === '';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: '420px', maxWidth: '540px' }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {message && <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>{message}</p>}

          {/* Root folder option — hidden when disableRoot is true */}
          {!disableRoot && (
            <div
              onClick={handleRootClick}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors mb-1 ${
                isRootSelected
                  ? 'bg-primary/20 border border-primary/50'
                  : 'bg-secondary/10 border border-transparent hover:bg-secondary/30'
              }`}
            >
              <Home size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm flex-1 text-[hsl(var(--foreground))]">Root</span>
              {isRootSelected && <Check size={14} className="text-primary flex-shrink-0" />}
            </div>
          )}

          {/* Breadcrumb navigation */}
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 mb-1 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              <span>in</span>
              {breadcrumb.map((segment, index) => (
                <div key={index} className="flex items-center gap-1">
                  <ChevronRight size={10} />
                  {index === breadcrumb.length - 1 ? (
                    <span style={{ color: 'hsl(var(--foreground))' }} className="font-semibold">{segment}</span>
                  ) : (
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className="hover:text-[hsl(var(--foreground))] transition-colors"
                      style={{ color: 'hsl(var(--muted-foreground))' }}
                    >
                      {segment}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Folder list */}
          <div
            className="overflow-y-auto rounded-md border"
            style={{
              maxHeight: '240px',
              borderColor: 'rgb(var(--border))',
              marginTop: '0.5rem',
            }}
          >
            {loading ? (
              <div className="py-6 text-center text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Loading...
              </div>
            ) : folders.length === 0 && files.length === 0 && isCurrentInRoot ? (
              <div className="py-6 text-center text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                No folders
              </div>
            ) : folders.length === 0 && files.length === 0 && !isCurrentInRoot ? (
              <div className="py-6 text-center text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                This folder is empty
              </div>
            ) : (
              <>
                {folders.map(folder => {
                  const isSelected = selectedFolder === folder.path;
                  return (
                    <div
                      key={folder.path}
                      onClick={() => handleFolderClick(folder)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/20 border-primary/50'
                          : 'hover:bg-secondary/30'
                      }`}
                      style={
                        isSelected
                          ? {}
                          : { borderBottom: '1px solid rgb(var(--border) / 0.5)' }
                      }
                    >
                      <Folder size={16} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm flex-1 text-[hsl(var(--foreground))]">{folder.name}</span>
                      {isSelected && <Check size={14} className="text-primary flex-shrink-0" />}
                    </div>
                  );
                })}
                {files.map(file => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-2"
                    style={{
                      opacity: 0.5,
                      borderBottom: '1px solid rgb(var(--border) / 0.5)',
                    }}
                  >
                    <File size={16} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm flex-1 text-[hsl(var(--muted-foreground))]">{file.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Selected path display */}
          <div
            className="mt-2 px-3 py-1.5 rounded text-xs flex items-center gap-2"
            style={{
              background: 'rgb(var(--input))',
              color: 'hsl(var(--foreground))',
            }}
          >
            <Home size={10} className="flex-shrink-0" />
            <span className="truncate">{selectedFolder || '/'}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}