import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock useScenes hook
vi.mock('../hooks/useScenes', () => ({
  useScenes: vi.fn(),
}));

import { useScenes } from '../hooks/useScenes';
import { DialogueSidebar } from './DialogueSidebar';

const mockUseScenes = useScenes as ReturnType<typeof vi.fn>;

const mockScenes = [
  { id: 's1', name: 'Scene One', era: 'Era A', locationName: 'Place 1', date: '2024-01-01' },
  { id: 's2', name: 'Scene Two', era: 'Era A', locationName: 'Place 2', date: '2024-02-01' },
  { id: 's3', name: 'Scene Three', era: 'Era B', locationName: 'Place 3', date: '2024-03-01' },
];

describe('DialogueSidebar', () => {
  const mockOnOpenDialogue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with scenes grouped by era', () => {
    mockUseScenes.mockReturnValue({ scenes: mockScenes, loading: false, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    expect(screen.getByText('Dialogue')).toBeInTheDocument();
    expect(screen.getByText('3 scenes')).toBeInTheDocument();
    expect(screen.getByText('Era A')).toBeInTheDocument();
    expect(screen.getByText('Era B')).toBeInTheDocument();
  });

  it('shows scene buttons that call onOpenDialogue when clicked', () => {
    mockUseScenes.mockReturnValue({ scenes: mockScenes, loading: false, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    expect(screen.getByText('Scene One')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Scene One'));

    expect(mockOnOpenDialogue).toHaveBeenCalledWith(mockScenes[0]);
  });

  it('shows empty state when no scenes exist', () => {
    mockUseScenes.mockReturnValue({ scenes: [], loading: false, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    expect(screen.getByText('No scenes yet.')).toBeInTheDocument();
    expect(screen.getByText(/Timeline/)).toBeInTheDocument();
  });

  it('shows loading skeleton while loading', () => {
    mockUseScenes.mockReturnValue({ scenes: [], loading: true, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    expect(document.querySelector('.dialogue-skeleton')).toBeInTheDocument();
  });

  it('shows error state when error occurs', () => {
    mockUseScenes.mockReturnValue({ scenes: [], loading: false, error: 'Load failed' });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    expect(screen.getByText('Load failed')).toBeInTheDocument();
  });

  it('collapses and expands era groups', () => {
    mockUseScenes.mockReturnValue({ scenes: mockScenes, loading: false, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    // Scenes should be visible initially
    expect(screen.getByText('Scene One')).toBeInTheDocument();

    // Click era header to collapse
    fireEvent.click(screen.getByText('Era A'));

    // Scenes should be hidden
    expect(screen.queryByText('Scene One')).not.toBeInTheDocument();
    expect(screen.queryByText('Scene Two')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText('Era A'));

    // Scenes should be visible again
    expect(screen.getByText('Scene One')).toBeInTheDocument();
  });

  it('displays era scene count', () => {
    mockUseScenes.mockReturnValue({ scenes: mockScenes, loading: false, error: null });

    render(<DialogueSidebar onOpenDialogue={mockOnOpenDialogue} />);

    // Era A has 2 scenes, Era B has 1
    const eraCounts = screen.getAllByText('2');
    expect(eraCounts.length).toBeGreaterThanOrEqual(1);
  });
});