import { useEffect, useState, useRef, useCallback, KeyboardEvent } from 'react';
import { searchWikiLinks } from '../services/api';
import type { WikiLinkSearchResult } from '../services/api';

interface WikiLinkAutocompleteProps {
  query: string;
  anchorRect: DOMRect;
  onSelect?: (result: WikiLinkSearchResult) => void;
  onCreate?: (name: string) => void;
  onClose?: () => void;
}

export function WikiLinkAutocomplete({ query, anchorRect, onSelect, onCreate, onClose }: WikiLinkAutocompleteProps) {
  const [results, setResults] = useState<WikiLinkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch results when query changes
  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      if (!query || query.length < 1) {
        if (!cancelled) {
          setResults(await searchWikiLinks('', 10));
        }
        return;
      }
      setLoading(true);
      try {
        const data = await searchWikiLinks(query, 10);
        if (!cancelled) {
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timeout = setTimeout(fetch, 150);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const totalItems = results.length + 1; // +1 for "Create..." option

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < results.length) {
        onSelect?.(results[selectedIndex]);
      } else {
        // "Create..." option selected
        onCreate?.(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  }, [results, selectedIndex, query, onSelect, onCreate, onClose]);

  // Position: below the anchor
  const position = useCallback(() => {
    const gap = 4;
    let top = anchorRect.bottom + gap;
    let left = anchorRect.left;

    const estimatedWidth = 320;
    const viewportWidth = window.innerWidth;

    if (left + estimatedWidth > viewportWidth - 16) {
      left = viewportWidth - estimatedWidth - 16;
    }
    if (left < 8) left = 8;

    return { top, left };
  }, [anchorRect]);

  const pos = position();

  return (
    <div
      ref={containerRef}
      className="wiki-link-autocomplete"
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex: 10001,
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="text-[10px] text-muted-foreground/40 px-3 pt-2 pb-1 uppercase tracking-wider">
        {query ? `Search: "${query}"` : 'Search documents...'}
      </div>

      <div className="max-h-60 overflow-y-auto">
        {loading && results.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-muted-foreground/50 text-center">Searching...</div>
        ) : results.length === 0 && query ? (
          <div className="px-3 py-4 text-[11px] text-muted-foreground/50 text-center">No matches</div>
        ) : (
          results.map((result, index) => (
            <div
              key={result.path}
              className={`wiki-link-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect?.(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="text-[12px] text-foreground font-medium">{result.name}</div>
              {result.folder && (
                <div className="text-[10px] text-muted-foreground/50 truncate">{result.folder}</div>
              )}
            </div>
          ))
        )}

        {/* "Create..." option */}
        {query && query.length >= 2 && (
          <div
            className={`wiki-link-autocomplete-item wiki-link-autocomplete-create ${results.length === selectedIndex ? 'selected' : ''}`}
            onClick={() => onCreate?.(query)}
            onMouseEnter={() => setSelectedIndex(results.length)}
          >
            <div className="text-[12px] text-amber-400/80">
              Create "{query}"...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}