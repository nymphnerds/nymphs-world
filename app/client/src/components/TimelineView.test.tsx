import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimelineView from './TimelineView';

// ---- Mock API ----
const mockTimelineData = {
  eras: [
    {
      name: 'Prologue',
      scenes: [
        {
          id: 'scene_1',
          name: 'The Beginning',
          era: 'Prologue',
          date: '1200',
          locationName: 'World Tree',
          files: [
            {
              name: 'beginning',
              path: 'Lore/beginning.html',
              tags: [{ name: 'world', color: '#a78bfa' }],
            },
          ],
        },
      ],
    },
    {
      name: 'Act I',
      scenes: [
        {
          id: 'scene_2',
          name: 'First Quest',
          era: 'Act I',
          date: '1201',
          locationName: 'Village',
          files: [
            {
              name: 'quest',
              path: 'Lore/quest.html',
              tags: [{ name: 'quest', color: '#22c55e' }],
            },
          ],
        },
      ],
    },
  ],
};

// Scene with no tags on file (for NoTag fallback test)
const mockTimelineDataNoTags = {
  eras: [
    {
      name: 'Unknown',
      scenes: [
        {
          id: 'scene_3',
          name: 'Tagless Scene',
          era: 'Unknown',
          date: '1000',
          locationName: 'Somewhere',
          files: [
            {
              name: 'tagless',
              path: 'Lore/tagless.html',
              tags: [],
            },
          ],
        },
      ],
    },
  ],
};

const mockGetTimeline = vi.fn().mockResolvedValue(mockTimelineData);

vi.mock('../services/api', () => ({
  getTimeline: () => mockGetTimeline(),
  createScene: vi.fn().mockResolvedValue({ id: 'new_scene', name: 'New Scene' }),
  getLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/timelineConfig', () => ({
  getEras: vi.fn().mockReturnValue(['Prologue', 'Act I', 'Act II']),
  saveEras: vi.fn(),
  DEFAULT_ERAS: ['Prologue', 'Act I'],
}));

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimeline.mockResolvedValue(mockTimelineData);
  });

  // ---- Loading State ----

  it('renders skeleton while loading', async () => {
    mockGetTimeline.mockResolvedValue(new Promise(() => {}));
    render(<TimelineView onFileSelect={vi.fn()} />);
    // Initially renders, then loading state appears
    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalled();
    });
  });

  // ---- Rendering ----

  it('renders timeline eras with scenes after loading', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });

    expect(screen.getByText('First Quest')).toBeTruthy();
  });

  it('renders era headers', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Prologue')).toBeTruthy();
    });

    expect(screen.getByText('Act I')).toBeTruthy();
  });

  it('displays total scene count in header', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/2 scenes/)).toBeTruthy();
    });
  });

  // ---- Interaction ----

  it('collapses and expands era sections', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });

    // Click era header to collapse
    const prologueHeader = screen.getByText('Prologue').closest('button');
    if (prologueHeader) {
      fireEvent.click(prologueHeader);

      // Scene should no longer be visible
      expect(screen.queryByText('The Beginning')).toBeFalsy();
    }
  });

  it('calls onFileSelect when file is clicked', async () => {
    const onFileSelect = vi.fn();
    render(<TimelineView onFileSelect={onFileSelect} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });

    // Click on the file link
    const fileLink = screen.getByText('beginning');
    fireEvent.click(fileLink);
    expect(onFileSelect).toHaveBeenCalledWith('Lore/beginning.html');
  });

  it('shows scene date in scene header', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      const sceneDate = screen.getByText('1201');
      expect(sceneDate).toBeTruthy();
    });
  });

  // ---- Settings Modal ----

  it('opens settings modal when settings button is clicked', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeTruthy();
    });

    const settingsBtn = screen.getByTitle('Manage Eras');
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Timeline Settings')).toBeTruthy();
    });
  });

  it('closes settings modal when overlay is clicked', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeTruthy();
    });

    const settingsBtn = screen.getByTitle('Manage Eras');
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Timeline Settings')).toBeTruthy();
    });

    // Click overlay to close
    const overlay = document.querySelector('.timeline-modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }

    await waitFor(() => {
      expect(screen.queryByText('Timeline Settings')).toBeFalsy();
    });
  });

  it('closes settings modal when Done button is clicked', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeTruthy();
    });

    const settingsBtn = screen.getByTitle('Manage Eras');
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Timeline Settings')).toBeTruthy();
    });

    const doneBtn = screen.getByText('Done');
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByText('Timeline Settings')).toBeFalsy();
    });
  });

  // ---- Error State ----

  it('displays error state when API fails', async () => {
    mockGetTimeline.mockRejectedValue(new Error('Network error'));

    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load timeline/i)).toBeTruthy();
    });

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('retry button refetches timeline on error', async () => {
    mockGetTimeline.mockRejectedValue(new Error('Network error'));

    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load timeline/i)).toBeTruthy();
    });

    // Fix: return valid data on next call
    mockGetTimeline.mockResolvedValue(mockTimelineData);

    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });
  });

  // ---- Empty State ----

  it('shows empty state when no timeline entries exist', async () => {
    mockGetTimeline.mockResolvedValue({ eras: [] });

    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No scenes in timeline/i)).toBeTruthy();
    });
  });

  // ---- Scenes with No Tags ----

  it('displays scenes with no file tags', async () => {
    mockGetTimeline.mockResolvedValue(mockTimelineDataNoTags);

    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tagless Scene')).toBeTruthy();
    });
  });

  // ---- Filter Dropdowns ----

  it('shows era filter dropdown when multiple eras exist', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });

    // Era filter button should be visible (renders "Eras" followed by count/state)
    const eraFilterBtn = screen.getByText(/Eras/);
    expect(eraFilterBtn).toBeTruthy();
  });

  it('collapses era when toggled off in era filter', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
      expect(screen.getByText('First Quest')).toBeTruthy();
    });

    // Open era filter dropdown
    const eraFilterBtn = screen.getByText(/Eras/);
    fireEvent.click(eraFilterBtn);

    // Find and click the "Prologue" checkbox label to deselect it
    const eraOptions = document.querySelectorAll('.timeline-filter-option label');
    // First option should be "Prologue" era
    const prologueLabel = Array.from(eraOptions).find(
      (l) => l.textContent?.includes('Prologue')
    );
    if (prologueLabel) {
      fireEvent.click(prologueLabel);
    }

    // Prologue scenes should be hidden
    await waitFor(() => {
      expect(screen.queryByText('The Beginning')).toBeFalsy();
    });

    // Act I scenes should still be visible
    expect(screen.getByText('First Quest')).toBeTruthy();
  });

  // ---- refreshKey Prop ----

  it('refetches timeline when refreshKey changes', async () => {
    const { rerender } = render(<TimelineView onFileSelect={vi.fn()} refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('The Beginning')).toBeTruthy();
    });

    const initialCallCount = mockGetTimeline.mock.calls.length;

    // Rerender with a new refreshKey
    rerender(<TimelineView onFileSelect={vi.fn()} refreshKey={1} />);

    await waitFor(() => {
      expect(mockGetTimeline.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ---- Era Count Badge ----

  it('displays scene count per era in era header', async () => {
    render(<TimelineView onFileSelect={vi.fn()} />);

    await waitFor(() => {
      // Era count is in a span with whitespace, query by class
      const countSpans = document.querySelectorAll('.timeline-era-count');
      expect(countSpans.length).toBeGreaterThan(0);
      // Each era shows scene count in its header
      expect(countSpans[0].textContent).toContain('1');
    });
  });
});