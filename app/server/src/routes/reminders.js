import express from 'express';
import {
  getAllReminders,
  createReminder,
  updateReminder,
  addThreadNote,
  convertToNewReminder,
  deleteReminder,
  checkAndFireReminders,
  advanceRecurringReminders,
  getRemindersByFile,
} from '../services/reminderService.js';

const router = express.Router();

// GET /api/reminders — get all reminders for the authenticated user
router.get('/', (req, res) => {
  try {
    const username = req.user.username;
    const reminders = getAllReminders(username);
    res.json({ reminders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reminders/grouped — get reminders grouped by file
router.get('/grouped', (req, res) => {
  try {
    const username = req.user.username;
    const groups = getRemindersByFile(username);
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reminders — create a new reminder
router.post('/', (req, res) => {
  try {
    const username = req.user.username;
    const reminder = createReminder(username, req.body);
    res.status(201).json({ reminder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/reminders/:id — update a reminder
router.put('/:id', (req, res) => {
  try {
    const username = req.user.username;
    const reminder = updateReminder(username, req.params.id, req.body);
    res.json({ reminder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/reminders/:id/thread — add a thread note to a reminder
router.post('/:id/thread', (req, res) => {
  try {
    const username = req.user.username;
    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }
    const reminder = addThreadNote(username, req.params.id, note);
    res.json({ reminder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/reminders/:id/convert — convert a fired reminder to a new follow-up
router.post('/:id/convert', (req, res) => {
  try {
    const username = req.user.username;
    const { newFireAt } = req.body;
    if (!newFireAt) {
      return res.status(400).json({ error: 'newFireAt is required' });
    }
    const newReminder = convertToNewReminder(username, req.params.id, newFireAt);
    res.json({ reminder: newReminder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/reminders/:id — delete a reminder
router.delete('/:id', (req, res) => {
  try {
    const username = req.user.username;
    const result = deleteReminder(username, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/reminders/check — check for fired reminders + advance recurring
router.post('/check', (req, res) => {
  try {
    const username = req.user.username;
    const fired = checkAndFireReminders(username);
    const advanced = advanceRecurringReminders(username);
    res.json({ fired, advanced });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;