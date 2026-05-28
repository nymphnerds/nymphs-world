import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InformationPanel } from './InformationPanel';

// ---- Mock hooks ----
const mockUseFileTags = vi.fn().mockReturnValue({
  fileTags: ['lore', 'character'],
  removeTag: vi.fn().mockResolvedValue(undefined),
  loading: false,
  refresh: vi.fn(),
});

const mockUseTags = vi.fn().mockReturnValue({
  tags: [
    { id: '1', name: 'lore', color: '#a78bfa', description: '' },
    { id: '2', name: 'character', color: '#22c55e', description: '' },
  ],
});

const mockUseFileLocations = vi.fn().mockReturnValue({
  fileLocations: [],
  addLocations: vi.fn().mockResolvedValue(undefined),
  removeLocation: vi.fn().mockResolvedValue(undefined),
  loading: false,
});

const mockUseLocations = vi.fn().mockReturnValue({
  locations: [],
});

vi.mock('../hooks/useTags', () => ({
  useFileTags: (path: string | null) => mockUseFileTags(path),
  useTags: () => mockUseTags(),
}));

vi.mock('../hooks/useLocations', () => ({
  useFileLocations: (path: string | null) => mockUseFileLocations(path),
  useLocations: () => mockUseLocations(),
}));

// ---- Mock API ----
vi.mock('../services/api', () => ({
  saveTimelineMetadata: vi.fn().mockResolvedValue(undefined),
  suggestTimelineDate: vi.fn().mockResolvedValue(''),
  getBacklinks: vi.fn().mockResolvedValue([]),
  signImageFromWorkspace: vi.fn().mockResolvedValue(''),
}));

vi.mock('../utils/timelineConfig', () => ({
  getEras: vi.fn().mockReturnValue(['Prologue', 'Act I', 'Act II']),
}));

// ---- Mock sub-components ----
vi.mock('./HeroImagePicker', () => ({
  HeroImagePicker: vi.fn(({ onClose }: any) => (
    <div data-testid="hero-picker">
      <button onClick={onClose}>Close Picker</button>
    </div>
  )),
}));
vi.mock('./ImageExplorer', () => ({
  ImageExplorer: vi.fn(({ onClose }: any) => (
    <div data-testid="image-explorer">
      <button onClick={onClose}>Close Explorer</button>
    </div>
  )),
}));
vi.mock('./ImageViewer', () => ({
  ImageViewer: vi.fn(({ onClose }: any) => (
    <div data-testid="image-viewer">
      <button onClick={onClose}>Close Viewer</button>
    </div>
  )),
}));
vi.mock('./MiniGraphPreview', () => ({
  MiniGraphPreview: vi.fn(() => <div data-testid="mini-graph" />),
}));

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['X', 'Camera', 'Link', 'Plus', 'Image', 'StickyNote', 'Trash2', 'Clock', 'MapPin', 'Film'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return icons;
});

describe('InformationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFileTags.mockReturnValue({
      fileTags: ['lore', 'character'],
      removeTag: vi.fn().mockResolvedValue(undefined),
      loading: false,
      refresh: vi.fn(),
    });
    mockUseFileLocations.mockReturnValue({
      fileLocations: [],
      addLocations: vi.fn().mockResolvedValue(undefined),
      removeLocation: vi.fn().mockResolvedValue(undefined),
      loading: false,
    });
  });

  it('renders the panel and calls the hooks', () => {
    render(<InformationPanel currentPath="Lore/test.html" username="testuser" />);
    expect(mockUseFileTags).toHaveBeenCalled();
    expect(mockUseFileLocations).toHaveBeenCalled();
  });

  it('renders tag names from fileTags', () => {
    render(<InformationPanel currentPath="Lore/test.html" username="testuser" />);
    expect(screen.getByText('lore')).toBeTruthy();
  });

  it('renders with empty locations when fileLocations is empty', () => {
    mockUseFileLocations.mockReturnValue({
      fileLocations: [],
      addLocations: vi.fn().mockResolvedValue(undefined),
      removeLocation: vi.fn().mockResolvedValue(undefined),
      loading: false,
    });
    render(<InformationPanel currentPath="Lore/test.html" username="testuser" />);
    expect(screen.getByText('lore')).toBeTruthy();
  });

  it('renders timeline metadata section', () => {
    render(<InformationPanel currentPath="Lore/test.html" username="testuser" />);
    expect(mockUseFileTags).toHaveBeenCalledWith('Lore/test.html');
  });

  it('renders with onTimelineMetadataChange callback', () => {
    const onTimelineMetadataChange = vi.fn();
    render(
      <InformationPanel
        currentPath="Lore/test.html"
        onTimelineMetadataChange={onTimelineMetadataChange}
        username="testuser"
      />
    );
    expect(screen.getByText('lore')).toBeTruthy();
  });
});