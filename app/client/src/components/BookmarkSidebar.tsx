import React, { useCallback } from 'react';
import { Bookmark as BookmarkIcon, BookOpen, X } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface Bookmark {
  id: string;
  label: string;
  timestamp: number;
}

interface BookmarkSidebarProps {
  content: string;
  currentPath: string | null;
  headings: Heading[];
  bookmarks: Bookmark[];
  onNavigateToHeading: (text: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  width: number;
}

export function BookmarkSidebar({
  content,
  currentPath,
  headings,
  bookmarks,
  onNavigateToHeading,
  onRemoveBookmark,
  width,
}: BookmarkSidebarProps) {
  const handleHeadingClick = useCallback((text: string) => {
    onNavigateToHeading(text);
  }, [onNavigateToHeading]);

  const getHeadingPrefix = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return 'H1';
      case 2: return 'H2';
      case 3: return 'H3';
    }
  };

  const getHeadingIndent = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return '0rem';
      case 2: return '0.75rem';
      case 3: return '1.5rem';
    }
  };

  if (!currentPath) {
    return (
      <div
        className="bookmark-sidebar"
        style={{ width, minWidth: width, overflow: 'hidden' }}
      >
        <div className="bookmark-sidebar-header">
          <div className="bookmark-sidebar-title">
            <BookOpen size={14} />
            <span>OUTLINE</span>
          </div>
        </div>
        <div className="bookmark-sidebar-content empty-state">
          <span>No file open</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bookmark-sidebar"
      style={{ width, minWidth: width, overflow: 'hidden' }}
    >
      <div className="bookmark-sidebar-header">
        <div className="bookmark-sidebar-title">
          <BookOpen size={14} />
          <span>OUTLINE</span>
        </div>
      </div>

      <div className="bookmark-sidebar-content">
        {/* Chapters Section */}
        {headings.length > 0 && (
          <div className="bookmark-section">
            <div className="bookmark-section-label">
              <BookOpen size={11} />
              <span>Chapters</span>
              <span className="bookmark-count">{headings.length}</span>
            </div>
            <div className="bookmark-list">
              {headings.map((h) => (
                <button
                  key={h.id}
                  className="bookmark-item"
                  style={{ paddingLeft: getHeadingIndent(h.level) }}
                  onClick={() => handleHeadingClick(h.text)}
                  title={`Navigate to "${h.text}"`}
                >
                  <span className="bookmark-level-badge" title={`Heading ${h.level}`}>
                    {getHeadingPrefix(h.level)}
                  </span>
                  <span className="bookmark-text">{h.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Bookmarks Section */}
        {bookmarks.length > 0 && (
          <div className="bookmark-section">
            <div className="bookmark-section-label">
              <BookmarkIcon size={11} />
              <span>Bookmarks</span>
              <span className="bookmark-count">{bookmarks.length}</span>
            </div>
            <div className="bookmark-list">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="bookmark-item bookmark-manual"
                >
                  <BookmarkIcon size={12} className="bookmark-pin-icon" />
                  <span className="bookmark-text">{bm.label}</span>
                  <button
                    className="bookmark-remove-btn"
                    onClick={() => onRemoveBookmark(bm.id)}
                    title="Remove bookmark"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {headings.length === 0 && bookmarks.length === 0 && (
          <div className="bookmark-empty">
            <BookOpen size={20} className="bookmark-empty-icon" />
            <p>No headings found in this document.</p>
            <p className="bookmark-hint">
              Use H1, H2, or H3 headings to build the outline.
            </p>
            <p className="bookmark-hint">
              Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> to pin a bookmark.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookmarkSidebar;