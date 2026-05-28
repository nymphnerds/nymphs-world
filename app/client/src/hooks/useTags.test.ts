import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock all tag-related API functions
vi.mock('../services/api', async () => {
  return {
    getTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    getFileTags: vi.fn(),
    addTagsToFile: vi.fn(),
    removeTagFromFile: vi.fn(),
    setFileTags: vi.fn(),
    getFilesByTag: vi.fn(),
    getFileRelationships: vi.fn(),
  };
});

import * as api from '../services/api';
const mockGetTags = api.getTags as ReturnType<typeof vi.fn>;
const mockCreateTag = api.createTag as ReturnType<typeof vi.fn>;
const mockUpdateTag = api.updateTag as ReturnType<typeof vi.fn>;
const mockDeleteTag = api.deleteTag as ReturnType<typeof vi.fn>;
const mockGetFileTags = api.getFileTags as ReturnType<typeof vi.fn>;
const mockAddTagsToFile = api.addTagsToFile as ReturnType<typeof vi.fn>;
const mockRemoveTagFromFile = api.removeTagFromFile as ReturnType<typeof vi.fn>;
const mockSetFileTags = api.setFileTags as ReturnType<typeof vi.fn>;
const mockGetFilesByTag = api.getFilesByTag as ReturnType<typeof vi.fn>;
const mockGetFileRelationships = api.getFileRelationships as ReturnType<typeof vi.fn>;

import { useTags, useFileTags, useTagQueries } from './useTags';

const mockTags = [
  { id: 'tag-1', name: 'MainChar', color: '#f59e0b', description: 'Main character' },
  { id: 'tag-2', name: 'Friend', color: '#22c55e', description: 'Friendly NPC' },
];

function resetTagMocks() {
  mockGetTags.mockReset();
  mockCreateTag.mockReset();
  mockUpdateTag.mockReset();
  mockDeleteTag.mockReset();
  mockGetTags.mockResolvedValue(mockTags);
}

function resetFileTagMocks() {
  mockGetFileTags.mockReset();
  mockAddTagsToFile.mockReset();
  mockRemoveTagFromFile.mockReset();
  mockSetFileTags.mockReset();
  mockGetTags.mockReset();
  mockGetFileTags.mockResolvedValue(['MainChar']);
  mockGetTags.mockResolvedValue(mockTags);
}

beforeEach(() => {
  resetTagMocks();
  resetFileTagMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// useTags tests
// ============================================================
describe('useTags', () => {
  it('should start with loading=true and empty tags', () => {
    mockGetTags.mockResolvedValue([]);
    const { result } = renderHook(() => useTags());

    expect(result.current.loading).toBe(true);
    expect(result.current.tags).toEqual([]);
  });

  it('should fetch tags on mount', async () => {
    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tags).toEqual(mockTags);
    expect(mockGetTags).toHaveBeenCalledTimes(1);
  });

  it('should set error when fetch fails', async () => {
    mockGetTags.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should create tag', async () => {
    const newTag = { id: 'tag-3', name: 'Foe', color: '#ef4444', description: '' };
    mockCreateTag.mockResolvedValue(newTag);

    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createTag('Foe', '#ef4444', '');
    });

    expect(mockCreateTag).toHaveBeenCalledWith('Foe', '#ef4444', '');
    expect(result.current.tags).toContainEqual(newTag);
  });

  it('should update tag', async () => {
    const updatedTag = { ...mockTags[0], name: 'Protagonist' };
    mockUpdateTag.mockResolvedValue(updatedTag);

    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateTag('tag-1', { name: 'Protagonist' });
    });

    expect(mockUpdateTag).toHaveBeenCalledWith('tag-1', { name: 'Protagonist' });
    expect(result.current.tags).toContainEqual(updatedTag);
  });

  it('should delete tag', async () => {
    mockDeleteTag.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteTag('tag-1');
    });

    expect(mockDeleteTag).toHaveBeenCalledWith('tag-1');
    expect(result.current.tags).not.toContainEqual(mockTags[0]);
  });

  it('should set error when create fails', async () => {
    mockCreateTag.mockRejectedValue(new Error('Duplicate name'));

    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.createTag('MainChar')).rejects.toThrow('Duplicate name');
    });

    expect(result.current.error).toBe('Duplicate name');
  });

  it('should refresh tags when refresh is called', async () => {
    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockGetTags.mock.calls.length;

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetTags).toHaveBeenCalledTimes(callCount + 1);
  });

  it('should getByColor return tag color or default', async () => {
    const { result } = renderHook(() => useTags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.getByColor('MainChar')).toBe('#f59e0b');
    expect(result.current.getByColor('Nonexistent')).toBe('#a78bfa');
  });
});

// ============================================================
// useFileTags tests
// ============================================================
describe('useFileTags', () => {
  it('should start with empty fileTags when no filePath', () => {
    const { result } = renderHook(() => useFileTags(null));

    expect(result.current.fileTags).toEqual([]);
    expect(result.current.availableTags).toEqual([]);
  });

  it('should fetch file tags on mount when filePath provided', async () => {
    mockGetFileTags.mockResolvedValue(['MainChar', 'Friend']);

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fileTags).toEqual(['MainChar', 'Friend']);
    expect(mockGetFileTags).toHaveBeenCalledWith('NPCs/JackWills.html');
  });

  it('should add tags and dispatch wbu-tags-changed', async () => {
    mockAddTagsToFile.mockResolvedValue(undefined);
    mockGetFileTags.mockResolvedValue(['MainChar', 'Friend']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addTags(['Friend']);
    });

    expect(mockAddTagsToFile).toHaveBeenCalledWith('NPCs/JackWills.html', ['Friend']);
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-tags-changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent as CustomEvent).detail?.filePath).toBe('NPCs/JackWills.html');
  });

  it('should remove tag and dispatch wbu-tags-changed', async () => {
    mockRemoveTagFromFile.mockResolvedValue(undefined);
    mockGetFileTags.mockResolvedValue(['MainChar']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeTag('Friend');
    });

    expect(mockRemoveTagFromFile).toHaveBeenCalledWith('NPCs/JackWills.html', 'Friend');
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-tags-changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent as CustomEvent).detail?.filePath).toBe('NPCs/JackWills.html');
  });

  it('should replace tags and dispatch wbu-tags-changed', async () => {
    mockSetFileTags.mockResolvedValue(undefined);
    mockGetFileTags.mockResolvedValue(['Foe']);

    const dispatchedEvents: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event as CustomEvent);
      return false;
    });

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.replaceTags(['Foe']);
    });

    expect(mockSetFileTags).toHaveBeenCalledWith('NPCs/JackWills.html', ['Foe']);
    const fileEvent = dispatchedEvents.find(e => e.type === 'wbu-tags-changed');
    expect(fileEvent).toBeDefined();
  });

  it('should refetch when refresh is called', async () => {
    mockGetFileTags.mockResolvedValue(['MainChar']);

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockGetFileTags.mock.calls.length;

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetFileTags).toHaveBeenCalledTimes(callCount + 1);
  });

  it('should filter availableTags to exclude assigned tags', async () => {
    mockGetTags.mockResolvedValue(mockTags);
    mockGetFileTags.mockResolvedValue(['MainChar']);

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Friend should be available, MainChar should not
    expect(result.current.availableTags).toHaveLength(1);
    expect(result.current.availableTags[0].name).toBe('Friend');
  });

  it('should getTagColor return color from tags or default', async () => {
    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.getTagColor('MainChar')).toBe('#f59e0b');
    expect(result.current.getTagColor('Unknown')).toBe('#a78bfa');
  });

  it('should not dispatch events when filePath is null', async () => {
    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useFileTags(null));

    await act(async () => {
      await result.current.addTags(['MainChar']);
    });

    expect(dispatchedEvents).toHaveLength(0);
  });

  it('should not throw when filePath is null and removeTag is called', async () => {
    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useFileTags(null));

    await act(async () => {
      await result.current.removeTag('MainChar');
    });

    expect(dispatchedEvents).toHaveLength(0);
    expect(mockRemoveTagFromFile).not.toHaveBeenCalled();
  });

  it('should not throw when filePath is null and replaceTags is called', async () => {
    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useFileTags(null));

    await act(async () => {
      await result.current.replaceTags(['MainChar']);
    });

    expect(dispatchedEvents).toHaveLength(0);
    expect(mockSetFileTags).not.toHaveBeenCalled();
  });

  it('should set error when addTags fails', async () => {
    mockAddTagsToFile.mockRejectedValue(new Error('Tag not found'));

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.addTags(['Nonexistent'])).rejects.toThrow('Tag not found');
    });

    expect(result.current.error).toBe('Tag not found');
  });

  it('should set error when removeTag fails', async () => {
    mockRemoveTagFromFile.mockRejectedValue(new Error('File not found'));

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.removeTag('MainChar')).rejects.toThrow('File not found');
    });

    expect(result.current.error).toBe('File not found');
  });

  it('should set error when replaceTags fails', async () => {
    mockSetFileTags.mockRejectedValue(new Error('Invalid tags'));

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.replaceTags(['Bad'])).rejects.toThrow('Invalid tags');
    });

    expect(result.current.error).toBe('Invalid tags');
  });

  it('should not dispatch event when API call fails', async () => {
    mockAddTagsToFile.mockRejectedValue(new Error('Error'));

    const dispatchedEvents: string[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      dispatchedEvents.push(event.type);
      return false;
    });

    const { result } = renderHook(() => useFileTags('NPCs/JackWills.html'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.addTags(['Nonexistent'])).rejects.toThrow('Error');
    });

    expect(dispatchedEvents).toHaveLength(0);
  });
});

// ============================================================
// useTagQueries tests
// ============================================================
describe('useTagQueries', () => {
  it('should start with empty filesByTag', () => {
    const { result } = renderHook(() => useTagQueries());

    expect(result.current.filesByTag).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should fetch files by tag', async () => {
    const mockFiles = [
      { id: 'f1', name: 'JackWills.html', path: 'NPCs/JackWills.html', updatedAt: '2025-01-01' },
    ];
    mockGetFilesByTag.mockResolvedValue(mockFiles);

    const { result } = renderHook(() => useTagQueries());

    await act(async () => {
      await result.current.fetchFilesByTag('MainChar');
    });

    expect(mockGetFilesByTag).toHaveBeenCalledWith('MainChar');
    expect(result.current.filesByTag).toEqual(mockFiles);
  });

  it('should set error when fetch fails', async () => {
    mockGetFilesByTag.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useTagQueries());

    await act(async () => {
      await result.current.fetchFilesByTag('Unknown');
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.filesByTag).toEqual([]);
  });

  it('should return empty array when fetch fails', async () => {
    mockGetFilesByTag.mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useTagQueries());

    const data = await act(async () => {
      return await result.current.fetchFilesByTag('Unknown');
    });

    expect(data).toEqual([]);
  });

  it('should fetch relationships', async () => {
    const mockRelationships = {
      filePath: 'NPCs/JackWills.html',
      relationships: [],
    };
    mockGetFileRelationships.mockResolvedValue(mockRelationships);

    const { result } = renderHook(() => useTagQueries());

    await act(async () => {
      await result.current.fetchRelationships('NPCs/JackWills.html');
    });

    expect(mockGetFileRelationships).toHaveBeenCalledWith('NPCs/JackWills.html');
    expect(result.current.relationships).toEqual(mockRelationships);
  });

  it('should set error and return null when fetch relationships fails', async () => {
    mockGetFileRelationships.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useTagQueries());

    const data = await act(async () => {
      return await result.current.fetchRelationships('NPCs/JackWills.html');
    });

    expect(result.current.error).toBe('Not found');
    expect(data).toBeNull();
  });
});