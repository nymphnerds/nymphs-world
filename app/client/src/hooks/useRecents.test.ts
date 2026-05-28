import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', async () => ({
  getUserRecents: vi.fn(),
  getUserStarred: vi.fn(),
  saveUserRecents: vi.fn(),
  saveUserStarred: vi.fn(),
}));

import * as api from '../services/api';
const mockGetUserRecents = api.getUserRecents as ReturnType<typeof vi.fn>;
const mockGetUserStarred = api.getUserStarred as ReturnType<typeof vi.fn>;
const mockSaveUserRecents = api.saveUserRecents as ReturnType<typeof vi.fn>;
const mockSaveUserStarred = api.saveUserStarred as ReturnType<typeof vi.fn>;
import { useRecents } from './useRecents';

function resetMocks() {
  mockGetUserRecents.mockReset();
  mockGetUserStarred.mockReset();
  mockSaveUserRecents.mockReset();
  mockSaveUserStarred.mockReset();
  // Default: return empty arrays
  mockGetUserRecents.mockResolvedValue([]);
  mockGetUserStarred.mockResolvedValue([]);
  mockSaveUserRecents.mockResolvedValue(undefined);
  mockSaveUserStarred.mockResolvedValue(undefined);
}

beforeEach(() => {
  resetMocks();
});

describe('useRecents', () => {
  it('should start with loading=true and empty arrays', async () => {
    const { result } = renderHook(() => useRecents());
    expect(result.current.loading).toBe(true);
    expect(result.current.recentFiles).toEqual([]);
    expect(result.current.starredFiles).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('should load recents and starred from server on mount', async () => {
    const mockRecents = [{ path: '/a.txt', name: 'a.txt', lastOpened: 1 }];
    const mockStarred = [{ path: '/b.txt', name: 'b.txt' }];
    mockGetUserRecents.mockResolvedValue(mockRecents);
    mockGetUserStarred.mockResolvedValue(mockStarred);

    const { result } = renderHook(() => useRecents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.recentFiles).toEqual(mockRecents);
      expect(result.current.starredFiles).toEqual(mockStarred);
    });
  });

  it('should handle server error on mount gracefully', async () => {
    mockGetUserRecents.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useRecents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.recentFiles).toEqual([]);
      expect(result.current.starredFiles).toEqual([]);
    });
  });

  it('addRecentFile should add to front, most recent first', async () => {
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addRecentFile('/docs/readme.md');
    });

    expect(result.current.recentFiles).toHaveLength(1);
    expect(result.current.recentFiles[0].path).toBe('/docs/readme.md');
    expect(result.current.recentFiles[0].name).toBe('readme.md');
  });

  it('addRecentFile should move existing item to front without duplicate', async () => {
    const existing = [{ path: '/old.txt', name: 'old.txt', lastOpened: 1 }];
    mockGetUserRecents.mockResolvedValue(existing);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Add a new one, then add the old one again
    act(() => {
      result.current.addRecentFile('/new.txt');
      result.current.addRecentFile('/old.txt'); // move to front
    });

    expect(result.current.recentFiles).toHaveLength(2);
    expect(result.current.recentFiles[0].path).toBe('/old.txt');
    expect(result.current.recentFiles[1].path).toBe('/new.txt');
  });

  it('addRecentFile should cap at MAX_RECENTS (10)', async () => {
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (let i = 0; i < 15; i++) {
      act(() => {
        result.current.addRecentFile(`/file${i}.txt`);
      });
    }

    expect(result.current.recentFiles).toHaveLength(10);
    expect(result.current.recentFiles[0].path).toBe('/file14.txt'); // most recent
    expect(result.current.recentFiles[9].path).toBe('/file5.txt');  // oldest kept
  });

  it('toggleStar should add to starred', async () => {
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.toggleStar('/important.md');
    });

    expect(result.current.starredFiles).toHaveLength(1);
    expect(result.current.starredFiles[0].path).toBe('/important.md');
    expect(result.current.isStarred('/important.md')).toBe(true);
  });

  it('toggleStar should remove from starred', async () => {
    const existing = [{ path: '/important.md', name: 'important.md' }];
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue(existing);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.toggleStar('/important.md');
    });

    expect(result.current.starredFiles).toHaveLength(0);
    expect(result.current.isStarred('/important.md')).toBe(false);
  });

  it('removeRecent should remove a file from recents', async () => {
    const existing = [{ path: '/a.txt', name: 'a.txt', lastOpened: 1 }];
    mockGetUserRecents.mockResolvedValue(existing);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.removeRecent('/a.txt');
    });

    expect(result.current.recentFiles).toHaveLength(0);
  });

  it('removeStar should remove a file from starred', async () => {
    const existing = [{ path: '/star.txt', name: 'star.txt' }];
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue(existing);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.removeStar('/star.txt');
    });

    expect(result.current.starredFiles).toHaveLength(0);
  });

  it('clearRecents should empty all recents', async () => {
    const existing = [
      { path: '/a.txt', name: 'a.txt', lastOpened: 1 },
      { path: '/b.txt', name: 'b.txt', lastOpened: 2 },
    ];
    mockGetUserRecents.mockResolvedValue(existing);
    mockGetUserStarred.mockResolvedValue([]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.clearRecents();
    });

    expect(result.current.recentFiles).toHaveLength(0);
  });

  it('isStarred should return false for non-starred files', async () => {
    mockGetUserRecents.mockResolvedValue([]);
    mockGetUserStarred.mockResolvedValue([{ path: '/starred.txt', name: 'starred.txt' }]);

    const { result } = renderHook(() => useRecents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isStarred('/starred.txt')).toBe(true);
    expect(result.current.isStarred('/not-starred.txt')).toBe(false);
  });
});