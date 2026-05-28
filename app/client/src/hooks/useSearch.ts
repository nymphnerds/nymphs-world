import { useState, useEffect, useRef, useCallback } from 'react';
import { searchFiles, SearchResult } from '../services/api';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    searchFiles(q.trim(), 50)
      .then((data) => {
        if (!abort.signal.aborted) {
          setResults(data.results);
          setError(null);
        }
      })
      .catch((err) => {
        if (!abort.signal.aborted) {
          setError(err.message || 'Search failed');
          setResults([]);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  // Debounce: wait 300ms after last keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
  };
}