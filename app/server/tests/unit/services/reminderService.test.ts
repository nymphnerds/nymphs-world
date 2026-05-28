import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock authService before importing reminderService
let mockWorkspaceDir = '/tmp/mock-workspace';
let tempRoot = '';

vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: () => mockWorkspaceDir,
}));

import * as reminderService from '../../../src/services/reminderService.js';

describe('reminderService (functional with temp workspace)', () => {
  const testUser = 'testuser-rem';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-rem-'));
    mockWorkspaceDir = path.join(tempRoot, 'workspace');
    fs.mkdirSync(mockWorkspaceDir, { recursive: true });
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  // ─── getAllReminders ───

  describe('getAllReminders()', () => {
    it('returns empty array for new user', () => {
      const reminders = reminderService.getAllReminders(testUser);
      expect(reminders).toEqual([]);
    });

    it('returns reminders after creation', () => {
      reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Review doc',
        fireAt: '2026-01-01T00:00:00.000Z',
      });
      const reminders = reminderService.getAllReminders(testUser);
      expect(reminders.length).toBe(1);
      expect(reminders[0].title).toBe('Review doc');
    });

    it('creates reminders.json file on first call', () => {
      reminderService.getAllReminders(testUser);
      const remindersFile = path.join(tempRoot, 'reminders.json');
      expect(fs.existsSync(remindersFile)).toBe(true);
      const data = JSON.parse(fs.readFileSync(remindersFile, 'utf-8'));
      expect(data.reminders).toEqual([]);
    });
  });

  // ─── createReminder ───

  describe('createReminder()', () => {
    it('creates a reminder with all required fields', () => {
      const reminder = reminderService.createReminder(testUser, {
        filePath: 'notes.html',
        title: 'Follow up',
        fireAt: '2026-06-01T10:00:00.000Z',
      });

      expect(reminder.id).toMatch(/^rem_/);
      expect(reminder.filePath).toBe('notes.html');
      expect(reminder.title).toBe('Follow up');
      expect(reminder.recurrence).toBe('none');
      expect(reminder.status).toBe('pending');
      expect(reminder.thread).toEqual([]);
      expect(reminder.username).toBe(testUser);
      expect(reminder.createdAt).toBeDefined();
    });

    it('trims whitespace from filePath and title', () => {
      const reminder = reminderService.createReminder(testUser, {
        filePath: '  notes.html  ',
        title: '  Trimmed  ',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      expect(reminder.filePath).toBe('notes.html');
      expect(reminder.title).toBe('Trimmed');
    });

    it('throws when filePath is missing', () => {
      expect(() =>
        reminderService.createReminder(testUser, {
          filePath: '',
          title: 'No path',
          fireAt: '2026-06-01T10:00:00.000Z',
        })
      ).toThrow('File path is required');
    });

    it('throws when title is missing', () => {
      expect(() =>
        reminderService.createReminder(testUser, {
          filePath: 'doc.html',
          title: '',
          fireAt: '2026-06-01T10:00:00.000Z',
        })
      ).toThrow('Reminder title is required');
    });

    it('throws when fireAt is missing', () => {
      expect(() =>
        reminderService.createReminder(testUser, {
          filePath: 'doc.html',
          title: 'No date',
          fireAt: null as any,
        })
      ).toThrow('Fire date/time is required');
    });

    it('supports daily recurrence', () => {
      const reminder = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Daily task',
        fireAt: '2026-06-01T10:00:00.000Z',
        recurrence: 'daily',
      });
      expect(reminder.recurrence).toBe('daily');
    });

    it('supports weekly recurrence with weeklyDay', () => {
      const reminder = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Weekly meeting',
        fireAt: '2026-06-01T10:00:00.000Z',
        recurrence: 'weekly',
        weeklyDay: 1,
      });
      expect(reminder.recurrence).toBe('weekly');
      expect(reminder.weeklyDay).toBe(1);
    });

    it('throws for weekly without weeklyDay', () => {
      expect(() =>
        reminderService.createReminder(testUser, {
          filePath: 'doc.html',
          title: 'Weekly no day',
          fireAt: '2026-06-01T10:00:00.000Z',
          recurrence: 'weekly',
        })
      ).toThrow('weeklyDay');
    });

    it('throws for invalid recurrence', () => {
      expect(() =>
        reminderService.createReminder(testUser, {
          filePath: 'doc.html',
          title: 'Bad recurrence',
          fireAt: '2026-06-01T10:00:00.000Z',
          recurrence: 'yearly' as any,
        })
      ).toThrow('Invalid recurrence');
    });
  });

  // ─── updateReminder ───

  describe('updateReminder()', () => {
    it('updates title', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Original',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      const updated = reminderService.updateReminder(testUser, created.id, {
        title: 'Updated',
      });
      expect(updated.title).toBe('Updated');
      expect(updated.filePath).toBe('doc.html');
    });

    it('updates multiple fields', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Original',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      const updated = reminderService.updateReminder(testUser, created.id, {
        title: 'New Title',
        fireAt: '2026-07-01T10:00:00.000Z',
        status: 'fired',
      });
      expect(updated.title).toBe('New Title');
      expect(updated.fireAt).toContain('2026-07');
      expect(updated.status).toBe('fired');
    });

    it('throws when reminder not found', () => {
      expect(() =>
        reminderService.updateReminder(testUser, 'rem_nonexistent', { title: 'X' })
      ).toThrow('Reminder not found');
    });

    it('throws on empty title update', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Original',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      expect(() =>
        reminderService.updateReminder(testUser, created.id, { title: '' })
      ).toThrow('Title cannot be empty');
    });

    it('throws on empty filePath update', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Test',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      expect(() =>
        reminderService.updateReminder(testUser, created.id, { filePath: '' })
      ).toThrow('File path cannot be empty');
    });

    it('throws on invalid recurrence update', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Test',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      expect(() =>
        reminderService.updateReminder(testUser, created.id, { recurrence: 'invalid' as any })
      ).toThrow('Invalid recurrence');
    });

    it('throws on invalid status update', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Test',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      expect(() =>
        reminderService.updateReminder(testUser, created.id, { status: 'bogus' as any })
      ).toThrow('Invalid status');
    });
  });

  // ─── deleteReminder ───

  describe('deleteReminder()', () => {
    it('deletes a reminder', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Delete me',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      const result = reminderService.deleteReminder(testUser, created.id);
      expect(result).toEqual({ success: true, id: created.id });
      expect(reminderService.getAllReminders(testUser).length).toBe(0);
    });

    it('throws when reminder not found', () => {
      expect(() =>
        reminderService.deleteReminder(testUser, 'rem_nonexistent')
      ).toThrow('Reminder not found');
    });
  });

  // ─── addThreadNote ───

  describe('addThreadNote()', () => {
    it('adds a thread note and sets status to completed', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Thread test',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      const updated = reminderService.addThreadNote(
        testUser,
        created.id,
        'Handled in meeting'
      );
      expect(updated.thread.length).toBe(1);
      expect(updated.thread[0].note).toBe('Handled in meeting');
      expect(updated.thread[0].resolvedAt).toBeDefined();
      expect(updated.status).toBe('completed');
    });

    it('throws when reminder not found', () => {
      expect(() =>
        reminderService.addThreadNote(testUser, 'rem_nonexistent', 'note')
      ).toThrow('Reminder not found');
    });
  });

  // ─── convertToNewReminder ───

  describe('convertToNewReminder()', () => {
    it('creates a follow-up and marks original as converted', () => {
      const created = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Follow up',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      const newReminder = reminderService.convertToNewReminder(
        testUser,
        created.id,
        '2026-07-01T10:00:00.000Z'
      );

      expect(newReminder.id).not.toBe(created.id);
      expect(newReminder.title).toBe('Follow up');
      expect(newReminder.filePath).toBe('doc.html');
      expect(newReminder.convertedFrom).toBe(created.id);
      expect(newReminder.status).toBe('pending');

      const all = reminderService.getAllReminders(testUser);
      const original = all.find((r: any) => r.id === created.id);
      expect(original!.status).toBe('converted');
    });

    it('throws when reminder not found', () => {
      expect(() =>
        reminderService.convertToNewReminder(
          testUser,
          'rem_nonexistent',
          '2026-07-01T10:00:00.000Z'
        )
      ).toThrow('Reminder not found');
    });
  });

  // ─── checkAndFireReminders ───

  describe('checkAndFireReminders()', () => {
    it('fires overdue reminders', () => {
      reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Overdue',
        fireAt: '2020-01-01T00:00:00.000Z',
      });
      const fired = reminderService.checkAndFireReminders(testUser);
      expect(fired.length).toBe(1);
      expect(fired[0].status).toBe('fired');
    });

    it('does not fire future reminders', () => {
      reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Future',
        fireAt: '2099-12-31T23:59:59.999Z',
      });
      const fired = reminderService.checkAndFireReminders(testUser);
      expect(fired.length).toBe(0);
    });

    it('skips non-pending reminders', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Already fired',
        fireAt: '2020-01-01T00:00:00.000Z',
      });
      reminderService.updateReminder(testUser, r.id, { status: 'fired' });
      const fired = reminderService.checkAndFireReminders(testUser);
      expect(fired.length).toBe(0);
    });
  });

  // ─── advanceRecurringReminders ───

  describe('advanceRecurringReminders()', () => {
    // Use future dates so nextFire > now check passes
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const nextMonth = new Date(Date.now() + 86400000 * 30).toISOString();

    it('advances daily fired reminder by 1 day', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Daily',
        fireAt: tomorrow,
        recurrence: 'daily',
      });
      reminderService.updateReminder(testUser, r.id, { status: 'fired' });
      const advanced = reminderService.advanceRecurringReminders(testUser);
      expect(advanced.length).toBe(1);
      expect(advanced[0].status).toBe('pending');
      expect(new Date(advanced[0].fireAt).getTime()).toBeGreaterThan(new Date(tomorrow).getTime());
    });

    it('advances weekly fired reminder by 7 days', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Weekly',
        fireAt: tomorrow,
        recurrence: 'weekly',
        weeklyDay: 1,
      });
      reminderService.updateReminder(testUser, r.id, { status: 'fired' });
      const advanced = reminderService.advanceRecurringReminders(testUser);
      expect(advanced.length).toBe(1);
      expect(new Date(advanced[0].fireAt).getTime()).toBeGreaterThan(new Date(tomorrow).getTime());
    });

    it('advances monthly completed reminder by 1 month', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Monthly',
        fireAt: nextMonth,
        recurrence: 'monthly',
      });
      reminderService.updateReminder(testUser, r.id, { status: 'completed' });
      const advanced = reminderService.advanceRecurringReminders(testUser);
      expect(advanced.length).toBe(1);
      expect(new Date(advanced[0].fireAt).getTime()).toBeGreaterThan(new Date(nextMonth).getTime());
    });

    it('skips recurrence=none reminders', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Once',
        fireAt: '2020-01-01T00:00:00.000Z',
        recurrence: 'none',
      });
      reminderService.updateReminder(testUser, r.id, { status: 'fired' });
      const advanced = reminderService.advanceRecurringReminders(testUser);
      expect(advanced.length).toBe(0);
    });

    it('skips converted reminders', () => {
      const r = reminderService.createReminder(testUser, {
        filePath: 'doc.html',
        title: 'Converted',
        fireAt: '2020-01-01T00:00:00.000Z',
        recurrence: 'daily',
      });
      reminderService.updateReminder(testUser, r.id, { status: 'converted' });
      const advanced = reminderService.advanceRecurringReminders(testUser);
      expect(advanced.length).toBe(0);
    });
  });

  // ─── getRemindersByFile ───

  describe('getRemindersByFile()', () => {
    it('groups reminders by filePath', () => {
      reminderService.createReminder(testUser, {
        filePath: 'a.html',
        title: 'A1',
        fireAt: '2026-06-01T10:00:00.000Z',
      });
      reminderService.createReminder(testUser, {
        filePath: 'a.html',
        title: 'A2',
        fireAt: '2026-06-02T10:00:00.000Z',
      });
      reminderService.createReminder(testUser, {
        filePath: 'b.html',
        title: 'B1',
        fireAt: '2026-06-01T10:00:00.000Z',
      });

      const groups = reminderService.getRemindersByFile(testUser);
      expect(groups.length).toBe(2);

      const groupA = groups.find((g: any) => g.filePath === 'a.html');
      expect(groupA!.reminders.length).toBe(2);
      expect(new Date(groupA!.reminders[0].fireAt).getTime()).toBeLessThan(new Date(groupA!.reminders[1].fireAt).getTime());

      const groupB = groups.find((g: any) => g.filePath === 'b.html');
      expect(groupB!.reminders.length).toBe(1);
    });

    it('returns empty array when no reminders', () => {
      const groups = reminderService.getRemindersByFile(testUser);
      expect(groups).toEqual([]);
    });
  });
});