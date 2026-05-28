import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileExplorer } from './FileExplorer';

// ---- Mock dependencies ----
vi.mock('lucide-react', () => {
  const MockIcon: React.FC = (props: any) => <svg data-testid="mock-icon" {...props} />;
  const mockFn = vi.fn(() => MockIcon);
  return {
    Folder: mockFn, File: mockFn, ChevronRight: mockFn, Trash2: mockFn,
    Pencil: mockFn, ArrowLeft: mockFn, Plus: mockFn, Home: mockFn,
    Upload: mockFn, Copy: mockFn, ArrowRightLeft: mockFn, Star: mockFn,
    ChevronDown: mockFn, X: mockFn, BookOpen: mockFn, Undo2: mockFn,
    Redo2: mockFn, CheckSquare: mockFn, Square: mockFn, Layers: mockFn,
  };
});

vi.mock('../hooks/useTags', () => ({
  useTags: vi.fn().mockReturnValue({ tags: [], addTag: vi.fn(), removeTag: vi.fn(), loading: false }),
}));

vi.mock('./InlineRenameInput', () => ({
  InlineRenameInput: vi.fn(() => <input data-testid="inline-rename" />),
}));

describe('FileExplorer', () => {
  const minimalProps = {
    files: [],
    explorerPath: '',
    currentPath: null,
    loading: false,
    onFileSelect: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onCopy: vi.fn(),
    onMove: vi.fn(),
    onBack: vi.fn(),
    onBackToRoot: vi.fn(),
    onBackToSegment: vi.fn(),
    onNewFolder: vi.fn(),
    onUploadFiles: vi.fn(),
    onCompile: vi.fn(),
    width: 300,
    starredFiles: [],
    onToggleStar: vi.fn(),
    isStarred: vi.fn().mockReturnValue(false),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    selectionMode: false,
    selectedPaths: new Set<string>(),
    onToggleSelectionMode: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onBatchDelete: vi.fn(),
    onBatchCopy: vi.fn(),
    onBatchMove: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<FileExplorer {...minimalProps} />);
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });
});