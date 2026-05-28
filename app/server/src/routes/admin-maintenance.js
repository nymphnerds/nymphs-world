import express from 'express';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPTS_DIR = join(__dirname, '../scripts');
const DATA_DIR = join(__dirname, '../data');
const ADMIN_PASSWORD_FILE = join(DATA_DIR, '.admin-password');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate username is safe to pass to CLI scripts.
 * Only allows alphanumeric, hyphens, underscores.
 */
function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

/**
 * Run a CLI script and return structured JSON response.
 * Scripts log progress to stderr, output JSON to stdout.
 */
function runScript(scriptName, args, timeout = 60000) {
  const timestamp = new Date().toISOString();
  try {
    const scriptPath = join(SCRIPTS_DIR, scriptName);
    const cmd = `node ${scriptPath} ${args.join(' ')}`;
    const cwd = join(__dirname, '../..');

    // Run the script - progress goes to stderr, JSON to stdout
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      cwd,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    // Parse JSON from stdout
    let data;
    try {
      data = JSON.parse(output.trim());
    } catch {
      // If not valid JSON, wrap the raw output
      data = { raw: output.trim() };
    }

    return { success: true, data, timestamp };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr ? error.stderr.toString() : undefined,
      timestamp
    };
  }
}

/**
 * Hash a password using scrypt.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verify a password against a stored hash.
 */
function verifyPassword(password, stored) {
  try {
    const [salt, hashHex] = stored.split(':');
    const derived = crypto.scryptSync(password, salt, 64);
    return derived.toString('hex') === hashHex;
  } catch {
    return false;
  }
}

/**
 * Check if admin password is set.
 */
function isAdminPasswordSet() {
  return fs.existsSync(ADMIN_PASSWORD_FILE);
}

/**
 * Get stored admin password hash.
 */
function getAdminPasswordHash() {
  try {
    return fs.readFileSync(ADMIN_PASSWORD_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
}

// ── Health Scan Endpoints ────────────────────────────────────────────────────

// GET /api/admin/maintenance/health
// maintenance.js uses --json flag (not --format json)
router.get('/maintenance/health', (req, res) => {
  const result = runScript('maintenance.js', ['--json']);
  res.json(result);
});

// GET /api/admin/maintenance/health/user/:username
router.get('/maintenance/health/user/:username', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('maintenance.js', ['--user', username, '--json']);
  res.json(result);
});

// POST /api/admin/maintenance/health/fix
router.post('/maintenance/health/fix', (req, res) => {
  const result = runScript('maintenance.js', ['--fix', '--json']);
  res.json(result);
});

// POST /api/admin/maintenance/health/user/:username/fix
router.post('/maintenance/health/user/:username/fix', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('maintenance.js', ['--user', username, '--fix', '--json']);
  res.json(result);
});

// GET /api/admin/maintenance/review
router.get('/maintenance/review', (req, res) => {
  const result = runScript('maintenance.js', ['--review', '--json']);
  res.json(result);
});

// ── Admin Password Endpoints ─────────────────────────────────────────────────

// POST /api/admin/maintenance/password/set
// First user sets the password. Fails if already set.
router.post('/maintenance/password/set', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
  }
  // Fail if password already set
  if (isAdminPasswordSet()) {
    return res.status(409).json({ success: false, error: 'Admin password already set' });
  }
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const hash = hashPassword(password);
  fs.writeFileSync(ADMIN_PASSWORD_FILE, hash, 'utf-8');
  res.json({ success: true, message: 'Admin password set' });
});

// POST /api/admin/maintenance/password/verify
// Verify password against stored hash
router.post('/maintenance/password/verify', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }
  const stored = getAdminPasswordHash();
  if (!stored) {
    return res.json({ success: true, passwordSet: false });
  }
  const valid = verifyPassword(password, stored);
  res.json({ success: true, valid, passwordSet: true });
});

// ── Account Management Endpoints ─────────────────────────────────────────────

// GET /api/admin/accounts
router.get('/accounts', (req, res) => {
  const result = runScript('account.js', ['--list', '--format', 'json']);
  res.json(result);
});

// GET /api/admin/accounts/:username
router.get('/accounts/:username', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('account.js', ['--show', username, '--format', 'json']);
  res.json(result);
});

// POST /api/admin/accounts/:username/add
router.post('/accounts/:username/add', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('account.js', ['--add', username]);
  res.json(result);
});

// POST /api/admin/accounts/:username/delete
router.post('/accounts/:username/delete', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('account.js', ['--delete', username]);
  res.json(result);
});

// POST /api/admin/accounts/:username/deactivate
router.post('/accounts/:username/deactivate', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('account.js', ['--deactivate', username]);
  res.json(result);
});

// POST /api/admin/accounts/:username/activate
router.post('/accounts/:username/activate', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  const result = runScript('account.js', ['--activate', username]);
  res.json(result);
});

// POST /api/admin/accounts/:username/purge
router.post('/accounts/:username/purge', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' });
  }
  // Purge always requires confirmation - the script enforces --confirm flag
  const result = runScript('account.js', ['--purge', username, '--confirm']);
  res.json(result);
});

// POST /api/admin/accounts/bulk
router.post('/accounts/bulk', (req, res) => {
  const { pattern } = req.body;
  if (!pattern || typeof pattern !== 'string') {
    return res.status(400).json({ success: false, error: 'Pattern is required' });
  }
  // Validate pattern doesn't contain dangerous characters
  if (/[;|&$`\\]/.test(pattern)) {
    return res.status(400).json({ success: false, error: 'Invalid pattern characters' });
  }
  const result = runScript('account.js', ['--bulk-delete', '--pattern', pattern, '--confirm']);
  res.json(result);
});

export default router;