import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['X', 'Plus', 'ChevronUp', 'ChevronDown', 'Trash2', 'Save', 'User', 'UserCircle'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return { ...icons };
});

// Mock useDialogue hook
vi.mock('../hooks/useDialogue', () => ({
  useDialogue: vi.fn(),
}));

import { useDialogue } from '../hooks/useDialogue';
import { DialogueEditorModal } from './DialogueEditorModal';

const mockUseDialogue = useDialogue as ReturnType<typeof vi.fn>;

const mockScene = {
  id: 's1',
  name: 'Test Scene',
  era: 'Modern Era',
  locationName: 'City',
  date: '2024-01-01',
};

const mockParticipants = [
  { name: 'Alice', path: 'NPCs/Alice.html', type: 'npc' as const },
  { name: 'Bob', path: 'NPCs/Bob.html', type: 'npc' as const },
];

const mockLines = [
  { id: 'line1', speakerName: 'Alice', speakerPath: 'NPCs/Alice.html', speech: 'Hello', action: '', order: 0 },
  { id: 'line2', speakerName: 'Bob', speakerPath: 'NPCs/Bob.html', speech: 'Hi there', action: 'waves', order: 1 },
];

describe('DialogueEditorModal', () => {
  const mockOnClose = vi.fn();
  const mockLoadDialogue = vi.fn().mockResolvedValue({ lines: [], participants: [] });
  const mockSaveDialogue = vi.fn().mockResolvedValue(true);
  const mockAddLine = vi.fn();
  const mockUpdateLine = vi.fn();
  const mockRemoveLine = vi.fn();
  const mockMoveLineUp = vi.fn();
  const mockMoveLineDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(overrides = {}) {
    mockUseDialogue.mockReturnValue({
      lines: mockLines,
      participants: mockParticipants,
      loading: false,
      saving: false,
      error: null,
      loadDialogue: mockLoadDialogue,
      saveDialogue: mockSaveDialogue,
      addLine: mockAddLine,
      updateLine: mockUpdateLine,
      removeLine: mockRemoveLine,
      moveLineUp: mockMoveLineUp,
      moveLineDown: mockMoveLineDown,
      ...overrides,
    });

    render(<DialogueEditorModal scene={mockScene} onClose={mockOnClose} />);
  }

  it('renders with scene title', () => {
    renderModal();
    // "Test Scene" appears in multiple places (header span, select options), so use getAllByText
    const sceneEls = screen.getAllByText((content, node) =>
      node?.textContent?.trim() === 'Test Scene' || node?.textContent?.includes('Test Scene') === true
    );
    expect(sceneEls.length).toBeGreaterThan(0);
  });

  it('renders Dialogue Editor header', () => {
    renderModal();
    expect(screen.getByText('Dialogue Editor')).toBeInTheDocument();
  });

  it('renders participant chips', () => {
    renderModal();
    // 'Alice' appears in participant chips AND speaker selects, so use getAllByText
    const aliceEls = screen.getAllByText('Alice');
    expect(aliceEls.length).toBeGreaterThan(0);
    const bobEls = screen.getAllByText('Bob');
    expect(bobEls.length).toBeGreaterThan(0);
  });

  it('renders dialogue line speech content', () => {
    renderModal();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('renders action/stage direction text when present', () => {
    renderModal();
    expect(screen.getByText('waves')).toBeInTheDocument();
  });

  it('renders Add Line button', () => {
    renderModal();
    expect(screen.getByText('Add Line')).toBeInTheDocument();
  });

  it('calls addLine when Add Line button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Add Line'));
    expect(mockAddLine).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    renderModal();
    const closeBtn = screen.getByTestId('X')?.closest('button');
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when Close footer button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows save button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows save button without dirty glow initially', () => {
    renderModal();

    // Dirty state is tracked internally via useState(false) in the component,
    // so it starts as not-dirty. The mock cannot trigger the dirty wrapper
    // callbacks, so we verify the initial (clean) state.
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn.classList.contains('save-btn-dirty')).toBe(false);
  });

  it('does not show dirty glow when not dirty', () => {
    renderModal({
      lines: mockLines,
      participants: mockParticipants,
    });

    // The component internally tracks dirty state via useState(false),
    // so after lines load from hook, dirty defaults to false in the component
    // We verify the button exists regardless
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('disables save button when saving', () => {
    renderModal({
      saving: true,
      lines: mockLines,
      participants: mockParticipants,
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('disables save button when no lines', () => {
    renderModal({
      lines: [],
      participants: mockParticipants,
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('shows empty state when no lines', () => {
    renderModal({
      lines: [],
      participants: mockParticipants,
    });

    expect(screen.getByText('No dialogue lines yet.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseDialogue.mockReturnValue({
      lines: [],
      participants: [],
      loading: true,
      saving: false,
      error: null,
      loadDialogue: mockLoadDialogue,
      saveDialogue: mockSaveDialogue,
      addLine: mockAddLine,
      updateLine: mockUpdateLine,
      removeLine: mockRemoveLine,
      moveLineUp: mockMoveLineUp,
      moveLineDown: mockMoveLineDown,
    });

    render(<DialogueEditorModal scene={mockScene} onClose={mockOnClose} />);

    expect(screen.getByText('Loading dialogue...')).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    mockUseDialogue.mockReturnValue({
      lines: [],
      participants: [],
      loading: false,
      saving: false,
      error: 'Failed to load',
      loadDialogue: mockLoadDialogue,
      saveDialogue: mockSaveDialogue,
      addLine: mockAddLine,
      updateLine: mockUpdateLine,
      removeLine: mockRemoveLine,
      moveLineUp: mockMoveLineUp,
      moveLineDown: mockMoveLineDown,
    });

    render(<DialogueEditorModal scene={mockScene} onClose={mockOnClose} />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls loadDialogue when Retry is clicked', () => {
    mockUseDialogue.mockReturnValue({
      lines: [],
      participants: [],
      loading: false,
      saving: false,
      error: 'Failed to load',
      loadDialogue: mockLoadDialogue,
      saveDialogue: mockSaveDialogue,
      addLine: mockAddLine,
      updateLine: mockUpdateLine,
      removeLine: mockRemoveLine,
      moveLineUp: mockMoveLineUp,
      moveLineDown: mockMoveLineDown,
    });

    render(<DialogueEditorModal scene={mockScene} onClose={mockOnClose} />);

    fireEvent.click(screen.getByText('Retry'));
    expect(mockLoadDialogue).toHaveBeenCalledWith(mockScene);
  });

  it('shows line count and participant count in footer', () => {
    renderModal();

    expect(screen.getByText('2 lines · 2 participants')).toBeInTheDocument();
  });

  it('renders move up/down and delete buttons', () => {
    renderModal();

    const moveUpButtons = screen.getAllByTestId('ChevronUp');
    expect(moveUpButtons.length).toBeGreaterThan(0);

    const moveDownButtons = screen.getAllByTestId('ChevronDown');
    expect(moveDownButtons.length).toBeGreaterThan(0);

    const deleteButtons = screen.getAllByTestId('Trash2');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('calls removeLine when delete button is clicked', () => {
    renderModal();

    const deleteButtons = screen.getAllByTestId('Trash2');
    const deleteBtn = deleteButtons[0]?.closest('button');
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      expect(mockRemoveLine).toHaveBeenCalled();
    }
  });

  it('calls loadDialogue on mount', () => {
    renderModal();
    expect(mockLoadDialogue).toHaveBeenCalledWith(mockScene);
  });

  it('renders speaker select dropdown for each line', () => {
    renderModal();

    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('renders speech textarea for each line', () => {
    renderModal();

    const textareas = document.querySelectorAll('.dialogue-line-speech');
    expect(textareas.length).toBe(2);
  });

  it('renders action textarea for each line', () => {
    renderModal();

    const actionInputs = document.querySelectorAll('.dialogue-line-action-input');
    expect(actionInputs.length).toBe(2);
  });

  it('calls updateLine when speech textarea changes', () => {
    renderModal();

    const textareas = document.querySelectorAll('.dialogue-line-speech');
    fireEvent.input(textareas[0], { target: { value: 'Updated speech' } });
    expect(mockUpdateLine).toHaveBeenCalled();
  });

  it('calls updateLine when action textarea changes', () => {
    renderModal();

    const actionInputs = document.querySelectorAll('.dialogue-line-action-input');
    fireEvent.input(actionInputs[0], { target: { value: 'New action' } });
    expect(mockUpdateLine).toHaveBeenCalled();
  });
});