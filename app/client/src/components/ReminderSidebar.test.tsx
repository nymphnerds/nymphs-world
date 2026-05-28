import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReminderSidebar } from './ReminderSidebar';

// ---- Mock useReminders hook ----
const mockReminders = [
  {
    id: '1',
    filePath: 'Lore/character.html',
    title: 'Review character sheet',
    fireAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending' as const,
    recurrence: 'none' as const,
    thread: [],
  },
  {
    id: '2',
    filePath: 'Lore/character.html',
    title: 'Add quest reference',
    fireAt: new Date(Date.now() + 7200000).toISOString(),
    status: 'completed' as const,
    recurrence: 'none' as const,
    thread: [{ note: 'Done', resolvedAt: new Date().toISOString() }],
  },
];

const mockUseReminders = vi.fn().mockReturnValue({
  activeReminders: [mockReminders[0]],
  completedReminders: [mockReminders[1]],
  loading: false,
  error: null,
  toasts: [],
  createReminder: vi.fn().mockResolvedValue({ id: '3', filePath: 'x', title: 'test', fireAt: '', status: 'pending', thread: [] }),
  addThreadNote: vi.fn().mockResolvedValue(undefined),
  removeReminder: vi.fn().mockResolvedValue(undefined),
  dismissToast: vi.fn(),
  loadReminders: vi.fn().mockResolvedValue(undefined),
  updateReminder: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../hooks/useReminders', () => ({
  useReminders: () => mockUseReminders(),
}));

// ---- Mock FilePickerModal ----
vi.mock('./FilePickerModal', () => ({
  FilePickerModal: vi.fn(({ onSelect, onClose }) => (
    <div data-testid="file-picker-modal">
      <button onClick={() => onSelect('Lore/test.html')}>Pick</button>
      <button onClick={onClose}>Close</button>
    </div>
  )),
}));

// ---- Mock lucide-react ----
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['Bell', 'X', 'Trash2', 'MessageSquare', 'ChevronDown', 'ChevronRight', 'Clock', 'Repeat', 'FileText', 'Plus', 'FolderOpen'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return icons;
});

describe('ReminderSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReminders.mockReturnValue({
      activeReminders: [mockReminders[0]],
      completedReminders: [mockReminders[1]],
      loading: false,
      error: null,
      toasts: [],
      createReminder: vi.fn().mockResolvedValue({ id: '3', filePath: 'x', title: 'test', fireAt: '', status: 'pending', thread: [] }),
      addThreadNote: vi.fn().mockResolvedValue(undefined),
      removeReminder: vi.fn().mockResolvedValue(undefined),
      dismissToast: vi.fn(),
      loadReminders: vi.fn().mockResolvedValue(undefined),
      updateReminder: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders the header with Reminders title', () => {
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="Lore/character.html" />);
    expect(screen.getByText('Reminders')).toBeTruthy();
  });

  it('renders empty state when no reminders exist', () => {
    mockUseReminders.mockReturnValue({
      ...mockUseReminders(),
      activeReminders: [],
      completedReminders: [],
    });
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="" />);
    expect(screen.getByText('No reminders yet')).toBeTruthy();
  });

  it('renders loading state', () => {
    mockUseReminders.mockReturnValue({
      ...mockUseReminders(),
      loading: true,
    });
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders error state', () => {
    mockUseReminders.mockReturnValue({
      ...mockUseReminders(),
      error: 'Connection failed',
    });
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="" />);
    expect(screen.getByText('Connection failed')).toBeTruthy();
  });

  it('renders the create reminder form', () => {
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="Lore/character.html" />);
    expect(screen.getByPlaceholderText('What to remember...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Reminder' })).toBeTruthy();
  });

  it('shows form validation error when title is missing', async () => {
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="Lore/character.html" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Reminder' }));
    expect(screen.getByText('Title is required')).toBeTruthy();
  });

  it('calls createReminder when form is valid', async () => {
    render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="Lore/character.html" />);

    const titleInput = screen.getByPlaceholderText('What to remember...');
    fireEvent.change(titleInput, { target: { value: 'Test reminder' } });

    // Set datetime via datetime-local input
    const dateTimeInput = document.querySelector('input[type="datetime-local"]');
    if (dateTimeInput) {
      fireEvent.change(dateTimeInput, { target: { value: '2026-06-01T10:00' } });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Create Reminder' }));

    await waitFor(() => {
      expect(mockUseReminders().createReminder).toHaveBeenCalled();
    });
  });

  it('calls removeReminder when delete button is clicked', async () => {
    const { container } = render(<ReminderSidebar onFileSelect={vi.fn()} currentFilePath="Lore/character.html" />);

    // There should be active reminders rendered in a file group
    // Find the group header button and expand it
    const allButtons = container.querySelectorAll('button');
    // Find a button that contains "character.html" text (the group header)
    let groupBtn: Element | null = null;
    for (const btn of Array.from(allButtons)) {
      if (btn.textContent?.includes('character.html') && btn.textContent?.includes('1')) {
        groupBtn = btn;
        break;
      }
    }
    expect(groupBtn).toBeTruthy();
    if (groupBtn) {
      fireEvent.click(groupBtn);
    }

    // After expanding, the Trash2 icon should be rendered in the ReminderItem
    await waitFor(() => {
      const trashIcons = screen.getAllByTestId('Trash2');
      expect(trashIcons.length).toBeGreaterThan(0);
    }, { timeout: 1000 });

    const trashIcons = screen.getAllByTestId('Trash2');
    const deleteBtn = trashIcons[0].closest('button');
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
    }

    await waitFor(() => {
      expect(mockUseReminders().removeReminder).toHaveBeenCalledWith('1');
    }, { timeout: 1000 });
  });
});