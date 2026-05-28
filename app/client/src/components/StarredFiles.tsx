import React from 'react';
import { Star, FileText, Trash2 } from 'lucide-react';

interface StarredFileItem {
  path: string;
  name: string;
}

interface StarredFilesProps {
  starredFiles: StarredFileItem[];
  onFileSelect: (path: string) => void;
  onRemoveStar: (path: string) => void;
}

const StarredFiles: React.FC<StarredFilesProps> = ({ starredFiles, onFileSelect, onRemoveStar }) => {
  return (
    <div className="starred-files-panel">
      <div className="starred-files-header">
        <h3>Starred Files</h3>
        <span className="starred-count">{starredFiles.length}</span>
      </div>

      {starredFiles.length === 0 ? (
        <div className="starred-empty">
          <Star size={32} className="starred-empty-icon" />
          <p className="starred-empty-text">No starred files yet</p>
          <p className="starred-empty-hint">Star files from the Explorer for quick access</p>
        </div>
      ) : (
        <div className="starred-list">
          {starredFiles.map((file) => (
            <div
              key={file.path}
              className="starred-file-row"
              onClick={() => onFileSelect(file.path)}
            >
              <div className="starred-file-info">
                <FileText size={14} className="starred-file-icon" />
                <span className="starred-file-name" title={file.path}>{file.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveStar(file.path);
                }}
                className="starred-remove-btn"
                title="Remove from starred"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StarredFiles;