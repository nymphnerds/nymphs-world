import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock all location-related API functions
vi.mock('../services/api', async () => {
  return {
    getLocations: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    getFileLocations: vi.fn(),
    addLocationsToFile: vi.fn(),
    removeLocationFromFile: vi.fn(),
    setFileLocations: vi.fn(),
    getFilesByLocation: vi.fn(),
  };
});

import * as api from '../services/api';
const mockGetLocations = api.getLocations as ReturnType<typeof vi.fn>;
const mockCreateLocation = api.createLocation as ReturnType<typeof vi.fn>;
const mockUpdateLocation = api.updateLocation as ReturnType<typeof vi.fn>;
const mockDeleteLocation = api.deleteLocation as ReturnType<typeof vi.fn>;
const mockGetFileLocations = api.getFileLocations as ReturnType<typeof vi.fn>;
const mockAddLocationsToFile = api.addLocationsToFile as ReturnType<typeof vi.fn>;
const mockRemoveLocationFromFile = api.removeLocationFromFile as ReturnType<typeof vi.fn>;
const mockSetFileLocations = api.setFileLocations as ReturnType<typeof vi.fn>;
const mockGetFilesByLocation = api.getFilesByLocation as ReturnType<typeof vi.fn>;

import { useLocations, useFileLocations, useLocationQueries } from './useLocations';

const mockLocations = [
  { id: 'loc-1', name: 'Forest', color: '#22c55e', description: 'A green forest' },
  { id: 'loc-2', name: 'Castle', color: '#a855f7', description: 'A purple castle' },
];

function resetLocationMocks() {
  mockGetLocations.mockReset();
  mockCreateLocation.mockReset();
  mockUpdateLocation.mockReset();
  mockDeleteLocation.mockReset();
  mockGetLocations.mockResolvedValue(mockLocations);
}

function resetFileLocationMocks() {
  mockGetFileLocations.mockReset();
  mockAddLocationsToFile.mockReset();
  mockRemoveLocationFromFile.mockReset();
  mockSetFileLocations.mockReset();
  mockGetLocations.mockReset();
  mockGetFileLocations.mockResolvedValue(['Forest']);
  mockGetLocations.mockResolvedValue(mockLocations);
}

beforeEach(() => {
  resetLocationMocks();
  resetFileLocationMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// useLocations tests
// ============================================================
describe('useLocations', () => {
  it('should start with loading=true and empty locations', () => {
    mockGetLocations.mockResolvedValue([]);
    const { result } = renderHook(() => useLocations());

    expect(result.current.loading).toBe(true);
    expect(result.current.locations).toEqual([]);
  });

  it('should fetch locations on mount', async () => {
    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locations).toEqual(mockLocations);
    expect(mockGetLocations).toHaveBeenCalledTimes(1);
  });

  it('should set error when fetch fails', async () => {
    mockGetLocations.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should create location and dispatch wbu-locations-changed', async () => {
    const newLoc = { id: 'loc-3', name: 'Desert', color: '#f97316', description: '' };
    mockCreateLocation.mockResolvedValue(newLoc);

    const dispatchedEvents: string[] = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      // Trigger any listeners synchronously for test purposes
      const listeners = (event as CustomEvent).target?.dispatchEvent ? [] : [];
      return false;
    });

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createLocation('Desert', '#f97316', '');
    });

    expect(mockCreateLocation).toHaveBeenCalledWith('Desert', '#f97316', '');
    expect(dispatchedEvents).toContain('wbu-locations-changed');
    expect(result.current.locations).toContainEqual(newLoc);
  });

  it('should update location and dispatch wbu-locations-changed', async () => {
    const updatedLoc = { ...mockLocations[0], name: 'Dark Forest' };
    mockUpdateLocation.mockResolvedValue(updatedLoc);

    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateLocation('loc-1', { name: 'Dark Forest' });
    });

    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', { name: 'Dark Forest' });
    expect(dispatchedEvents).toContain('wbu-locations-changed');
  });

  it('should delete location and dispatch wbu-locations-changed', async () => {
    mockDeleteLocation.mockResolvedValue(undefined);

    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockDeleteLocation).toHaveBeenCalledWith('loc-1');
    expect(dispatchedEvents).toContain('wbu-locations-changed');
    expect(result.current.locations).not.toContainEqual(mockLocations[0]);
  });

  it('should set error when create fails', async () => {
    mockCreateLocation.mockRejectedValue(new Error('Duplicate name'));

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.createLocation('Forest')).rejects.toThrow('Duplicate name');
    });

    expect(result.current.error).toBe('Duplicate name');
  });

  it('should refresh locations when refresh is called', async () => {
    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockGetLocations.mock.calls.length;

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetLocations).toHaveBeenCalledTimes(callCount + 1);
  });

  it('should getByColor return location color or default', async () => {
    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.getByColor('Forest')).toBe('#22c55e');
    expect(result.current.getByColor('Nonexistent')).toBe('#10b981');
  });

  it('should refetch when wbu-locations-changed event is dispatched', async () => {
    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockGetLocations.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-locations-changed'));
    });

    await waitFor(() => {
      expect(mockGetLocations).toHaveBeenCalledTimes(callCount + 1);
    });
  });
});

// ============================================================
// useFileLocations tests
// ============================================================
describe('useFileLocations', () => {
  it('should start with empty fileLocations when no filePath', () => {
    const { result } = renderHook(() => useFileLocations(null));

    expect(result.current.fileLocations).toEqual([]);
    expect(result.current.availableLocations).toEqual([]);
  });

  it('should fetch file locations on mount when filePath provided', async () => {
    mockGetFileLocations.mockResolvedValue(['Forest', 'Castle']);

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fileLocations).toEqual(['Forest', 'Castle']);
    expect(mockGetFileLocations).toHaveBeenCalledWith('Lore/Characters.json');
  });

  it('should add locations and dispatch wbu-file-locations-changed', async () => {
    mockAddLocationsToFile.mockResolvedValue(undefined);
    mockGetFileLocations.mockResolvedValue(['Forest', 'Castle']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addLocations(['Castle']);
    });

    expect(mockAddLocationsToFile).toHaveBeenCalledWith('Lore/Characters.json', ['Castle']);
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-file-locations-changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent as CustomEvent).detail?.filePath).toBe('Lore/Characters.json');
  });

  it('should remove location and dispatch wbu-file-locations-changed', async () => {
    mockRemoveLocationFromFile.mockResolvedValue(undefined);
    mockGetFileLocations.mockResolvedValue(['Castle']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeLocation('Forest');
    });

    expect(mockRemoveLocationFromFile).toHaveBeenCalledWith('Lore/Characters.json', 'Forest');
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-file-locations-changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent as CustomEvent).detail?.filePath).toBe('Lore/Characters.json');
  });

  it('should replace locations and dispatch wbu-file-locations-changed', async () => {
    mockSetFileLocations.mockResolvedValue(undefined);
    mockGetFileLocations.mockResolvedValue(['Desert']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.replaceLocations(['Desert']);
    });

    expect(mockSetFileLocations).toHaveBeenCalledWith('Lore/Characters.json', ['Desert']);
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-file-locations-changed');
    expect(fileEvent).toBeDefined();
  });

  it('should only refetch on wbu-file-locations-changed for matching filePath', async () => {
    mockGetFileLocations.mockResolvedValue(['Forest']);

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockGetFileLocations.mock.calls.length;

    // Dispatch event for a DIFFERENT file — should NOT trigger refetch
    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-file-locations-changed', {
        detail: { filePath: 'Lore/Other.json' },
      }));
    });

    // Give time for any potential effect
    await act(async () => new Promise(r => setTimeout(r, 50)));

    // Should NOT have refetched
    expect(mockGetFileLocations).toHaveBeenCalledTimes(callCount);

    // Now dispatch for the SAME file — should trigger refetch
    await act(async () => {
      window.dispatchEvent(new CustomEvent('wbu-file-locations-changed', {
        detail: { filePath: 'Lore/Characters.json' },
      }));
    });

    await waitFor(() => {
      expect(mockGetFileLocations).toHaveBeenCalledTimes(callCount + 1);
    });
  });

  it('should filter availableLocations to exclude assigned locations', async () => {
    mockGetLocations.mockResolvedValue(mockLocations);
    mockGetFileLocations.mockResolvedValue(['Forest']);

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Castle should be available, Forest should not
    expect(result.current.availableLocations).toHaveLength(1);
    expect(result.current.availableLocations[0].name).toBe('Castle');
  });

  it('should getLocationColor return color from locations or default', async () => {
    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.getLocationColor('Forest')).toBe('#22c55e');
    expect(result.current.getLocationColor('Unknown')).toBe('#10b981');
  });

  it('should not dispatch events when filePath is null', async () => {
    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useFileLocations(null));

    await act(async () => {
      await result.current.addLocations(['Forest']);
    });

    expect(dispatchedEvents).toHaveLength(0);
  });

  it('should set error when addLocations fails', async () => {
    mockAddLocationsToFile.mockRejectedValue(new Error('Location not found'));

    const { result } = renderHook(() => useFileLocations('Lore/Characters.json'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.addLocations(['Nonexistent'])).rejects.toThrow('Location not found');
    });

    expect(result.current.error).toBe('Location not found');
  });
});

// ============================================================
// useLocationQueries tests
// ============================================================
describe('useLocationQueries', () => {
  it('should start with empty filesByLocation', () => {
    const { result } = renderHook(() => useLocationQueries());

    expect(result.current.filesByLocation).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should fetch files by location', async () => {
    const mockFiles = [
      { id: 'f1', name: 'Character.json', path: 'Lore/Character.json', updatedAt: '2025-01-01' },
    ];
    mockGetFilesByLocation.mockResolvedValue(mockFiles);

    const { result } = renderHook(() => useLocationQueries());

    await act(async () => {
      await result.current.fetchFilesByLocation('Forest');
    });

    expect(mockGetFilesByLocation).toHaveBeenCalledWith('Forest');
    expect(result.current.filesByLocation).toEqual(mockFiles);
  });

  it('should set error when fetch fails', async () => {
    mockGetFilesByLocation.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useLocationQueries());

    await act(async () => {
      await result.current.fetchFilesByLocation('Unknown');
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.filesByLocation).toEqual([]);
  });

  it('should return empty array when fetch fails', async () => {
    mockGetFilesByLocation.mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useLocationQueries());

    const data = await act(async () => {
      return await result.current.fetchFilesByLocation('Unknown');
    });

    expect(data).toEqual([]);
  });
});