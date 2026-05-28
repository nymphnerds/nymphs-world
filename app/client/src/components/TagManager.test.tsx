import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagManager from './TagManager';

// ---- Mock hooks ----
const mockTags = [
  { id: '1', name: 'lore', color: '#a78bfa', description: '' },
  { id: '2', name: 'quest', color: '#22c55e', description: '' },
];

const mockFileTags = ['lore'];

const mockAvailableTags = [{ name: 'quest', color: '#22c55e' }];

const mockUseTags = vi.fn();
const mockUseFileTags = vi.fn();
const mockUseTagQueries = vi.fn();

vi.mock('../hooks/useTags', () => ({
  useTags: () => mockUseTags(),
  useFileTags: (filePath: string | null) => mockUseFileTags(filePath),
  useTagQueries: () => mockUseTagQueries(),
}));

const createMockUseTags = (overrides?: Partial<ReturnType<typeof mockUseTags>>) => ({
  tags: mockTags,
  loading: false,
  createTag: vi.fn().mockResolvedValue({ id: '3', name: 'new', color: '#a78bfa', description: '' }),
  updateTag: vi.fn().mockResolvedValue({ id: '1', name: 'lore-renamed', color: '#a78bfa', description: '' }),
  deleteTag: vi.fn().mockResolvedValue(undefined),
  getByColor: vi.fn((name: string) => mockTags.find(t => t.name === name)?.color || '#a78bfa'),
  ...overrides,
});

const createMockUseFileTags = (overrides?: Partial<ReturnType<typeof mockUseFileTags>>) => ({
  fileTags: mockFileTags,
  availableTags: mockAvailableTags,
  addTags: vi.fn().mockResolvedValue(undefined),
  removeTag: vi.fn().mockResolvedValue(undefined),
  getTagColor: vi.fn((name: string) => mockTags.find(t => t.name === name)?.color || '#a78bfa'),
  loading: false,
  ...overrides,
});

const createMockUseTagQueries = (overrides?: Partial<ReturnType<typeof mockUseTagQueries>>) => ({
  filesByTag: [{ name: 'my-file.html', path: 'Lore/my-file.html' }],
  fetchFilesByTag: vi.fn().mockResolvedValue([{ name: 'my-file.html', path: 'Lore/my-file.html' }]),
  loading: false,
  relationships: null,
  ...overrides,
});

const renderTagManager = (overrides?: { tags?: Partial<ReturnType<typeof mockUseTags>>, fileTags?: Partial<ReturnType<typeof mockUseFileTags>>, queries?: Partial<ReturnType<typeof mockUseTagQueries>> }) => {
  mockUseTags.mockReturnValue(createMockUseTags(overrides?.tags));
  mockUseFileTags.mockReturnValue(createMockUseFileTags(overrides?.fileTags));
  mockUseTagQueries.mockReturnValue(createMockUseTagQueries(overrides?.queries));

  window.confirm = vi.fn(() => true);

  return render(
    <TagManager
      activeFilePath="Lore/my-file.html"
      onFileSelect={vi.fn()}
    />
  );
};

describe('TagManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tag list with all tags', () => {
    const { container } = renderTagManager();
    // Tags appear as tag-filter-btn in the "All Tags" section
    const allTagSection = container.querySelector('.tag-section');
    expect(allTagSection).toBeTruthy();
    // Check that tag filter buttons exist with the tag names
    const tagButtons = container.querySelectorAll('.tag-filter-btn');
    const tagNames = Array.from(tagButtons).map(b => b.textContent?.trim());
    expect(tagNames).toContain('lore');
    expect(tagNames).toContain('quest');
  });

  it('displays active file tags', () => {
    renderTagManager();
    expect(screen.getByText('Active Document')).toBeTruthy();
  });

  it('creates a new tag when form is submitted', async () => {
    const { container } = renderTagManager();

    // Click the add tag button (has title="Add Tag" and text "+")
    const addTagBtn = container.querySelector('button.tag-add-btn');
    expect(addTagBtn).toBeTruthy();
    if (addTagBtn) fireEvent.click(addTagBtn);

    // Fill the form
    const input = screen.getByPlaceholderText('Tag name');
    fireEvent.change(input, { target: { value: 'new-tag' } });

    // Click the confirm button
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mockUseTags().createTag).toHaveBeenCalledWith('new-tag', '#a78bfa', '');
    });
  });

  it('deletes a tag after confirmation', async () => {
    renderTagManager();

    // Click the delete button for the first tag
    const deleteBtns = screen.getAllByTitle('Delete');
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete this tag? It will be removed from all files.');
      expect(mockUseTags().deleteTag).toHaveBeenCalledWith('1');
    });
  });

  it('filters files by tag when tag is clicked', async () => {
    const { container } = renderTagManager();

    // Find the tag filter button by its class and text content
    const filterBtns = container.querySelectorAll('.tag-filter-btn');
    let filterBtn: Element | null = null;
    for (const btn of Array.from(filterBtns)) {
      if (btn.textContent?.trim() === 'lore') {
        filterBtn = btn;
        break;
      }
    }
    expect(filterBtn).toBeTruthy();
    if (filterBtn) fireEvent.click(filterBtn);

    await waitFor(() => {
      expect(mockUseTagQueries().fetchFilesByTag).toHaveBeenCalledWith('lore');
    });
  });
});