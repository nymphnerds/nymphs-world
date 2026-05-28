import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Path constants ──────────────────────────────────────────────────────────
export const DATA_DIR = path.join(__dirname, '..', '..', 'data');
export const USERS_JSON = path.join(DATA_DIR, 'users.json');
export const USERS_DIR = path.join(DATA_DIR, 'users');

/** Load users.json, returning empty object if missing or corrupted. */
export function loadUsers() {
  try {
    if (fs.existsSync(USERS_JSON)) return JSON.parse(fs.readFileSync(USERS_JSON, 'utf-8'));
  } catch {
    // ignore
  }
  return {};
}

/** Atomically write users to users.json. */
export function saveUsers(users) {
  const tmpPath = USERS_JSON + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tmpPath, USERS_JSON);
}

/** Get path to user's data directory. */
export function getUserDir(username) {
  return path.join(USERS_DIR, username);
}

/** Get path to user's workspace directory. */
export function getUserWorkspace(username) {
  return path.join(getUserDir(username), 'workspace');
}

/** Get path to user's assets/images directory. */
export function getUserAssets(username) {
  return path.join(getUserDir(username), 'assets', 'images');
}