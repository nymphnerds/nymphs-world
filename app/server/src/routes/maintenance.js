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
 * Run a CLI script and return structured JSON response.
 * Scripts log progress to stderr, output JSON to stdout.
 */
function runScript(scriptName, args, timeout = 60000) {
  const timestamp = new Date().toISOString();
  try {
    const scriptPath = join(SCRIPTS_DIR, scriptName);
    const cmd = `node ${scriptPath} ${args.join(' ')}`;
    const cwd = join(__dirname, '../..');

    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      cwd,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    let data;
    try {
      data = JSON.parse(output.trim());
    } catch {
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

// ── Self-Service Health Scan (current user only) ─────────────────────────────

// GET /api/maintenance/health
// Scans the current authenticated user's workspace
// maintenance.js uses --json flag (not --format json)
router.get('/health', (req, res) => {
  const username = req.user.username;
  const result = runScript('maintenance.js', ['--user', username, '--json']);
  res.json(result);
});

// POST /api/maintenance/health/fix
// Fixes issues in the current authenticated user's workspace
router.post('/health/fix', (req, res) => {
  const username = req.user.username;
  const result = runScript('maintenance.js', ['--user', username, '--fix', '--json']);
  res.json(result);
});

// GET /api/maintenance/review
// Review mode for the current authenticated user only.
// Filters out global detector findings (staleAccount, testAccount, orphanedUsers)
// that belong to other users so self-service only sees their own data.
router.get('/review', (req, res) => {
  const username = req.user.username;
  const result = runScript('maintenance.js', ['--review', '--user', username, '--json']);
  // Filter findings: only keep findings for this user or findings without a user field
  if (result.success && result.data?.findings) {
    result.data.findings = result.data.findings.filter(
      (f) => !f.user || f.user === username
    );
  }
  res.json(result);
});

// ── Admin Password Endpoints (accessible to any authenticated user) ───────────

// POST /api/maintenance/password/set
// First user sets the shared admin password. Fails if already set.
router.post('/password/set', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
  }
  if (isAdminPasswordSet()) {
    return res.status(409).json({ success: false, error: 'Admin password already set' });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const hash = hashPassword(password);
  fs.writeFileSync(ADMIN_PASSWORD_FILE, hash, 'utf-8');
  res.json({ success: true, message: 'Admin password set' });
});

// POST /api/maintenance/password/verify
// Verify password against stored hash
router.post('/password/verify', (req, res) => {
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

// GET /api/maintenance/password/status
// Check if admin password is set (to know which UI flow to show)
router.get('/password/status', (req, res) => {
  res.json({ success: true, passwordSet: isAdminPasswordSet() });
});

export default router;