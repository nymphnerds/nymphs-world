import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', async () => ({
  searchFiles: vi.fn(),
}));

import * as api from '../services/api';
const mockSearchFiles = api.searchFiles as ReturnType<typeof vi.fn>;
import { useSearch } from './useSearch';

beforeEach(() => {
  mockSearchFiles.mockReset();
  mockSearchFiles.mockResolvedValue({ results: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSearch', () => {
  it('should start with empty query and results', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should search and return results', async () => {
    const mockResults = {
      results: [
        { path: '/file1.txt', name: 'file1.txt', match_count: 1 },
        { path: '/file2.md', name: 'file2.md', match_count: 2 },
      ],
    };
    mockSearchFiles.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results).toHaveLength(2);
      expect(result.current.results[0].path).toBe('/file1.txt');
    });
    expect(mockSearchFiles).toHaveBeenCalledWith('test', 50);
  });

  it('should clear results when query is empty', async () => {
    mockSearchFiles.mockResolvedValue({ results: [{ path: '/a.txt', name: 'a.txt', match_count: 1 }] });

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('hello');
    });

    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => {
      result.current.setQuery('');
    });

    // Empty query clears results synchronously (no API call)
    await waitFor(() => {
      expect(result.current.results).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  it('should set error on search failure', async () => {
    mockSearchFiles.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('fail');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('API error');
      expect(result.current.results).toEqual([]);
    });
  });

  it('should update query state correctly', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('my query');
    });

    expect(result.current.query).toBe('my query');
  });
});