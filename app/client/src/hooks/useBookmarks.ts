import { useState, useCallback, useMemo } from 'react';

interface Bookmark {
  id: string;
  label: string;
  timestamp: number;
}

/**
 * Custom hook for managing manual bookmarks per file.
 * Bookmarks are persisted in localStorage.
 */
export function useBookmarks() {
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, Bookmark[]>>({});

  const STORAGE_KEY = 'wobooks_map';

  // Load from localStorage on mount
  useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBookmarksMap(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  });

  const save = useCallback((map: Record<string, Bookmark[]>) => {
    setBookmarksMap(map);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const getBookmarks = useCallback((filePath: string): Bookmark[] => {
    return bookmarksMap[filePath] || [];
  }, [bookmarksMap]);

  const addBookmark = useCallback((filePath: string, label: string) => {
    const newBookmark: Bookmark = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      label: label || 'Untitled',
      timestamp: Date.now(),
    };
    const map = { ...bookmarksMap };
    if (!map[filePath]) map[filePath] = [];
    map[filePath] = [...map[filePath], newBookmark];
    save(map);
    return newBookmark;
  }, [bookmarksMap, save]);

  const removeBookmark = useCallback((filePath: string, bookmarkId: string) => {
    const map = { ...bookmarksMap };
    if (map[filePath]) {
      map[filePath] = map[filePath].filter(b => b.id !== bookmarkId);
      if (map[filePath].length === 0) delete map[filePath];
    }
    save(map);
  }, [bookmarksMap, save]);

  // Parse headings from HTML content
  const parseHeadings = useCallback((html: string) => {
    if (!html.trim()) return [];

    const headings: Array<{
      id: string;
      text: string;
      level: 1 | 2 | 3;
    }> = [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const headingEls = doc.querySelectorAll('h1, h2, h3');

    headingEls.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      const level = parseInt(tag[1]) as 1 | 2 | 3;
      const text = el.textContent?.trim() || '';
      if (text) {
        headings.push({
          id: `h-${idx}`,
          text,
          level,
        });
      }
    });

    return headings;
  }, []);

  return {
    getBookmarks,
    addBookmark,
    removeBookmark,
    parseHeadings,
  };
}