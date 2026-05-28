import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', async () => ({
  getReminders: vi.fn(),
  createReminderAPI: vi.fn(),
  updateReminderAPI: vi.fn(),
  addReminderThreadNote: vi.fn(),
  convertReminder: vi.fn(),
  deleteReminderAPI: vi.fn(),
  checkReminders: vi.fn(),
}));

import * as api from '../services/api';
const mockGetReminders = api.getReminders as ReturnType<typeof vi.fn>;
const mockCreateReminder = api.createReminderAPI as ReturnType<typeof vi.fn>;
const mockDeleteReminder = api.deleteReminderAPI as ReturnType<typeof vi.fn>;
const mockCheckReminders = api.checkReminders as ReturnType<typeof vi.fn>;
import { useReminders } from './useReminders';

const mockReminder = {
  id: '1',
  filePath: '/file.txt',
  title: 'Remind me',
  fireAt: '2026-05-08T17:00:00Z',
  status: 'pending' as const,
  recurrence: 'none' as const,
  thread: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReminders.mockResolvedValue([mockReminder]);
  mockCreateReminder.mockResolvedValue({ ...mockReminder, id: '2' });
  mockDeleteReminder.mockResolvedValue(undefined);
  mockCheckReminders.mockResolvedValue({ fired: [], advanced: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReminders', () => {
  it('should load reminders on mount', async () => {
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.reminders[0].title).toBe('Remind me');
  });

  it('should create a new reminder', async () => {
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createReminder({
        filePath: '/new.txt',
        title: 'New reminder',
        fireAt: '2026-06-01T12:00:00Z',
      });
    });

    expect(mockCreateReminder).toHaveBeenCalled();
    expect(result.current.reminders).toHaveLength(2);
  });

  it('should remove a reminder', async () => {
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeReminder('1');
    });

    expect(mockDeleteReminder).toHaveBeenCalledWith('1');
    expect(result.current.reminders).toHaveLength(0);
  });

  it('should handle fetch error on mount', async () => {
    mockGetReminders.mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('DB error');
    expect(result.current.reminders).toEqual([]);
  });

  it('checkFired should show toasts for fired reminders', async () => {
    const firedReminder = {
      id: '3', filePath: '/f.txt', title: 'Fired!',
      fireAt: '2026-01-01T00:00:00Z', status: 'fired' as const,
      recurrence: 'none' as const, thread: [],
    };
    mockCheckReminders.mockResolvedValueOnce({ fired: [firedReminder], advanced: [] });

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.checkFired();
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].reminder.id).toBe('3');
    expect(result.current.toasts[0].dismissed).toBe(false);
  });

  it('should group active and completed reminders', async () => {
    mockGetReminders.mockResolvedValue([
      { ...mockReminder, id: '1', status: 'pending' as const },
      { ...mockReminder, id: '4', status: 'completed' as const },
    ]);

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeReminders).toHaveLength(1);
    expect(result.current.completedReminders).toHaveLength(1);
  });

  it('dismissToast should mark toast as dismissed', async () => {
    const firedReminder = {
      id: '3', filePath: '/f.txt', title: 'Fired!',
      fireAt: '2026-01-01T00:00:00Z', status: 'fired' as const,
      recurrence: 'none' as const, thread: [],
    };
    mockCheckReminders.mockResolvedValueOnce({ fired: [firedReminder], advanced: [] });

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.checkFired();
    });

    const toastId = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(toastId);
    });

    expect(result.current.toasts[0].dismissed).toBe(true);
  });
});