import { useState, useCallback, useRef, useEffect } from 'react';
import { Folder, File, ChevronRight, Trash2, Pencil, ArrowLeft, Plus, Home, Upload, Copy, ArrowRightLeft, Star, ChevronDown, X, BookOpen, Undo2, Redo2, CheckSquare, Square, Layers } from 'lucide-react';
import type { FileItem } from '../services/api';
import { useTags } from '../hooks/useTags';
import { InlineRenameInput } from './InlineRenameInput';

interface StarredFile {
  path: string;
  name: string;
}

interface FileExplorerProps {
  files: FileItem[];
  explorerPath: string;
  currentPath: string | null;
  loading: boolean;
  onFileSelect: (file: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onRename: (item: FileItem, newName: string) => void;
  onCopy: (item: FileItem) => void;
  onMove: (item: FileItem) => void;
  onBack: () => void;
  onBackToRoot: () => void;
  onBackToSegment: (path: string) => void;
  onNewFolder: () => void;
  onUploadFiles: (files: FileList) => void;
  onCompile: () => void;
  width: number;
  starredFiles: StarredFile[];
  onToggleStar: (path: string) => void;
  isStarred: (path: string) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Batch operation props
  selectionMode: boolean;
  selectedPaths: Set<string>;
  onToggleSelectionMode: () => void;
  onToggleSelect: (path: string) => void;
  onSelectAll: (items: FileItem[]) => void;
  onClearSelection: () => void;
  onBatchDelete: (paths: string[]) => void;
  onBatchCopy: (paths: string[]) => void;
  onBatchMove: (paths: string[]) => void;
}

export function FileExplorer({
  files,
  explorerPath,
  currentPath,
  loading,
  onFileSelect,
  onDelete,
  onRename,
  onCopy,
  onMove,
  onBack,
  onBackToRoot,
  onBackToSegment,
  onNewFolder,
  onUploadFiles,
  onCompile,
  width,
  starredFiles,
  onToggleStar,
  isStarred,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  // Batch operation props
  selectionMode,
  selectedPaths,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchCopy,
  onBatchMove,
}: FileExplorerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  }, [onUploadFiles]);
  // Hide system-generated support files
  const isSystemFile = (name: string) => /\.wbu_meta\.json$/i.test(name);

  // Strip .html extension for display — files are stored as .html but shown without extension
  const displayName = (name: string) => name.replace(/\.html$/i, '');

  const sortedFiles = [...files].filter(f => !isSystemFile(f.name)).sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  // Inline rename state
  const [renamingItemPath, setRenamingItemPath] = useState<string | null>(null);

  const handleStartRename = useCallback((item: FileItem) => {
    setRenamingItemPath(item.path);
  }, []);

  const handleInlineRenameConfirm = useCallback((itemPath: string, newName: string) => {
    const item = sortedFiles.find(f => f.path === itemPath);
    if (item && newName && newName !== item.name) {
      onRename(item, newName);
    }
    setRenamingItemPath(null);
  }, [sortedFiles, onRename]);

  const handleInlineRenameCancel = useCallback(() => {
    setRenamingItemPath(null);
  }, []);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getByColor } = useTags();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keys when typing in editor, input, or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.tiptap')
      ) return;

      if (sortedFiles.length === 0) return;

      // Ctrl/Cmd+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectionMode) {
        e.preventDefault();
        onSelectAll(sortedFiles);
        return;
      }

      // Esc: Clear selection and exit selection mode
      if (e.key === 'Escape' && selectionMode) {
        e.preventDefault();
        onClearSelection();
        onToggleSelectionMode();
        return;
      }

      // Delete: Batch delete selected
      if (e.key === 'Delete' && selectionMode && selectedPaths.size > 0) {
        e.preventDefault();
        onBatchDelete(Array.from(selectedPaths));
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, sortedFiles.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const item = sortedFiles[focusedIndex];
        if (selectionMode) {
          onToggleSelect(item.path);
        } else {
          onFileSelect(item);
        }
      } else if (e.key === 'Backspace' && focusedIndex >= 0 && !selectionMode) {
        e.preventDefault();
        onDelete(sortedFiles[focusedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedFiles, focusedIndex, onFileSelect, onDelete, selectionMode, selectedPaths, onToggleSelect, onSelectAll, onClearSelection, onToggleSelectionMode, onBatchDelete]);

  // Reset focus when files change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [explorerPath]);

  // Collapsible starred section
  const [starredCollapsed, setStarredCollapsed] = useState(false);

  // Build breadcrumb path segments
  const pathSegments = explorerPath ? explorerPath.split('/').filter(Boolean) : [];

  // Build a map of starred paths for quick lookup
  const starredPaths = new Set(starredFiles.map(s => s.path));

  // Count selected items in current view
  const selectedCount = sortedFiles.filter(f => selectedPaths.has(f.path)).length;
  const allVisibleSelected = sortedFiles.length > 0 && selectedCount === sortedFiles.length;

  return (
     <div
        className="flex flex-col bg-card border-r border-border overflow-hidden text-gray-200"
       style={{ width }}
     >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-400">
        <span className="flex items-center gap-2">
          Explorer
          {selectionMode && (
            <span className="text-primary font-normal normal-case tracking-normal">
              ({selectedPaths.size} selected)
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {/* Selection Mode Toggle */}
          <button
            onClick={onToggleSelectionMode}
            className={`p-0.5 rounded transition-colors ${selectionMode ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-gray-400 hover:text-white'}`}
            title={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
          >
            <Layers size={14} />
          </button>
          <div className="w-px h-3 bg-border mx-0.5" />
          {/* File Undo/Redo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-0.5 rounded transition-colors ${canUndo ? 'hover:bg-accent text-gray-400 hover:text-white' : 'opacity-30'}`}
            title="Undo file operation"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-0.5 rounded transition-colors ${canRedo ? 'hover:bg-accent text-gray-400 hover:text-white' : 'opacity-30'}`}
            title="Redo file operation"
          >
            <Redo2 size={14} />
          </button>
          <div className="w-px h-3 bg-border mx-0.5" />
          <button
            onClick={onNewFolder}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="New folder"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleUploadClick}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Upload file"
          >
            <Upload size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={onCompile}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Compile Story Bible"
          >
            <BookOpen size={14} />
          </button>
          {explorerPath && (
            <button
              onClick={onBack}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title="Go back"
            >
              <ArrowLeft size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb navigation bar */}
      {explorerPath && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={onBackToRoot}
            className="p-0.5 rounded hover:bg-accent transition-colors text-gray-400 hover:text-white"
            title="Go to root"
          >
            <Home size={13} />
          </button>
          {pathSegments.map((segment, index) => {
            const segmentPath = pathSegments.slice(0, index + 1).join('/');
            const isLast = index === pathSegments.length - 1;
            return (
              <div key={segmentPath} className="flex items-center gap-1.5">
                <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                {isLast ? (
                  <span className="text-white font-semibold text-sm truncate">{segment}</span>
                ) : (
                  <button
                    onClick={() => onBackToSegment(segmentPath)}
                    className="text-gray-300 hover:text-white transition-colors truncate text-xs"
                  >
                    {segment}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

       <div className="flex-1 overflow-y-auto py-1" ref={containerRef}>
          {/* Starred / Favorites quick-access section */}
          {starredFiles.length > 0 && (
            <div className="mb-1">
              <button
                onClick={() => setStarredCollapsed(!starredCollapsed)}
                className="flex items-center gap-1 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 transition-colors"
              >
                <ChevronDown size={12} className={`transition-transform ${starredCollapsed ? '-rotate-90' : ''}`} />
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span>Favorites</span>
              </button>
              {!starredCollapsed && (
                <div className="mb-1">
                  {starredFiles.map(starred => (
                    <StarredFileRow
                      key={starred.path}
                      starred={starred}
                      currentPath={currentPath}
                      onSelect={onFileSelect}
                      onToggleStar={onToggleStar}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Select All checkbox row (only in selection mode) */}
          {selectionMode && sortedFiles.length > 0 && (
            <div className="px-2 py-1 text-xs flex items-center gap-1 text-gray-400">
              <button
                onClick={() => {
                  if (allVisibleSelected) {
                    onClearSelection();
                  } else {
                    onSelectAll(sortedFiles);
                  }
                }}
                className="flex items-center gap-1 hover:text-white transition-colors"
                title={allVisibleSelected ? 'Deselect all' : 'Select all'}
              >
                {allVisibleSelected ? (
                  <CheckSquare size={12} className="text-primary" />
                ) : (
                  <Square size={12} />
                )}
                <span>{allVisibleSelected ? 'Deselect All' : `Select All (${sortedFiles.length})`}</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="px-3 py-4 text-xs text-gray-400">Loading...</div>
          ) : sortedFiles.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400">Empty folder</div>
          ) : (
             sortedFiles.map(item => (
                 <FileItemRow
                   key={item.path}
                   item={item}
                   currentPath={currentPath}
                   onSelect={onFileSelect}
                   onDelete={onDelete}
                   onStartRename={() => handleStartRename(item)}
                   onCopy={() => onCopy(item)}
                   onMove={() => onMove(item)}
                   onToggleStar={onToggleStar}
                   isStarred={starredPaths.has(item.path)}
                   getTagColor={getByColor}
                   selectionMode={selectionMode}
                   isSelected={selectedPaths.has(item.path)}
                   onToggleSelect={() => onToggleSelect(item.path)}
                   isRenaming={renamingItemPath === item.path}
                   onInlineRenameConfirm={(newName) => handleInlineRenameConfirm(item.path, newName)}
                   onInlineRenameCancel={handleInlineRenameCancel}
                 />
             ))
         )}
       </div>

       {/* Batch Action Bar - shown when items are selected */}
       {selectedPaths.size > 0 && (
         <div className="px-3 py-2 border-t border-border bg-card/80 flex items-center gap-2">
           <span className="text-xs text-gray-400 flex-shrink-0">
             {selectedPaths.size} item{selectedPaths.size > 1 ? 's' : ''}
           </span>
           <div className="flex-1" />
           <button
             onClick={() => onBatchCopy(Array.from(selectedPaths))}
             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary/30 hover:bg-secondary/50 text-gray-300 hover:text-white transition-colors"
             title="Copy selected"
           >
             <Copy size={12} />
             <span>Copy</span>
           </button>
           <button
             onClick={() => onBatchMove(Array.from(selectedPaths))}
             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary/30 hover:bg-secondary/50 text-gray-300 hover:text-white transition-colors"
             title="Move selected"
           >
             <ArrowRightLeft size={12} />
             <span>Move</span>
           </button>
           <button
             onClick={() => onBatchDelete(Array.from(selectedPaths))}
             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-destructive/20 hover:bg-destructive/40 text-red-400 hover:text-red-300 transition-colors"
             title="Delete selected"
           >
             <Trash2 size={12} />
             <span>Delete</span>
           </button>
           <button
             onClick={onClearSelection}
             className="p-1 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors"
             title="Clear selection"
           >
             <X size={12} />
           </button>
         </div>
        )}

      </div>
    );
}

function StarredFileRow({
  starred,
  currentPath,
  onSelect,
  onToggleStar,
}: {
  starred: StarredFile;
  currentPath: string | null;
  onSelect: (file: FileItem) => void;
  onToggleStar: (path: string) => void;
}) {
  const isActive = currentPath === starred.path;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-0.5 text-sm cursor-pointer transition-colors text-gray-200 ${
        isActive ? 'bg-primary/20 text-primary' : 'hover:bg-accent hover:text-white'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect({ name: starred.name, path: starred.path, type: 'file' } as FileItem)}
    >
      <Star size={14} className="text-yellow-400 fill-yellow-400" />
      <File size={14} className="text-gray-400" />
      <span className="flex-1 truncate">{starred.name}</span>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(starred.path); }}
          className="p-0.5 rounded text-yellow-400 hover:text-red-400 transition-colors"
          title="Remove from favorites"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function FileItemRow({
  item,
  currentPath,
  onSelect,
  onDelete,
  onStartRename,
  onCopy,
  onMove,
  onToggleStar,
  isStarred,
  getTagColor,
  selectionMode,
  isSelected,
  onToggleSelect,
  isRenaming,
  onInlineRenameConfirm,
  onInlineRenameCancel,
}: {
  item: FileItem;
  currentPath: string | null;
  onSelect: (file: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onStartRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onToggleStar: (path: string) => void;
  isStarred: boolean;
  getTagColor?: (tagName: string) => string;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isRenaming: boolean;
  onInlineRenameConfirm: (newName: string) => void;
  onInlineRenameCancel: () => void;
}) {
  const isActive = currentPath === item.path;
  const [hovered, setHovered] = useState(false);

  // Strip .html extension for display
  const displayName = (name: string) => name.replace(/\.html$/i, '');

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      onToggleSelect();
    } else {
      onSelect(item);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectionMode) {
      onStartRename();
    }
  };

  return (
      <div
        className={`group flex items-center gap-1 px-2 py-0.5 text-sm cursor-pointer transition-colors text-gray-200 ${
          isSelected
            ? 'bg-primary/30 text-white'
            : isActive
              ? 'bg-primary/20 text-primary'
              : 'hover:bg-accent hover:text-white'
        }`}
       onMouseEnter={() => setHovered(true)}
       onMouseLeave={() => setHovered(false)}
       onClick={handleClick}
       onDoubleClick={handleDoubleClick}
      >
       {/* Selection checkbox */}
       {selectionMode && (
         <button
           onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
           className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-accent"
           title={isSelected ? 'Deselect' : 'Select'}
         >
           {isSelected ? (
             <CheckSquare size={13} className="text-primary" />
           ) : (
             <Square size={13} className="text-gray-500" />
           )}
         </button>
       )}

       {/* Selection indicator when not in full selection mode but item is selected */}
       {isSelected && !selectionMode && (
         <CheckSquare size={13} className="text-primary flex-shrink-0" />
       )}

       {item.type === 'folder' ? (
         <Folder size={14} className="text-blue-400 flex-shrink-0" />
       ) : (
          <File size={14} className="text-gray-400 flex-shrink-0" />
       )}

         {isRenaming ? (
           <InlineRenameInput
             value={displayName(item.name)}
             onConfirm={(newName) => {
               // If user didn't add an extension, keep .html
               const finalName = newName.includes('.') ? newName : `${newName}.html`;
               onInlineRenameConfirm(finalName);
             }}
             onCancel={onInlineRenameCancel}
           />
         ) : (
           <span className="flex-1 truncate">{displayName(item.name)}</span>
         )}

       {/* Tag badges */}
       {item.tags && item.tags.length > 0 && getTagColor && (
         <span className="explorer-tag-badges">
           {item.tags.map(tag => (
             <span
               key={tag}
               className="explorer-tag-badge"
               style={{ backgroundColor: getTagColor(tag) }}
               title={tag}
             />
           ))}
         </span>
       )}

       {hovered && !selectionMode && (
         <>
           {item.type === 'file' && (
             <button
               onClick={(e) => { e.stopPropagation(); onToggleStar(item.path); }}
               className={`p-0.5 rounded transition-colors ${isStarred ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
               title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
             >
               <Star size={12} className={isStarred ? 'fill-yellow-400' : ''} />
             </button>
           )}
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename(); }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
           <button
             onClick={(e) => { e.stopPropagation(); onCopy(); }}
             className="p-0.5 rounded text-muted-foreground hover:text-foreground"
             title="Copy"
           >
             <Copy size={12} />
           </button>
           <button
             onClick={(e) => { e.stopPropagation(); onMove(); }}
             className="p-0.5 rounded text-muted-foreground hover:text-foreground"
             title="Move"
           >
             <ArrowRightLeft size={12} />
           </button>
           <button
             onClick={(e) => { e.stopPropagation(); onDelete(item); }}
             className="p-0.5 rounded text-muted-foreground hover:text-destructive"
             title="Delete"
           >
             <Trash2 size={12} />
           </button>
         </>
       )}
     </div>
   );
}