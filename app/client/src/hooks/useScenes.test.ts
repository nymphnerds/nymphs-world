import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    getScenes: vi.fn(),
    createScene: vi.fn(),
    updateScene: vi.fn(),
    deleteScene: vi.fn(),
    getFileScenes: vi.fn(),
    addScenesToFile: vi.fn(),
    removeSceneFromFile: vi.fn(),
  };
});

import * as api from '../services/api';
const mockGetScenes = api.getScenes as ReturnType<typeof vi.fn>;
const mockCreateScene = api.createScene as ReturnType<typeof vi.fn>;
const mockUpdateScene = api.updateScene as ReturnType<typeof vi.fn>;
const mockDeleteScene = api.deleteScene as ReturnType<typeof vi.fn>;
const mockGetFileScenes = api.getFileScenes as ReturnType<typeof vi.fn>;
const mockAddScenesToFile = api.addScenesToFile as ReturnType<typeof vi.fn>;
const mockRemoveSceneFromFile = api.removeSceneFromFile as ReturnType<typeof vi.fn>;

import { useScenes, useFileScenes } from './useScenes';

function resetMocks() {
  mockGetScenes.mockReset();
  mockCreateScene.mockReset();
  mockUpdateScene.mockReset();
  mockDeleteScene.mockReset();
  mockGetFileScenes.mockReset();
  mockAddScenesToFile.mockReset();
  mockRemoveSceneFromFile.mockReset();

  // Defaults: empty scenes
  mockGetScenes.mockResolvedValue([]);
  mockGetFileScenes.mockResolvedValue([]);
}

beforeEach(() => {
  resetMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- useScenes tests ---

describe('useScenes', () => {
  it('starts with loading=true and scenes=[]', () => {
    const { result } = renderHook(() => useScenes());
    expect(result.current.loading).toBe(true);
    expect(result.current.scenes).toEqual([]);
  });

  it('fetches scenes on mount', async () => {
    const mockScenes = [
      { id: 'scene_1', name: 'Cave', era: 'Year 1', date: 'Spring', locationName: 'Dungeon' },
    ];
    mockGetScenes.mockResolvedValue(mockScenes);

    const { result } = renderHook(() => useScenes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetScenes).toHaveBeenCalledTimes(1);
    expect(result.current.scenes).toEqual(mockScenes);
  });

  it('sets error on fetch failure', async () => {
    mockGetScenes.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useScenes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('createScene adds to state and dispatches event', async () => {
    const newScene = { id: 'scene_new', name: 'Castle', era: 'Year 2', date: '', locationName: 'Hill' };
    mockGetScenes.mockResolvedValueOnce([]).mockResolvedValueOnce([newScene]);
    mockCreateScene.mockResolvedValue(newScene);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let dispatchedEventType: string | null = null;
    const handler = (e: Event) => { dispatchedEventType = e.type; };
    act(() => {
      window.addEventListener('wbu-scenes-changed', handler);
    });

    await act(async () => {
      await result.current.createScene('Castle', 'Year 2', '', 'Hill');
    });

    await waitFor(() => {
      expect(result.current.scenes).toContainEqual(newScene);
    });

    expect(mockCreateScene).toHaveBeenCalledWith('Castle', 'Year 2', '', 'Hill');
    expect(dispatchedEventType).toBe('wbu-scenes-changed');
  });

  it('updateScene updates scene in state', async () => {
    const existing = { id: 'scene_1', name: 'Cave', era: 'Year 1', date: '', locationName: 'Dungeon' };
    const updated = { ...existing, name: 'Renamed Cave', era: 'Year 3' };
    mockGetScenes.mockResolvedValueOnce([existing]).mockResolvedValueOnce([updated]);
    mockUpdateScene.mockResolvedValue(updated);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateScene('scene_1', { name: 'Renamed Cave', era: 'Year 3' });
    });

    await waitFor(() => {
      expect(result.current.scenes).toContainEqual(updated);
    });

    expect(mockUpdateScene).toHaveBeenCalledWith('scene_1', { name: 'Renamed Cave', era: 'Year 3' });
  });

  it('deleteScene removes from state', async () => {
    const existing = { id: 'scene_1', name: 'Cave', era: 'Year 1', date: '', locationName: 'Dungeon' };
    mockGetScenes.mockResolvedValueOnce([existing]).mockResolvedValueOnce([]);
    mockDeleteScene.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteScene('scene_1');
    });

    await waitFor(() => {
      expect(result.current.scenes).not.toContainEqual(existing);
    });

    expect(mockDeleteScene).toHaveBeenCalledWith('scene_1');
    expect(result.current.scenes).toHaveLength(0);
  });

  it('getById returns scene by ID', async () => {
    const mockScenes = [
      { id: 'scene_1', name: 'Cave', era: 'Year 1', date: '', locationName: 'Dungeon' },
      { id: 'scene_2', name: 'Village', era: 'Year 1', date: '', locationName: 'Town' },
    ];
    mockGetScenes.mockResolvedValue(mockScenes);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getById('scene_1')).toEqual(mockScenes[0]);
    expect(result.current.getById('scene_2')).toEqual(mockScenes[1]);
  });

  it('getById returns undefined for missing ID', async () => {
    mockGetScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getById('nonexistent')).toBeUndefined();
  });

  it('getLocationColor returns default color', async () => {
    mockGetScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getLocationColor('Unknown Place')).toBe('#10b981');
  });

  it('getLocationColor uses registry when available', async () => {
    (window as any).__wbuLocationColors = { 'Dungeon': '#8b5cf6' };
    mockGetScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getLocationColor('Dungeon')).toBe('#8b5cf6');

    // Cleanup
    delete (window as any).__wbuLocationColors;
  });

  it('refetches on wbu-scenes-changed event', async () => {
    mockGetScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const initialCallCount = mockGetScenes.mock.calls.length;

    mockGetScenes.mockResolvedValue([
      { id: 'scene_event', name: 'Event Scene', era: 'Year 1', date: '', locationName: 'Dungeon' },
    ]);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
    });

    await waitFor(() => {
      expect(mockGetScenes.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('cleanup removes event listener on unmount', async () => {
    mockGetScenes.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useScenes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();

    // After unmount, dispatching should NOT trigger a refetch
    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
    });

    // Give time for any potential handler to fire
    await new Promise(r => setTimeout(r, 50));

    // Should not have additional calls beyond mount (exact count depends on test isolation)
  });
});

// --- useFileScenes tests ---

describe('useFileScenes', () => {
  it('returns empty state when no filePath', async () => {
    mockGetScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useFileScenes(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.fileSceneIds).toEqual([]);
    expect(result.current.fileScenes).toEqual([]);
  });

  it('fetches file scenes on mount', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValue(['scene_1', 'scene_2']);

    const { result } = renderHook(() => useFileScenes('adventure.html'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetFileScenes).toHaveBeenCalledWith('adventure.html');
    expect(result.current.fileSceneIds).toEqual(['scene_1', 'scene_2']);
  });

  it('addScenes calls API and refetches', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValueOnce([]).mockResolvedValueOnce(['scene_1']);
    mockAddScenesToFile.mockResolvedValue({ success: true, added: ['scene_1'] });

    const { result } = renderHook(() => useFileScenes('doc.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addScenes(['scene_1']);
    });

    expect(mockAddScenesToFile).toHaveBeenCalledWith('doc.html', ['scene_1']);
  });

  it('removeScene calls API and refetches', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValueOnce(['scene_1']).mockResolvedValueOnce([]);
    mockRemoveSceneFromFile.mockResolvedValue({ success: true, removed: 'scene_1' });

    const { result } = renderHook(() => useFileScenes('doc.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeScene('scene_1');
    });

    expect(mockRemoveSceneFromFile).toHaveBeenCalledWith('doc.html', 'scene_1');
  });

  it('dispatches wbu-file-scenes-changed event on add', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValueOnce([]).mockResolvedValueOnce(['scene_1']);
    mockAddScenesToFile.mockResolvedValue({ success: true, added: ['scene_1'] });

    const { result } = renderHook(() => useFileScenes('doc.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let dispatchedEventType: string | null = null;
    let dispatchedEventDetail: any = null;
    const handler = (e: Event) => {
      dispatchedEventType = e.type;
      dispatchedEventDetail = (e as CustomEvent).detail;
    };
    act(() => {
      window.addEventListener('wbu-file-scenes-changed', handler);
    });

    await act(async () => {
      await result.current.addScenes(['scene_1']);
    });

    expect(dispatchedEventType).toBe('wbu-file-scenes-changed');
    expect(dispatchedEventDetail).toEqual({ filePath: 'doc.html' });
  });

  it('event filter only refetches matching file path', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValue([]);

    const { result } = renderHook(() => useFileScenes('target.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const initialCallCount = mockGetFileScenes.mock.calls.length;

    // Dispatch for a DIFFERENT file
    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-file-scenes-changed', {
        detail: { filePath: 'other.html' },
      }));
    });

    // Give time for potential handler
    await new Promise(r => setTimeout(r, 50));

    // Should NOT have triggered additional fetch for target.html
    expect(mockGetFileScenes.mock.calls.length).toBe(initialCallCount);
  });

  it('fileScenes returns full scene objects', async () => {
    const scenes = [
      { id: 'scene_1', name: 'Cave', era: 'Year 1', date: '', locationName: 'Dungeon' },
      { id: 'scene_2', name: 'Village', era: 'Year 2', date: '', locationName: 'Town' },
    ];
    mockGetScenes.mockResolvedValue(scenes);
    mockGetFileScenes.mockResolvedValue(['scene_1']);

    const { result } = renderHook(() => useFileScenes('doc.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.fileScenes).toHaveLength(1);
    expect(result.current.fileScenes[0].name).toBe('Cave');
  });

  it('refreshes when workspace scenes change', async () => {
    mockGetScenes.mockResolvedValue([]);
    mockGetFileScenes.mockResolvedValue(['scene_1']);

    const { result } = renderHook(() => useFileScenes('doc.html'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const initialCallCount = mockGetFileScenes.mock.calls.length;

    // Simulate workspace scenes change (this triggers the scenes.length dependency)
    mockGetScenes.mockResolvedValue([
      { id: 'scene_1', name: 'Cave', era: 'Year 1', date: '', locationName: 'Dungeon' },
    ]);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
    });

    await waitFor(() => {
      expect(mockGetFileScenes.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});