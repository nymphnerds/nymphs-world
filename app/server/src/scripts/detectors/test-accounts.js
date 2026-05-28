import fs from 'fs';
import { loadUsers, getUserDir, DATA_DIR } from '../lib/users-db.js';
import { dirSize, formatBytes } from '../lib/utils.js';

// Test account username patterns
const TEST_PATTERNS = [
  /^integ_/,      // Integration test accounts (integ_*, integ_*_user)
  /^test_/,       // Test accounts (test_*, test_svc_*)
];

/**
 * Test Account Detector
 * Detects accounts created by the test suite that should be cleaned up.
 */
export function detectTestAccounts() {
  const findings = [];
  const users = loadUsers();

  for (const [username, userData] of Object.entries(users)) {
    const isTestAccount = TEST_PATTERNS.some(pattern => pattern.test(username));

    if (!isTestAccount) continue;

    const userDir = getUserDir(username);
    let size = { bytes: 0, files: 0 };

    try {
      size = dirSize(userDir);
    } catch {
      // Directory may not exist
    }

    findings.push({
      type: 'testAccount',
      severity: 'info',
      user: username,
      path: userDir,
      detail: `Test account: ${username} (${formatBytes(size.bytes)}, ${size.files} files)`,
      action: 'Remove test account',
      fixed: false,
      createdAt: userData.createdAt || null,
      status: userData.status || 'active',
      sizeBytes: size.bytes,
      sizeFiles: size.files,
    });
  }

  return findings;
}