import { useState, useEffect, useCallback } from 'react';
import { Folder, Image, ArrowLeft, Home, X, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { listFiles, signImageFromWorkspace } from '../services/api';
import type { FileItem } from '../services/api';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().lastIndexOf('.');
  if (ext === -1) return false;
  return IMAGE_EXTENSIONS.has(name.substring(ext));
}

interface ImageExplorerProps {
  onImageSelect: (url: string, path: string) => void;
  onClose: () => void;
  onGenerate?: () => void;
  baseFolder?: string;
}

export function ImageExplorer({ onImageSelect, onClose, onGenerate, baseFolder = '' }: ImageExplorerProps) {
  const [currentFolder, setCurrentFolder] = useState(baseFolder);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  // Map of file path → signed proxy URL for thumbnail display
  const [proxyUrls, setProxyUrls] = useState<Map<string, string>>(new Map());
  // Thumbnail size in pixels (30-200, default 80)
  const [thumbnailSize, setThumbnailSize] = useState(80);

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

      // Sign image paths for thumbnails
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

  const handleImageClick = (file: FileItem) => {
    const proxyUrl = proxyUrls.get(file.path);
    if (proxyUrl) {
      onImageSelect(proxyUrl, file.path);
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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <h3 className="text-xs font-semibold text-gray-200">Image Explorer</h3>
        <div className="flex items-center gap-1">
          {onGenerate && (
            <button
              onClick={onGenerate}
              className="p-1 rounded hover:bg-accent text-yellow-400 hover:text-yellow-300 transition-colors"
              title="Generate Image"
            >
              <Sparkles size={14} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-secondary/10 overflow-x-auto">
        <button
          onClick={handleRootClick}
          className="p-0.5 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors flex-shrink-0"
          title="Root"
        >
          <Home size={12} />
        </button>
        {breadcrumb.map((segment, index) => {
          const isLast = index === breadcrumb.length - 1;
          return (
            <div key={index} className="flex items-center gap-0.5">
              <span className="text-gray-500 text-[10px]">/</span>
              {isLast ? (
                <span className="text-white text-[10px] font-semibold">{segment}</span>
              ) : (
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="text-gray-300 hover:text-white text-[10px] transition-colors"
                >
                  {segment}
                </button>
              )}
            </div>
          );
        })}
        {!breadcrumb.length && <span className="text-gray-500 text-[10px]">Root</span>}

        {/* Thumbnail size slider */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <ZoomOut size={10} className="text-gray-500 flex-shrink-0" />
          <input
            type="range"
            min={30}
            max={200}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(Number(e.target.value))}
            className="w-16 h-1 accent-blue-400 cursor-pointer"
            title={`Thumbnail size: ${thumbnailSize}px`}
          />
          <ZoomIn size={10} className="text-gray-500 flex-shrink-0" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading...</div>
        ) : sortedFiles.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">No images in this folder</div>
        ) : (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize + 20}px, 1fr))` }}
          >
            {sortedFiles.map(item => {
              if (item.type === 'folder') {
                return (
                  <button
                    key={item.path}
                    onClick={() => handleFolderClick(item)}
                    className="flex flex-col items-center gap-1 p-2 rounded-md bg-secondary/20 hover:bg-secondary/40 border border-border/30 transition-colors min-h-0"
                    style={{ height: thumbnailSize + 60 }}
                  >
                    <Folder size={Math.max(16, Math.round(thumbnailSize * 0.3))} className="text-blue-400" />
                    <span className="text-[9px] text-gray-300 truncate w-full text-center">{item.name}</span>
                  </button>
                );
              }

              // Image file
              const proxyUrl = proxyUrls.get(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleImageClick(item)}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-md bg-secondary/10 border border-border/30 hover:bg-secondary/30 transition-colors min-h-0"
                  style={{ height: thumbnailSize + 40 }}
                >
                  <div
                    className="rounded overflow-hidden bg-card flex items-center justify-center flex-shrink-0"
                    style={{ width: thumbnailSize, height: thumbnailSize }}
                  >
                    {proxyUrl ? (
                      <img
                        src={proxyUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image size={Math.max(10, Math.round(thumbnailSize * 0.2))} className="text-gray-500" />
                    )}
                  </div>
                  <span className="text-[8px] text-gray-400 truncate w-full text-center">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-secondary/20">
        <button
          onClick={handleBack}
          disabled={!currentFolder}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={10} />
          Back
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 text-[10px] rounded-md bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}