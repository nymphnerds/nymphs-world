import express from 'express';
import { loginOrCreate, loadUsers } from '../services/authService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/auth/check - Check if a user exists (no auth required)
router.post('/check', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const users = loadUsers();
    res.json({ exists: !!users[cleanUsername] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login - Login or create user (username only, no password)
router.post('/login', (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = loginOrCreate(username);
    
    res.json({
      token: result.token,
      user: result.user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me - Get current user info (requires auth)
router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  res.json({ user: req.user });
});

export default router;