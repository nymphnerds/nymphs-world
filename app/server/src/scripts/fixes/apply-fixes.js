import fs from 'fs';
import path from 'path';
import { ts, safeMove, safeMkdir } from '../lib/utils.js';
import { loadUsers, saveUsers, getUserWorkspace, getUserAssets, getUserDir, DATA_DIR } from '../lib/users-db.js';
import { quarantineLog, resetQuarantineLog } from '../lib/quarantine.js';

/**
 * Apply fix actions to findings that are fixable.
 * Returns the number of fixes applied.
 */
export function applyFixes(findings) {
  let count = 0;

  for (const f of findings) {
    try {
      switch (f.type) {
        case 'corruptedHtml':
          count += fixCorruptedHtml(f);
          break;
        case 'orphanedImage':
          count += fixOrphanedImage(f);
          break;
        case 'orphanedMetadata':
          count += fixOrphanedMetadata(f);
          break;
        case 'emptyDir':
          count += fixEmptyDir(f);
          break;
        case 'brokenImageLink':
          count += fixBrokenImageLink(f);
          break;
        case 'orphanedUserDir':
          count += fixOrphanedUserDir(f);
          break;
      }
    } catch (err) {
      f.detail = `${f.detail} [FIX ERROR: ${err.message}]`;
      f.severity = 'error';
    }
  }

  return count;
}

// ── Fix: Corrupted HTML ──────────────────────────────────────────────────────

function fixCorruptedHtml(f) {
  if (typeof f.path === 'string' && !f.path.startsWith('/')) {
    f.path = path.join(getUserWorkspace(f.user), f.path);
  }

  if (!fs.existsSync(f.path)) {
    f.detail = `${f.detail} [ALREADY MISSING]`;
    return 0;
  }

  const dir = path.dirname(f.path);
  const base = path.basename(f.path);
  const quarantineDir = path.join(dir, `.corrupted-${ts()}`);
  safeMkdir(quarantineDir);
  const quarantinePath = path.join(quarantineDir, base);

  fs.copyFileSync(f.path, quarantinePath);
  fs.unlinkSync(f.path);

  quarantineLog.corruptedHtml.push({
    user: f.user,
    originalPath: f.path,
    quarantinePath,
    issue: f.detail,
  });

  f.detail = `${f.detail} [QUARANTINED]`;
  f.fixed = true;
  return 1;
}

// ── Fix: Orphaned Image ──────────────────────────────────────────────────────

function fixOrphanedImage(f) {
  if (!fs.existsSync(f.path)) {
    f.detail = `${f.detail} [ALREADY MISSING]`;
    return 0;
  }

  const assetsDir = getUserAssets(f.user);
  const quarantineDir = path.join(assetsDir, `.orphaned-${ts()}`);
  safeMkdir(quarantineDir);
  const quarantinePath = path.join(quarantineDir, path.basename(f.path));

  safeMove(f.path, quarantinePath);

  quarantineLog.orphanedImage.push({
    user: f.user,
    originalPath: f.path,
    quarantinePath,
  });

  f.detail = `${f.detail} [MOVED]`;
  f.fixed = true;
  return 1;
}

// ── Fix: Orphaned Metadata ───────────────────────────────────────────────────

function fixOrphanedMetadata(f) {
  if (!fs.existsSync(f.path)) {
    f.detail = `${f.detail} [ALREADY MISSING]`;
    return 0;
  }

  fs.unlinkSync(f.path);

  quarantineLog.orphanedMetadataDeleted.push({
    path: f.path,
    sourceFile: f.detail,
  });

  f.detail = `${f.detail} [DELETED]`;
  f.fixed = true;
  return 1;
}

// ── Fix: Empty Directory ─────────────────────────────────────────────────────

function fixEmptyDir(f) {
  if (!fs.existsSync(f.path)) return 0;

  try {
    const entries = fs.readdirSync(f.path);
    if (entries.length > 0) return 0; // No longer empty
  } catch {
    return 0;
  }

  fs.rmdirSync(f.path);
  quarantineLog.emptyDirRemoved.push({
    user: f.user,
    path: f.path,
  });

  f.detail = `${f.detail} [REMOVED]`;
  f.fixed = true;
  return 1;
}

// ── Fix: Broken Image Links ──────────────────────────────────────────────────

function fixBrokenImageLink(f) {
  const reportLines = [
    '# Broken Image Links Report',
    `**User:** ${f.user}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
  ];

  // Group findings by file
  const byFile = {};
  for (const finding of quarantineLog.brokenLinksReported) {
    // Just collect for summary
  }

  const reportPath = path.join(getUserWorkspace(f.user), 'MainStory', `broken-links-report-${ts()}.md`);
  safeMkdir(path.dirname(reportPath));

  reportLines.push(`| File | Broken Reference |`);
  reportLines.push('|---|---|');
  reportLines.push(`| ${f.path} | ${f.detail} |`);
  reportLines.push('');

  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');

  quarantineLog.brokenLinksReported.push({
    user: f.user,
    reportPath,
  });

  f.detail = `${f.detail} [REPORTED]`;
  f.fixed = true;
  return 1;
}

// ── Fix: Orphaned User Directory ─────────────────────────────────────────────

function fixOrphanedUserDir(f) {
  if (!fs.existsSync(f.path)) {
    f.detail = `${f.detail} [ALREADY MISSING]`;
    return 0;
  }

  const removedDir = path.join(DATA_DIR, '.removed-users');
  safeMkdir(removedDir);
  const quarantinePath = path.join(removedDir, `${f.user}-${ts()}`);

  safeMove(f.path, quarantinePath);

  // Remove from users.json if present (shouldn't be, but safety)
  const users = loadUsers();
  if (users[f.user]) {
    delete users[f.user];
    saveUsers(users);
  }

  quarantineLog.orphanedUserDir.push({
    user: f.user,
    originalPath: f.path,
    quarantinePath,
  });

  f.detail = `${f.detail} [MOVED to .removed-users]`;
  f.fixed = true;
  return 1;
}