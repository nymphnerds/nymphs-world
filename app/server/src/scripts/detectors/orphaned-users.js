import fs from 'fs';
import path from 'path';
import { loadUsers, DATA_DIR, getUserDir } from '../lib/users-db.js';
import { ts } from '../lib/utils.js';

/**
 * 4.7 Orphaned User Directory Detector
 * Finds directories under data/ that don't have a corresponding entry in users.json.
 */
export function detectOrphanedUsers() {
  const findings = [];
  const users = loadUsers();
  const usernames = new Set(Object.keys(users));

  if (!fs.existsSync(DATA_DIR)) return findings;

  const entries = fs.readdirSync(DATA_DIR);
  for (const entry of entries) {
    const fullPath = path.join(DATA_DIR, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    if (entry.startsWith('.')) continue; // Skip hidden dirs like .removed-users

    if (!usernames.has(entry)) {
      findings.push({
        type: 'orphanedUserDir',
        severity: 'warning',
        user: entry,
        path: fullPath,
        detail: `Directory exists but no entry in users.json: ${entry}`,
        action: `Move to .removed-users/${entry}-${ts()}/`,
        fixed: false,
      });
    }
  }
  return findings;
}