import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';

/**
 * Reminder Service — file-based CRUD for per-user reminders
 * Storage: users/<username>/reminders.json
 */

// Get path to a user's reminders file
function getRemindersFilePath(username) {
  const workspaceDir = getUserWorkspaceDir(username);
  return path.join(workspaceDir, '..', 'reminders.json');
}

// Load reminders for a user, creating the file if it doesn't exist
function loadReminders(username) {
  const filePath = getRemindersFilePath(username);
  if (!fs.existsSync(filePath)) {
    const data = { reminders: [] };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const data = { reminders: [] };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
}

// Save reminders data for a user
function saveReminders(username, data) {
  const filePath = getRemindersFilePath(username);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Generate a unique reminder ID
function generateId() {
  return `rem_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
}

// --- Public API ---

/**
 * Get all reminders for a user
 */
function getAllReminders(username) {
  const data = loadReminders(username);
  return data.reminders;
}

/**
 * Create a new reminder
 * @param {string} username
 * @param {Object} body - { filePath, title, fireAt, recurrence?, weeklyDay? }
 * @returns {Object} the created reminder
 */
function createReminder(username, body) {
  const { filePath, title, fireAt, recurrence = 'none', weeklyDay } = body;

  if (!filePath || !filePath.trim()) {
    throw new Error('File path is required');
  }
  if (!title || !title.trim()) {
    throw new Error('Reminder title is required');
  }
  if (!fireAt) {
    throw new Error('Fire date/time is required');
  }

  // Validate recurrence
  const validRecurrences = ['none', 'daily', 'weekly', 'monthly'];
  if (!validRecurrences.includes(recurrence)) {
    throw new Error(`Invalid recurrence: ${recurrence}. Must be one of: ${validRecurrences.join(', ')}`);
  }

  // For weekly recurrence, require a day of week
  if (recurrence === 'weekly' && (weeklyDay === undefined || weeklyDay === null)) {
    throw new Error('weeklyDay (0=Sun...6=Sat) is required for weekly recurrence');
  }

  const data = loadReminders(username);
  const reminder = {
    id: generateId(),
    filePath: filePath.trim(),
    title: title.trim(),
    fireAt: new Date(fireAt).toISOString(),
    recurrence,
    weeklyDay: recurrence === 'weekly' ? Number(weeklyDay) : undefined,
    status: 'pending',
    thread: [],
    createdAt: new Date().toISOString(),
    username,
  };

  data.reminders.push(reminder);
  saveReminders(username, data);
  return reminder;
}

/**
 * Update a reminder
 * @param {string} username
 * @param {string} id
 * @param {Object} updates - partial reminder object
 * @returns {Object} the updated reminder
 */
function updateReminder(username, id, updates) {
  const data = loadReminders(username);
  const idx = data.reminders.findIndex(r => r.id === id);
  if (idx === -1) {
    throw new Error('Reminder not found');
  }

  const reminder = data.reminders[idx];

  if (updates.filePath !== undefined) {
    if (!updates.filePath.trim()) throw new Error('File path cannot be empty');
    reminder.filePath = updates.filePath.trim();
  }
  if (updates.title !== undefined) {
    if (!updates.title.trim()) throw new Error('Title cannot be empty');
    reminder.title = updates.title.trim();
  }
  if (updates.fireAt !== undefined) {
    reminder.fireAt = new Date(updates.fireAt).toISOString();
  }
  if (updates.recurrence !== undefined) {
    const validRecurrences = ['none', 'daily', 'weekly', 'monthly'];
    if (!validRecurrences.includes(updates.recurrence)) {
      throw new Error('Invalid recurrence value');
    }
    reminder.recurrence = updates.recurrence;
  }
  if (updates.weeklyDay !== undefined) {
    reminder.weeklyDay = Number(updates.weeklyDay);
  }
  if (updates.status !== undefined) {
    const validStatuses = ['pending', 'fired', 'completed', 'converted'];
    if (!validStatuses.includes(updates.status)) {
      throw new Error('Invalid status value');
    }
    reminder.status = updates.status;
  }

  saveReminders(username, data);
  return data.reminders[idx];
}

/**
 * Add a thread note to a reminder
 * @param {string} username
 * @param {string} id
 * @param {string} note
 * @returns {Object} the updated reminder
 */
function addThreadNote(username, id, note) {
  const data = loadReminders(username);
  const idx = data.reminders.findIndex(r => r.id === id);
  if (idx === -1) {
    throw new Error('Reminder not found');
  }

  data.reminders[idx].thread.push({
    note: note.trim(),
    resolvedAt: new Date().toISOString(),
  });
  data.reminders[idx].status = 'completed';
  saveReminders(username, data);
  return data.reminders[idx];
}

/**
 * Convert a fired reminder into a new one (follow-up)
 * @param {string} username
 * @param {string} id
 * @param {string} newFireAt - new ISO timestamp
 * @returns {Object} the new reminder
 */
function convertToNewReminder(username, id, newFireAt) {
  const data = loadReminders(username);
  const idx = data.reminders.findIndex(r => r.id === id);
  if (idx === -1) {
    throw new Error('Reminder not found');
  }

  const original = data.reminders[idx];
  original.status = 'converted';

  const newReminder = {
    id: generateId(),
    filePath: original.filePath,
    title: original.title,
    fireAt: new Date(newFireAt).toISOString(),
    recurrence: original.recurrence,
    weeklyDay: original.weeklyDay,
    status: 'pending',
    thread: [...original.thread],
    createdAt: new Date().toISOString(),
    username,
    convertedFrom: id,
  };

  data.reminders.push(newReminder);
  saveReminders(username, data);
  return newReminder;
}

/**
 * Delete a reminder
 * @param {string} username
 * @param {string} id
 * @returns {Object} { success, id }
 */
function deleteReminder(username, id) {
  const data = loadReminders(username);
  const idx = data.reminders.findIndex(r => r.id === id);
  if (idx === -1) {
    throw new Error('Reminder not found');
  }
  data.reminders.splice(idx, 1);
  saveReminders(username, data);
  return { success: true, id };
}

/**
 * Get fired reminders that should trigger a notification
 * (status === 'pending' and fireAt <= now)
 * Marks them as 'fired' to prevent re-notification
 * @param {string} username
 * @returns {Array} fired reminders
 */
function checkAndFireReminders(username) {
  const data = loadReminders(username);
  const now = new Date();
  const fired = [];

  for (const reminder of data.reminders) {
    if (reminder.status !== 'pending') continue;

    const fireTime = new Date(reminder.fireAt);
    if (fireTime <= now) {
      reminder.status = 'fired';
      fired.push(reminder);
    }
  }

  if (fired.length > 0) {
    saveReminders(username, data);
  }

  return fired;
}

/**
 * Recalculate due dates for recurring reminders that have been fired/completed
 * Advances their fireAt to the next occurrence
 * @param {string} username
 * @returns {Array} updated reminders with new fire dates
 */
function advanceRecurringReminders(username) {
  const data = loadReminders(username);
  const now = new Date();
  const advanced = [];

  for (const reminder of data.reminders) {
    if (reminder.status !== 'fired' && reminder.status !== 'completed') continue;
    if (!reminder.recurrence || reminder.recurrence === 'none') continue;
    if (reminder.status === 'converted') continue;

    let nextFire = new Date(reminder.fireAt);

    switch (reminder.recurrence) {
      case 'daily':
        nextFire.setDate(nextFire.getDate() + 1);
        break;
      case 'weekly': {
        nextFire.setDate(nextFire.getDate() + 7);
        break;
      }
      case 'monthly':
        nextFire.setMonth(nextFire.getMonth() + 1);
        break;
    }

    // Only advance if the next fire is in the future
    if (nextFire > now) {
      reminder.fireAt = nextFire.toISOString();
      reminder.status = 'pending';
      advanced.push(reminder);
    }
  }

  if (advanced.length > 0) {
    saveReminders(username, data);
  }

  return advanced;
}

/**
 * Get reminders grouped by file path
 * @param {string} username
 * @returns {Array} { filePath, reminders }[]
 */
function getRemindersByFile(username) {
  const reminders = getAllReminders(username);
  const map = new Map();

  for (const r of reminders) {
    if (!map.has(r.filePath)) {
      map.set(r.filePath, { filePath: r.filePath, reminders: [] });
    }
    map.get(r.filePath).reminders.push(r);
  }

  // Sort reminders within each file by fireAt
  for (const group of map.values()) {
    group.reminders.sort((a, b) => new Date(a.fireAt) - new Date(b.fireAt));
  }

  return Array.from(map.values());
}

export {
  getAllReminders,
  createReminder,
  updateReminder,
  addThreadNote,
  convertToNewReminder,
  deleteReminder,
  checkAndFireReminders,
  advanceRecurringReminders,
  getRemindersByFile,
};