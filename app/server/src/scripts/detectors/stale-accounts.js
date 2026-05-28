import fs from 'fs';
import path from 'path';
import { loadUsers, DATA_DIR } from '../lib/users-db.js';
import { walkDir } from '../lib/utils.js';

/**
 * 4.6 Stale Account Detector
 * Accounts that have no associated files in their user directory.
 */
export function detectStaleAccounts() {
  const findings = [];
  const users = loadUsers();

  for (const [username, user] of Object.entries(users)) {
    const usernameDir = path.join(DATA_DIR, username);
    if (!fs.existsSync(usernameDir)) {
      findings.push({
        type: 'staleAccount',
        severity: 'info',
        user: username,
        path: usernameDir,
        detail: `User directory does not exist for account: ${username}`,
        action: 'Flag for manual review',
        fixed: false,
      });
      continue;
    }

    // Check if directory has any content
    try {
      const entries = fs.readdirSync(usernameDir);
      if (entries.length === 0) {
        findings.push({
          type: 'staleAccount',
          severity: 'info',
          user: username,
          path: usernameDir,
          detail: `User directory is empty: ${username}`,
          action: 'Flag for manual review',
          fixed: false,
        });
      }
    } catch {
      findings.push({
        type: 'staleAccount',
        severity: 'error',
        user: username,
        path: usernameDir,
        detail: `Cannot read user directory: ${username}`,
        action: 'Flag for manual review',
        fixed: false,
      });
    }
  }
  return findings;
}