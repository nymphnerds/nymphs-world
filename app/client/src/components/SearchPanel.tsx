import React, { useCallback } from 'react';
import { FileText } from 'lucide-react';
import { SearchResult, SearchMatch } from '../services/api';

interface SearchPanelProps {
  width: number;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  onFileOpen: (path: string) => void;
}

/** Get the first real content snippet (skip "Name matches:" lines) */
function getSnippet(result: SearchResult): string {
  for (const m of result.matches) {
    if (!m.context.startsWith('Name matches:')) {
      return m.context;
    }
  }
  return '';
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  width,
  query,
  onQueryChange,
  results,
  loading,
  error,
  onFileOpen,
}) => {
  const handleFileClick = useCallback((path: string) => {
    onFileOpen(path);
  }, [onFileOpen]);

  return (
    <div className="search-panel" style={{ width }}>
      <div className="search-panel-header">
        <h2>SEARCH</h2>
      </div>
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Search in files..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {loading && <span className="search-loading">Searching...</span>}
      </div>

      <div className="search-results">
        {error && (
          <div className="search-error">{error}</div>
        )}

        {!loading && !error && query.trim() && results.length === 0 && (
          <div className="search-empty">No results found</div>
        )}

        {!loading && !query.trim() && (
          <div className="search-empty">Type to search across all files</div>
        )}

        {results.map((result: SearchResult, idx: number) => {
          const snippet = getSnippet(result);
          return (
            <div
              key={idx}
              className="search-result-row"
              onClick={() => handleFileClick(result.path)}
              title={result.path}
            >
              <span className="search-result-dot"></span>
              <div className="search-result-content">
                <div className="search-result-header">
                  <span className="search-result-name">{result.name}</span>
                </div>
                <div className="search-result-path">{result.path}</div>
                {snippet && (
                  <div className="search-result-snippet">{snippet}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SearchPanel;