import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ArrowLeft, Home, Check, X } from 'lucide-react';
import { listFiles, signImageFromWorkspace } from '../services/api';
import type { FileItem } from '../services/api';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().lastIndexOf('.');
  if (ext === -1) return false;
  return IMAGE_EXTENSIONS.has(name.substring(ext));
}

interface HeroImagePickerProps {
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

export function HeroImagePicker({ onSelect, onClose }: HeroImagePickerProps) {
  const [currentFolder, setCurrentFolder] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  // Map of file path → signed proxy URL for thumbnail display
  const [proxyUrls, setProxyUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const segments = currentFolder ? currentFolder.split('/').filter(Boolean) : [];
    setBreadcrumb(segments);
  }, [currentFolder]);

  const loadFolder = useCallback(async (folderPath: string) => {
    setLoading(true);
    setProxyUrls(new Map());
    try {
      const items = await listFiles(folderPath);
      const filtered = items.filter(item => item.type === 'folder' || isImageFile(item.name));
      setFiles(filtered);
      setSelectedFile(null);

      // Sign image paths for thumbnails using workspace signing
      const imageFiles = filtered.filter(f => f.type === 'file' && isImageFile(f.name));
      if (imageFiles.length > 0) {
        const newProxyUrls = new Map<string, string>();
        for (const file of imageFiles) {
          try {
            const url = await signImageFromWorkspace(file.path);
            newProxyUrls.set(file.path, url);
          } catch {
            // Skip images that fail to sign
          }
        }
        setProxyUrls(newProxyUrls);
      }
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
        className="flex flex-col bg-[hsl(225,15%,12%)] border border-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-gray-200">Select Hero Image</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-secondary/10">
          <button
            onClick={handleRootClick}
            className="p-1 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors"
            title="Root"
          >
            <Home size={14} />
          </button>
          {breadcrumb.map((segment, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <div key={index} className="flex items-center gap-1">
                <span className="text-gray-500">/</span>
                {isLast ? (
                  <span className="text-white text-xs font-semibold">{segment}</span>
                ) : (
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className="text-gray-300 hover:text-white text-xs transition-colors"
                  >
                    {segment}
                  </button>
                )}
              </div>
            );
          })}
          {!breadcrumb.length && <span className="text-gray-500 text-xs">Root</span>}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">Loading...</div>
          ) : sortedFiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No images in this folder</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {sortedFiles.map(item => {
                const isSelected = selectedFile === item.path;
                if (item.type === 'folder') {
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleFolderClick(item)}
                      className="flex flex-col items-center gap-1 p-3 rounded-md bg-secondary/20 hover:bg-secondary/40 border border-border/30 transition-colors"
                    >
                      <Folder size={28} className="text-blue-400" />
                      <span className="text-[10px] text-gray-300 truncate w-full text-center">{item.name}</span>
                    </button>
                  );
                }

                // Image file
                const proxyUrl = proxyUrls.get(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleFileClick(item)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${
                      isSelected
                        ? 'bg-primary/20 border-primary/50 ring-1 ring-primary/30'
                        : 'bg-secondary/10 border-border/30 hover:bg-secondary/30'
                    }`}
                  >
                    <div className="w-full aspect-square rounded overflow-hidden bg-card flex items-center justify-center relative">
                      {proxyUrl ? (
                        <img
                          src={proxyUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <File size={16} className="text-gray-500" />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check size={20} className="text-primary drop-shadow" />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-400 truncate w-full text-center">{item.name}</span>
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
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedFile}
              className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-md bg-primary hover:bg-primary/80 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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