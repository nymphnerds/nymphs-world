import React, { useState, useEffect } from 'react';
import { useTags, useFileTags, useTagQueries } from '../hooks/useTags';

interface TagManagerProps {
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  defaultShowAddTag?: boolean;
}

const TagManager: React.FC<TagManagerProps> = ({ activeFilePath, onFileSelect, defaultShowAddTag }) => {
  const { tags, loading: tagsLoading, createTag: createTagAction, updateTag: updateTagAction, deleteTag: deleteTagAction, getByColor } = useTags();
  const { fileTags, availableTags, addTags, removeTag, getTagColor } = useFileTags(activeFilePath);
  const { filesByTag, fetchFilesByTag, loading: queryLoading } = useTagQueries();

  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#a78bfa');
  const [showAddTag, setShowAddTag] = useState(!!defaultShowAddTag);

  // Sync showAddTag when defaultShowAddTag changes (e.g. from toolbar + button)
  useEffect(() => {
    if (defaultShowAddTag) {
      setShowAddTag(true);
    }
  }, [defaultShowAddTag]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleFilterTag = async (tagName: string) => {
    if (selectedTagFilter === tagName) {
      setSelectedTagFilter(null);
      return;
    }
    setSelectedTagFilter(tagName);
    await fetchFilesByTag(tagName);
  };

  const handleAddTagToFile = async (tagName: string) => {
    if (activeFilePath) {
      await addTags([tagName]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTagAction(newTagName.trim(), newTagColor, '');
      setNewTagName('');
      setNewTagColor('#a78bfa');
      setShowAddTag(false);
    } catch (err) {
      // error handled in hook
    }
  };

  const handleStartEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingTagId || !editName.trim()) return;
    try {
      await updateTagAction(editingTagId, { name: editName.trim(), color: editColor });
      setEditingTagId(null);
    } catch (err) {
      // error handled in hook
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (confirm('Delete this tag? It will be removed from all files.')) {
      await deleteTagAction(id);
    }
  };

  return (
    <div className="tag-manager">
      <div className="tag-manager-header">
        <h3>Tags</h3>
        <button
          className="tag-add-btn"
          onClick={() => setShowAddTag(!showAddTag)}
          title="Add Tag"
        >
          +
        </button>
      </div>

      {/* Create new tag form */}
      {showAddTag && (
        <div className="tag-create-form">
          <input
            type="text"
            placeholder="Tag name"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            className="tag-input"
            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
          />
          <input
            type="color"
            value={newTagColor}
            onChange={e => setNewTagColor(e.target.value)}
            className="tag-color-picker"
            title="Tag color"
          />
          <button onClick={handleCreateTag} className="tag-create-confirm" disabled={!newTagName.trim()}>
            Add
          </button>
        </div>
      )}

      {/* Active file tags */}
      {activeFilePath && (
        <div className="tag-section">
          <h4>Active Document</h4>
          <div className="tag-list">
            {fileTags.map(tagName => (
              <span
                key={tagName}
                className="tag-badge tag-badge-active"
                style={{ backgroundColor: getTagColor(tagName) + '33', borderColor: getTagColor(tagName), color: getTagColor(tagName) }}
                title={`Click to remove "${tagName}"`}
                onClick={() => removeTag(tagName)}
              >
                {tagName}
                <span className="tag-remove">&times;</span>
              </span>
            ))}
          </div>
          {availableTags.length > 0 && (
            <>
              <h4 style={{ marginTop: '8px' }}>Add Tag</h4>
              <div className="tag-list tag-list-scroll">
                {availableTags.map(tag => (
                  <span
                    key={tag.name}
                    className="tag-badge tag-badge-add"
                    style={{ backgroundColor: tag.color + '22', borderColor: tag.color }}
                    title={`Click to add "${tag.name}"`}
                    onClick={() => handleAddTagToFile(tag.name)}
                  >
                    <span className="tag-dot" style={{ backgroundColor: tag.color }}></span>
                    {tag.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* All tags with file counts */}
      <div className="tag-section">
        <h4>All Tags</h4>
        {tagsLoading ? (
          <div className="tag-loading">Loading...</div>
        ) : (
          <div className="tag-list tag-list-scroll">
            {tags.map(tag => (
              <div key={tag.id} className="tag-row">
                {editingTagId === tag.id ? (
                  <div className="tag-edit-form">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="tag-edit-input"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="tag-color-picker"
                    />
                    <button onClick={handleSaveEdit} className="tag-edit-save">✓</button>
                    <button onClick={() => setEditingTagId(null)} className="tag-edit-cancel">✗</button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`tag-filter-btn ${selectedTagFilter === tag.name ? 'active' : ''}`}
                      style={{ color: tag.color }}
                      onClick={() => handleFilterTag(tag.name)}
                      title={`Show files tagged "${tag.name}"`}
                    >
                      <span className="tag-dot" style={{ backgroundColor: tag.color }}></span>
                      {tag.name}
                    </button>
                    <div className="tag-actions">
                      <button onClick={() => handleStartEdit(tag)} title="Edit" className="tag-action-btn">✎</button>
                      <button onClick={() => handleDeleteTag(tag.id)} title="Delete" className="tag-action-btn tag-action-delete">🗑</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files filtered by tag */}
      {selectedTagFilter && (
        <div className="tag-section">
          <h4>
            Files: {selectedTagFilter} ({filesByTag.length})
            <button className="tag-clear-filter" onClick={() => setSelectedTagFilter(null)}>✕</button>
          </h4>
          {queryLoading ? (
            <div className="tag-loading">Loading...</div>
          ) : (
            <div className="tag-file-list">
              {filesByTag.map(file => (
                <button
                  key={file.path}
                  className="tag-file-item"
                  onClick={() => onFileSelect(file.path)}
                  title={file.path}
                >
                  {file.name}
                </button>
              ))}
              {filesByTag.length === 0 && (
                <div className="tag-empty">No files with this tag</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagManager;