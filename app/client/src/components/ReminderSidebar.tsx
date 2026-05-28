import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Bell, X, Trash2, MessageSquare, ChevronDown, ChevronRight, Clock, Repeat, FileText, Plus, FolderOpen } from 'lucide-react';
import { useReminders, type ToastNotification } from '../hooks/useReminders';
import { FilePickerModal } from './FilePickerModal';

interface ReminderSidebarProps {
  width?: number;
  onFileSelect?: (path: string) => void;
  currentFilePath?: string;
}

// Quick time preset buttons
const QUICK_PRESETS: Array<{
  label: string;
  minutes: number | null;
  tomorrow?: boolean;
  today?: boolean;
  hour: number;
}> = [
  { label: '30 min', minutes: 30, hour: 0 },
  { label: '1 hour', minutes: 60, hour: 0 },
  { label: '3 hours', minutes: 180, hour: 0 },
  { label: 'Tomorrow 9am', minutes: null, tomorrow: true, hour: 9 },
  { label: 'End of day', minutes: null, today: true, hour: 18 },
];

// Recurrence options
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

// Day names for weekly picker
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReminderSidebar({ width: propWidth, onFileSelect, currentFilePath }: ReminderSidebarProps) {
  const {
    activeReminders,
    completedReminders,
    loading,
    error,
    toasts,
    createReminder,
    addThreadNote,
    removeReminder,
    dismissToast,
    loadReminders,
    updateReminder,
  } = useReminders();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [fireDateTime, setFireDateTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [weeklyDay, setWeeklyDay] = useState(1); // Monday default
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);
  const [formError, setFormError] = useState('');

  // Expanded file groups
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Thread note inputs
  const [threadInputs, setThreadInputs] = useState<Record<string, string>>({});

  // Auto-populate file field when currentFilePath changes and field is empty
  useEffect(() => {
    if (currentFilePath && !selectedFilePath) {
      setSelectedFilePath(currentFilePath);
    }
  }, [currentFilePath]);

  // Format a datetime for display
  const formatDateTime = useCallback((iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: string, fireAt: string) => {
    const fireTime = new Date(fireAt);
    const now = new Date();
    const diff = fireTime.getTime() - now.getTime();
    const oneHour = 3600000;

    if (status === 'fired') return '#ef4444';
    if (status === 'completed') return '#22c55e';
    if (status === 'converted') return '#6b7280';
    if (diff < 0) return '#ef4444';
    if (diff < oneHour) return '#f59e0b';
    return '#a78bfa';
  }, []);

  // Toggle file group expansion
  const toggleFileGroup = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  // Group active reminders by file
  const groupedReminders = useMemo(() => {
    const map = new Map<string, typeof activeReminders>();
    for (const r of activeReminders) {
      if (!map.has(r.filePath)) map.set(r.filePath, []);
      map.get(r.filePath)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => {
      // Sort by earliest fireAt in each group
      const aMin = Math.min(...a[1].map((r) => new Date(r.fireAt).getTime()));
      const bMin = Math.min(...b[1].map((r) => new Date(r.fireAt).getTime()));
      return aMin - bMin;
    });
  }, [activeReminders]);

  // Handle quick preset
  const applyQuickPreset = useCallback((preset: (typeof QUICK_PRESETS)[number]) => {
    const now = new Date();
    if (preset.minutes !== null) {
      const d = new Date(now.getTime() + preset.minutes * 60000);
      setFireDateTime(d.toISOString().slice(0, 16));
    } else if (preset.today) {
      now.setHours(preset.hour, 0, 0, 0);
      setFireDateTime(now.toISOString().slice(0, 16));
    } else if (preset.tomorrow) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(preset.hour, 0, 0, 0);
      setFireDateTime(d.toISOString().slice(0, 16));
    }
  }, []);

  // Handle create
  const handleCreate = useCallback(async () => {
    setFormError('');

    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!selectedFilePath) { setFormError('Select a file'); return; }
    if (!fireDateTime) { setFormError('Select a date/time'); return; }

    const result = await createReminder({
      filePath: selectedFilePath,
      title: title.trim(),
      fireAt: new Date(fireDateTime).toISOString(),
      recurrence,
      weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
    });

    if (result) {
      setTitle('');
      setSelectedFilePath('');
      setFireDateTime('');
      setRecurrence('none');
      setFormError('');
    }
  }, [title, selectedFilePath, fireDateTime, recurrence, weeklyDay, createReminder]);

  // Handle thread note submit
  const handleThreadSubmit = useCallback(async (reminderId: string) => {
    const note = threadInputs[reminderId]?.trim();
    if (!note) return;
    await addThreadNote(reminderId, note);
    setThreadInputs((prev) => {
      const next = { ...prev };
      delete next[reminderId];
      return next;
    });
  }, [threadInputs, addThreadNote]);

  // Handle file picker close with selection
  const handleFilePicked = useCallback((path: string) => {
    setSelectedFilePath(path);
    setShowFilePickerModal(false);
  }, []);

  const handleFilePickerClose = useCallback(() => {
    setShowFilePickerModal(false);
  }, []);

  const sidebarWidth = propWidth || 280;

  return (
    <div
      className="reminder-sidebar flex flex-col h-full overflow-hidden bg-card border-r border-border"
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border text-sm font-semibold">
        <div className="flex items-center gap-2">
          <Bell size={16} />
          <span>Reminders</span>
        </div>
        <button onClick={loadReminders} title="Refresh" className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
          <Repeat size={14} />
        </button>
      </div>

      {/* Toast Notifications */}
      {toasts.filter((t) => !t.dismissed).length > 0 && (
        <div className="px-2 pt-2">
          {toasts.filter((t) => !t.dismissed).map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} onFileSelect={onFileSelect} formatDateTime={formatDateTime} />
          ))}
        </div>
      )}

      {/* Create Form */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Reminder</h3>

        {/* Title */}
        <input
          type="text"
          placeholder="What to remember..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
        />

        {/* File Picker */}
        <button
          onClick={() => setShowFilePickerModal(true)}
          className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded text-left text-foreground flex items-center gap-1.5 hover:border-primary focus:outline-none focus:border-primary"
        >
          <FolderOpen size={12} className="text-muted-foreground" />
          {selectedFilePath ? (
            <span className="truncate">{selectedFilePath}</span>
          ) : (
            <span className="text-muted-foreground">Select a file...</span>
          )}
        </button>

        {/* File Picker Modal */}
        {showFilePickerModal && (
          <FilePickerModal
            onSelect={handleFilePicked}
            onClose={handleFilePickerClose}
            initialPath={selectedFilePath || currentFilePath || ''}
          />
        )}

        {/* Date/Time */}
        <input
          type="datetime-local"
          value={fireDateTime}
          onChange={(e) => setFireDateTime(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:border-primary"
        />

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyQuickPreset(preset)}
              className="px-2 py-0.5 text-[10px] bg-secondary border border-border rounded text-muted-foreground hover:bg-accent hover:border-primary transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Recurrence */}
        <div className="flex gap-1">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRecurrence(opt.value as any)}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                recurrence === opt.value
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-secondary border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Weekly Day Picker */}
        {recurrence === 'weekly' && (
          <div className="flex gap-1">
            {DAY_NAMES.map((day, i) => (
              <button
                key={day}
                onClick={() => setWeeklyDay(i)}
                className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                  weeklyDay === i
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-secondary border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {/* Error + Create Button */}
        {formError && <div className="text-xs text-destructive">{formError}</div>}
        <button
          onClick={handleCreate}
          className="w-full px-2 py-1.5 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded flex items-center justify-center gap-1.5 transition-opacity"
        >
          <Plus size={14} />
          Create Reminder
        </button>
      </div>

      {/* Reminder List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
        ) : error ? (
          <div className="text-xs text-destructive text-center py-4">{error}</div>
        ) : groupedReminders.length === 0 && completedReminders.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            <Bell size={24} className="mx-auto mb-2 opacity-30" />
            No reminders yet
          </div>
        ) : (
          <>
            {/* Active Reminders grouped by file */}
            {groupedReminders.map(([filePath, reminders]) => (
              <div key={filePath} className="mb-1">
                <button
                  onClick={() => toggleFileGroup(filePath)}
                  className="w-full flex items-center gap-1 px-1 py-1 text-xs hover:bg-accent rounded group"
                >
                  {expandedFiles.has(filePath) ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
                  <FileText size={10} className="text-muted-foreground" />
                  <span className="truncate text-foreground font-medium">{filePath}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{reminders.length}</span>
                </button>

                {expandedFiles.has(filePath) && (
                  <div className="ml-3 space-y-1 mt-1">
                    {reminders.map((r) => (
                      <ReminderItem
                        key={r.id}
                        reminder={r}
                        statusColor={getStatusColor(r.status, r.fireAt)}
                        formatDateTime={formatDateTime}
                        onRemove={removeReminder}
                        onThreadSubmit={handleThreadSubmit}
                        threadValue={threadInputs[r.id] || ''}
                        onThreadChange={(v) => setThreadInputs((prev) => ({ ...prev, [r.id]: v }))}
                        onFileSelect={onFileSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Completed Section */}
            {completedReminders.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1 py-1"
                >
                  {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Completed ({completedReminders.length})
                </button>

                {showCompleted && (
                  <div className="ml-3 space-y-1 mt-1">
                    {completedReminders.map((r) => (
                      <ReminderItem
                        key={r.id}
                        reminder={r}
                        statusColor={getStatusColor(r.status, r.fireAt)}
                        formatDateTime={formatDateTime}
                        onRemove={removeReminder}
                        onThreadSubmit={handleThreadSubmit}
                        threadValue={threadInputs[r.id] || ''}
                        onThreadChange={(v) => setThreadInputs((prev) => ({ ...prev, [r.id]: v }))}
                        onFileSelect={onFileSelect}
                        completed
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onFileSelect?: (path: string) => void;
  formatDateTime: (iso: string) => string;
}

function ToastItem({ toast, onDismiss, onFileSelect, formatDateTime }: ToastItemProps) {
  const { reminder } = toast;
  return (
    <div className="bg-secondary border border-yellow-500/30 rounded px-2 py-1.5 mb-1 flex items-start gap-2 animate-pulse">
      <Bell size={12} className="text-yellow-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{reminder.title}</div>
        <div className="text-[10px] text-muted-foreground">
          <button onClick={() => onFileSelect?.(reminder.filePath)} className="hover:underline hover:text-foreground">
            {reminder.filePath}
          </button>
          {' — '}{formatDateTime(reminder.fireAt)}
        </div>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-muted-foreground hover:text-foreground shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}

interface ReminderItemProps {
  reminder: ReturnType<typeof useReminders>['activeReminders'][number];
  statusColor: string;
  formatDateTime: (iso: string) => string;
  onRemove: (id: string) => void;
  onThreadSubmit: (id: string) => void;
  threadValue: string;
  onThreadChange: (value: string) => void;
  onFileSelect?: (path: string) => void;
  completed?: boolean;
}

function ReminderItem({ reminder, statusColor, formatDateTime, onRemove, onThreadSubmit, threadValue, onThreadChange, onFileSelect, completed }: ReminderItemProps) {
  const [showThread, setShowThread] = useState(false);

  return (
    <div
      className="rounded border px-2 py-1.5"
      style={{
        borderColor: statusColor + '30',
        background: completed ? 'hsl(var(--input))' : 'hsl(var(--secondary))',
      }}
    >
      <div className="flex items-start gap-2">
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full mt-1 shrink-0"
          style={{ backgroundColor: statusColor }}
          title={`Status: ${reminder.status}`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{reminder.title}</span>
            {reminder.recurrence && reminder.recurrence !== 'none' && (
              <span title={`Repeats: ${reminder.recurrence}`}><Repeat size={10} className="text-muted-foreground shrink-0" /></span>
            )}
            {reminder.thread.length > 0 && (
              <span title={`${reminder.thread.length} note(s)`}><MessageSquare size={10} className="text-muted-foreground shrink-0" /></span>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock size={8} />
            <span>{formatDateTime(reminder.fireAt)}</span>
            <span className="text-muted-foreground/50">·</span>
            <button onClick={() => onFileSelect?.(reminder.filePath)} className="hover:underline hover:text-foreground">
              {reminder.filePath}
            </button>
          </div>

          {/* Thread notes display */}
          {reminder.thread.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {reminder.thread.map((t, i) => (
                <div key={i} className="text-[10px] text-foreground bg-secondary rounded px-1.5 py-0.5">
                  {t.note}
                  <span className="text-muted-foreground ml-1">{new Date(t.resolvedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {(reminder.status === 'fired' || reminder.status === 'pending') && (
            <button
              onClick={() => setShowThread((v) => !v)}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Add note"
            >
              <MessageSquare size={12} />
            </button>
          )}
          <button
            onClick={() => onRemove(reminder.id)}
            className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Thread input */}
      {showThread && (
        <div className="mt-1.5 flex gap-1">
          <input
            type="text"
            placeholder="Add a note..."
            value={threadValue}
            onChange={(e) => onThreadChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onThreadSubmit(reminder.id); }}
            className="flex-1 px-1.5 py-0.5 text-[10px] bg-input border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            autoFocus
          />
          <button
            onClick={() => onThreadSubmit(reminder.id)}
            disabled={!threadValue.trim()}
            className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

export default ReminderSidebar;