import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SearchPanel from './SearchPanel';
import type { SearchResult } from '../services/api';

describe('SearchPanel', () => {
  const minimalProps = {
    width: 300,
    query: '',
    onQueryChange: vi.fn(),
    results: [],
    loading: false,
    error: null,
    onFileOpen: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<SearchPanel {...minimalProps} />);
    expect(screen.getByText('SEARCH')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<SearchPanel {...minimalProps} />);
    expect(screen.getByPlaceholderText(/Search in files/i)).toBeInTheDocument();
  });

  it('shows initial empty state', () => {
    render(<SearchPanel {...minimalProps} />);
    expect(screen.getByText(/Type to search across all files/i)).toBeInTheDocument();
  });

  it('shows no results when query has no matches', () => {
    render(<SearchPanel {...minimalProps} query="test" />);
    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<SearchPanel {...minimalProps} loading={true} query="test" />);
    expect(screen.getByText(/Searching.../i)).toBeInTheDocument();
  });

  it('shows error when provided', () => {
    render(<SearchPanel {...minimalProps} error="Search failed" query="test" />);
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('renders search result rows with file name and path', () => {
    const mockResults: SearchResult[] = [
      {
        name: 'JimmyDog.html',
        path: 'NPCs/JimmyDog.html',
        type: 'file',
        matches: [
          { line: 3, context: 'NPC - JimmyDog, the wise old mentor' },
        ],
      },
    ];
    const mockOnFileOpen = vi.fn();
    render(<SearchPanel {...minimalProps} query="jimmy" results={mockResults} onFileOpen={mockOnFileOpen} />);
    expect(screen.getByText('JimmyDog.html')).toBeInTheDocument();
    expect(screen.getByText('NPCs/JimmyDog.html')).toBeInTheDocument();
    expect(screen.getByText('NPC - JimmyDog, the wise old mentor')).toBeInTheDocument();
  });

  it('calls onFileOpen when result row is clicked', () => {
    const mockResults: SearchResult[] = [
      {
        name: 'JackWills.html',
        path: 'NPCs/JackWills.html',
        type: 'file',
        matches: [
          { line: 1, context: 'Name matches: JackWills.html' },
        ],
      },
    ];
    const mockOnFileOpen = vi.fn();
    render(<SearchPanel {...minimalProps} query="jack" results={mockResults} onFileOpen={mockOnFileOpen} />);
    const row = screen.getByText('JackWills.html').closest('.search-result-row') as HTMLElement | null;
    if (row) row.click();
    expect(mockOnFileOpen).toHaveBeenCalledWith('NPCs/JackWills.html');
  });

  it('skips "Name matches:" lines for snippet display', () => {
    const mockResults: SearchResult[] = [
      {
        name: 'test.html',
        path: 'test.html',
        type: 'file',
        matches: [
          { line: 1, context: 'Name matches: test.html' },
          { line: 5, context: 'This is real content' },
        ],
      },
    ];
    render(<SearchPanel {...minimalProps} query="test" results={mockResults} />);
    // Should show the real content snippet, not the "Name matches:" line
    expect(screen.getByText('This is real content')).toBeInTheDocument();
    expect(screen.queryByText('Name matches: test.html')).not.toBeInTheDocument();
  });

  it('shows no snippet when all matches are "Name matches:" lines', () => {
    const mockResults: SearchResult[] = [
      {
        name: 'solo.html',
        path: 'solo.html',
        type: 'file',
        matches: [
          { line: 1, context: 'Name matches: solo.html' },
        ],
      },
    ];
    const { container } = render(<SearchPanel {...minimalProps} query="solo" results={mockResults} />);
    expect(container.querySelector('.search-result-name')).toBeInTheDocument();
    // No snippet element should be rendered
    const snippets = container.querySelectorAll('.search-result-snippet');
    expect(snippets.length).toBe(0);
  });

  it('renders multiple result rows', () => {
    const mockResults: SearchResult[] = [
      {
        name: 'JimmyDog.html',
        path: 'NPCs/JimmyDog.html',
        type: 'file',
        matches: [{ line: 1, context: 'First NPC content' }],
      },
      {
        name: 'JackWills.html',
        path: 'NPCs/JackWills.html',
        type: 'file',
        matches: [{ line: 1, context: 'Second NPC content' }],
      },
    ];
    render(<SearchPanel {...minimalProps} query="npc" results={mockResults} />);
    expect(screen.getByText('JimmyDog.html')).toBeInTheDocument();
    expect(screen.getByText('JackWills.html')).toBeInTheDocument();
    expect(screen.getByText('NPCs/JimmyDog.html')).toBeInTheDocument();
    expect(screen.getByText('NPCs/JackWills.html')).toBeInTheDocument();
  });
});