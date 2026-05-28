import { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { compileStoryBible, CompileOptions } from '../services/api';
import type { FileItem } from '../services/api';

interface CompileStoryBibleModalProps {
  selectedFiles: FileItem[];
  currentFolder?: string;
  allFiles: FileItem[];
  onClose: () => void;
  onSuccess: (path: string, content: string) => void;
}

export function CompileStoryBibleModal({
  selectedFiles,
  currentFolder,
  allFiles,
  onClose,
  onSuccess,
}: CompileStoryBibleModalProps) {
  const [sourceMode, setSourceMode] = useState<'selected' | 'folder' | 'workspace'>('selected');
  const [orderBy, setOrderBy] = useState<'folder' | 'alphabetical' | 'modified'>('folder');
  const [includeToc, setIncludeToc] = useState(true);
  const [includeDividers, setIncludeDividers] = useState(true);
  const [includePaths, setIncludePaths] = useState(true);
  const [excludeMargin, setExcludeMargin] = useState(false);
  const [title, setTitle] = useState('My World - Story Bible');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderFiles = currentFolder
    ? allFiles.filter(f => f.path.startsWith(currentFolder + '/'))
    : allFiles;

  const handleCompile = async () => {
    setLoading(true);
    setError(null);
    try {
      const options: CompileOptions = {
        title,
        includeTableOfContents: includeToc,
        includeSectionDividers: includeDividers,
        includeFilePaths: includePaths,
        excludeMarginNotes: excludeMargin,
        orderBy,
      };

      if (sourceMode === 'selected') {
        options.files = selectedFiles.filter(f => f.type === 'file').map(f => f.path);
      } else if (sourceMode === 'folder' && currentFolder) {
        options.folders = [currentFolder];
      } else if (sourceMode === 'workspace') {
        options.entireWorkspace = true;
      }

      const result = await compileStoryBible(options);
      onSuccess(result.path, result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compilation failed');
    } finally {
      setLoading(false);
    }
  };

  const fileCount = sourceMode === 'selected'
    ? selectedFiles.filter(f => f.type === 'file').length
    : sourceMode === 'folder'
      ? folderFiles.filter(f => f.type === 'file').length
      : allFiles.filter(f => f.type === 'file').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: '440px' }}>
        <div className="modal-header">
          <h2>Compile Story Bible</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Source selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
              Source
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source"
                  checked={sourceMode === 'selected'}
                  onChange={() => setSourceMode('selected')}
                />
                Selected files ({selectedFiles.filter(f => f.type === 'file').length} files)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source"
                  checked={sourceMode === 'folder'}
                  onChange={() => setSourceMode('folder')}
                />
                Entire folder: {currentFolder || '/'} ({folderFiles.filter(f => f.type === 'file').length} files)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source"
                  checked={sourceMode === 'workspace'}
                  onChange={() => setSourceMode('workspace')}
                />
                Entire workspace ({allFiles.filter(f => f.type === 'file').length} files)
              </label>
            </div>
          </div>

          {/* Order by */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
              Order by
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(['folder', 'alphabetical', 'modified'] as const).map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="order"
                    checked={orderBy === opt}
                    onChange={() => setOrderBy(opt)}
                  />
                  {opt === 'folder' ? 'Folder structure' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Include options */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
              Include
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeToc} onChange={() => setIncludeToc(!includeToc)} />
                Table of Contents
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeDividers} onChange={() => setIncludeDividers(!includeDividers)} />
                Section dividers
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includePaths} onChange={() => setIncludePaths(!includePaths)} />
                File paths as subtitles
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={excludeMargin} onChange={() => setExcludeMargin(!excludeMargin)} />
                Exclude margin notes
              </label>
            </div>
          </div>

          {/* Output name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--foreground-muted)' }}>
              Output name
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-field"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: 'var(--error)', marginBottom: '8px', fontSize: '13px' }}>{error}</p>}

          {/* Summary */}
          <div style={{
            padding: '8px 12px',
            background: 'var(--surface)',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--foreground-muted)',
          }}>
            Will compile ~{fileCount} documents
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleCompile}
              disabled={loading || fileCount === 0}
            >
              {loading ? 'Compiling...' : 'Compile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}