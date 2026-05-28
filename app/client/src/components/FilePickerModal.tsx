import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ArrowLeft, Home, Check, X } from 'lucide-react';
import { listFiles } from '../services/api';
import type { FileItem } from '../services/api';

interface FilePickerModalProps {
  onSelect: (filePath: string) => void;
  onClose: () => void;
  initialPath?: string;
}

export function FilePickerModal({ onSelect, onClose, initialPath }: FilePickerModalProps) {
  const [currentFolder, setCurrentFolder] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  // Set initial folder from the folder part of initialPath
  useEffect(() => {
    if (initialPath) {
      const lastSlash = initialPath.lastIndexOf('/');
      if (lastSlash > 0) {
        setCurrentFolder(initialPath.slice(0, lastSlash));
      }
    }
  }, [initialPath]);

  useEffect(() => {
    const segments = currentFolder ? currentFolder.split('/').filter(Boolean) : [];
    setBreadcrumb(segments);
  }, [currentFolder]);

  const loadFolder = useCallback(async (folderPath: string) => {
    setLoading(true);
    try {
      const items = await listFiles(folderPath);
      setFiles(items);
      setSelectedFile(null);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolder);
  }, [currentFolder, loadFolder]);

  const handleFolderClick = (folder: FileItem) => {
    const newFolder = currentFolder ? `${currentFolder}/${folder.name}` : folder.name;
    setCurrentFolder(newFolder);
  };

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file.path);
  };

  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile);
    }
  };

  const handleBack = () => {
    if (currentFolder) {
      const segments = currentFolder.split('/').filter(Boolean);
      segments.pop();
      setCurrentFolder(segments.join('/'));
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const segments = breadcrumb.slice(0, index + 1);
    setCurrentFolder(segments.join('/'));
  };

  const handleRootClick = () => {
    setCurrentFolder('');
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex flex-col bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Select a File</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-secondary/10">
          <button
            onClick={handleRootClick}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Root"
          >
            <Home size={14} />
          </button>
          {breadcrumb.map((segment, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <div key={index} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                {isLast ? (
                  <span className="text-foreground text-xs font-semibold">{segment}</span>
                ) : (
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {segment}
                  </button>
                )}
              </div>
            );
          })}
          {!breadcrumb.length && <span className="text-muted-foreground text-xs">Root</span>}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : sortedFiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No files in this folder</div>
          ) : (
            <div className="space-y-0.5">
              {sortedFiles.map((item) => {
                const isSelected = selectedFile === item.path;
                if (item.type === 'folder') {
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleFolderClick(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/20 hover:bg-secondary/40 border border-border/30 transition-colors text-left"
                    >
                      <Folder size={16} className="text-blue-400 shrink-0" />
                      <span className="text-xs text-foreground truncate">{item.name}</span>
                    </button>
                  );
                }

                // File
                return (
                  <button
                    key={item.path}
                    onClick={() => handleFileClick(item)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-left ${
                      isSelected
                        ? 'bg-primary/20 border-primary/50 ring-1 ring-primary/30'
                        : 'bg-secondary/10 border-border/30 hover:bg-secondary/30'
                    }`}
                  >
                    <File size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground truncate">{item.name}</span>
                    {isSelected && (
                      <Check size={14} className="text-primary ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
          <button
            onClick={handleBack}
            disabled={!currentFolder}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedFile}
              className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-md bg-primary hover:bg-primary/80 text-primary-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check size={12} />
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}