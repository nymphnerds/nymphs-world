import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getReminders,
  createReminderAPI,
  updateReminderAPI,
  addReminderThreadNote,
  convertReminder,
  deleteReminderAPI,
  checkReminders,
  type Reminder,
} from '../services/api';

export interface ToastNotification {
  id: string;
  reminder: Reminder;
  dismissed: boolean;
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastIdCounter = useRef(0);

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getReminders();
      setReminders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for fired reminders and show toasts
  const checkFired = useCallback(async () => {
    try {
      const { fired, advanced } = await checkReminders();

      if (fired.length > 0) {
        const newToasts: ToastNotification[] = fired.map((r) => ({
          id: `toast_${++toastIdCounter.current}_${Date.now()}`,
          reminder: r,
          dismissed: false,
        }));
        setToasts((prev) => [...prev, ...newToasts]);

        // Auto-dismiss toasts after 15 seconds
        setTimeout(() => {
          setToasts((prev) =>
            prev.map((t) =>
              newToasts.find((nt) => nt.id === t.id) ? { ...t, dismissed: true } : t
            )
          );
        }, 15000);
      }

      if (advanced.length > 0) {
        // Recurring reminders advanced — reload to show updated dates
        loadReminders();
      }

      if (fired.length > 0 || advanced.length > 0) {
        loadReminders();
      }
    } catch {
      // Silently fail — checking is non-critical
    }
  }, [loadReminders]);

  // Poll every 30 seconds for fired reminders
  useEffect(() => {
    loadReminders();
    const interval = setInterval(checkFired, 30000);
    return () => clearInterval(interval);
  }, [loadReminders, checkFired]);

  const createReminder = useCallback(
    async (data: {
      filePath: string;
      title: string;
      fireAt: string;
      recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
      weeklyDay?: number;
    }) => {
      try {
        const reminder = await createReminderAPI(data);
        setReminders((prev) => [...prev, reminder]);
        return reminder;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create reminder');
        return null;
      }
    },
    []
  );

  const updateReminder = useCallback(
    async (id: string, updates: Partial<Reminder>) => {
      try {
        const updated = await updateReminderAPI(id, updates);
        setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update reminder');
        return null;
      }
    },
    []
  );

  const addThreadNote = useCallback(
    async (id: string, note: string) => {
      try {
        const updated = await addReminderThreadNote(id, note);
        setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add thread note');
        return null;
      }
    },
    []
  );

  const convert = useCallback(
    async (id: string, newFireAt: string) => {
      try {
        const newReminder = await convertReminder(id, newFireAt);
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'converted' as const } : r))
        );
        setReminders((prev) => [...prev, newReminder]);
        return newReminder;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert reminder');
        return null;
      }
    },
    []
  );

  const removeReminder = useCallback(
    async (id: string) => {
      try {
        await deleteReminderAPI(id);
        setReminders((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete reminder');
      }
    },
    []
  );

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.map((t) => (t.id === toastId ? { ...t, dismissed: true } : t)));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Group reminders by status
  const activeReminders = reminders.filter(
    (r) => r.status === 'pending' || r.status === 'fired'
  );
  const completedReminders = reminders.filter(
    (r) => r.status === 'completed' || r.status === 'converted'
  );

  // Sort active by fireAt ascending
  activeReminders.sort((a, b) => new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime());

  return {
    reminders,
    activeReminders,
    completedReminders,
    loading,
    error,
    toasts,
    toastCount: toasts.filter((t) => !t.dismissed).length,
    loadReminders,
    createReminder,
    updateReminder,
    addThreadNote,
    convert,
    removeReminder,
    dismissToast,
    clearToasts,
    checkFired,
  };
}