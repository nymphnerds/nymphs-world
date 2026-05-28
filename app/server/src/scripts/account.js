#!/usr/bin/env node

/**
 * WORBI Account Management Script
 *
 * Usage:
 *   node account.js --list                              # List all users (table)
 *   node account.js --list --format json                # List all users (JSON)
 *   node account.js --show <username>                   # Detailed user info
 *   node account.js --add <username>                    # Create account + dirs
 *   node account.js --delete <username>                 # Quarantine account
 *   node account.js --deactivate <username>             # Soft-delete account
 *   node account.js --activate <username>               # Re-enable account
 *   node account.js --purge <username> --confirm        # Hard-delete account
 *   node account.js --bulk-delete --pattern <glob> [--confirm]
 *   node account.js --user <username> [--fix]           # Per-user cleanup scan
 */

import fs from 'fs';
import path from 'path';
import { loadUsers, saveUsers, getUserDir, getUserWorkspace, getUserAssets, USERS_DIR, DATA_DIR } from './lib/users-db.js';
import { dirSize, formatBytes, ts, walkDir, safeMove, safeMkdir } from './lib/utils.js';
import { detectOrphanedImages } from './detectors/orphaned-images.js';
import { detectOrphanedMetadata } from './detectors/orphaned-meta.js';
import { detectEmptyDirs } from './detectors/empty-dirs.js';
import { detectCorruptedHtml } from './detectors/corrupted-html.js';
import { detectBrokenImageLinks } from './detectors/broken-links.js';
import { detectDuplicateImages } from './detectors/duplicate-images.js';
import { applyFixes } from './fixes/apply-fixes.js';

// ── Action Logging ────────────────────────────────────────────────────────────

const ACTIONS_LOG = path.join(DATA_DIR, 'account-actions.log');

function logAction(action, detail) {
  const line = `[${new Date().toISOString()}] ${action}${detail ? ' — ' + detail : ''}\n`;
  fs.appendFileSync(ACTIONS_LOG, line, 'utf-8');
}

// ── Arg Parsing ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = {
    list: false,
    show: null,
    add: null,
    delete: null,
    deactivate: null,
    activate: null,
    purge: null,
    bulkDelete: false,
    pattern: null,
    confirm: false,
    format: 'text',
    user: null,
    fix: false
  };

  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--show' && process.argv[i + 1]) args.show = process.argv[++i];
    else if (a === '--add' && process.argv[i + 1]) args.add = process.argv[++i];
    else if (a === '--delete' && process.argv[i + 1]) args.delete = process.argv[++i];
    else if (a === '--deactivate' && process.argv[i + 1]) args.deactivate = process.argv[++i];
    else if (a === '--activate' && process.argv[i + 1]) args.activate = process.argv[++i];
    else if (a === '--purge' && process.argv[i + 1]) args.purge = process.argv[++i];
    else if (a === '--bulk-delete') args.bulkDelete = true;
    else if (a === '--pattern' && process.argv[i + 1]) args.pattern = process.argv[++i];
    else if (a === '--confirm') args.confirm = true;
    else if (a === '--format' && process.argv[i + 1]) args.format = process.argv[++i];
    else if (a === '--user' && process.argv[i + 1]) args.user = process.argv[++i];
    else if (a === '--fix') args.fix = true;
  }

  return args;
}

// ── Helper: Get user stats ────────────────────────────────────────────────────

function getUserStats(username, userData) {
  const workspace = getUserWorkspace(username);
  const assets = getUserAssets(username);
  const ws = dirSize(workspace);
  const as = dirSize(assets);

  const status = userData.status || 'active';
  const lastLogin = userData.lastLogin || null;
  const inactiveDays = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000) : -1;

  return {
    username,
    createdAt: userData.createdAt || null,
    lastLogin,
    status,
    inactiveDays: inactiveDays >= 0 ? inactiveDays : null,
    workspaceSize: ws.bytes,
    workspaceFiles: ws.files,
    assetSize: as.bytes,
    assets: as.files
  };
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdList(format) {
  const users = loadUsers();
  const entries = Object.entries(users);

  if (format === 'json') {
    const result = {
      version: '6.3.0',
      timestamp: new Date().toISOString(),
      total: entries.length,
      users: entries.map(([username, data]) => getUserStats(username, data))
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Text table
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`  WORBI User Accounts (${entries.length} total)`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  USERNAME                CREATED        LAST LOGIN       SIZE      STATUS');
  console.log('  ──────────────────────────────────────────────────────────────────────────────');

  for (const [username, data] of entries) {
    const s = getUserStats(username, data);
    const created = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '—';
    const login = s.lastLogin ? new Date(s.lastLogin).toISOString().slice(0, 10) : '—';
    const size = formatBytes(s.workspaceSize + s.assetSize);
    const status = s.status;
    console.log(`  ${username.padEnd(26)}${created.padEnd(16)}${login.padEnd(16)}${size.padEnd(10)}${status}`);
  }
  console.log('');
}

function cmdShow(username, format) {
  const users = loadUsers();
  const data = users[username];

  if (!data) {
    console.error(`User "${username}" not found in users.json`);
    process.exit(1);
  }

  const s = getUserStats(username, data);
  const ws = getUserWorkspace(username);
  const userDir = getUserDir(username);

  // Recent file activity
  const { files: wsFiles } = walkDir(ws);
  const recent = wsFiles
    .map(f => ({ path: f, mtime: fs.statSync(f).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 10);

  // Meta file count
  const allFiles = walkDir(ws).files;
  const metaCount = allFiles.filter(f => f.endsWith('.wbu_meta.json')).length;

  if (format === 'json') {
    const result = {
      ...s,
      workspaceHuman: formatBytes(s.workspaceSize),
      assetHuman: formatBytes(s.assetSize),
      metaCount,
      userDir,
      recent: recent.map(r => ({
        file: path.relative(ws, r.path),
        modified: new Date(r.mtime).toISOString()
      }))
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Account: ${username}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Status:       ${s.status}`);
  console.log(`  Created:      ${s.createdAt ? new Date(s.createdAt).toISOString() : '—'}`);
  console.log(`  Last Login:   ${s.lastLogin ? new Date(s.lastLogin).toISOString() : '—'}`);
  console.log(`  Inactive:     ${s.inactiveDays !== null ? s.inactiveDays + ' days' : '—'}`);
  console.log('');
  console.log(`  Workspace:    ${s.workspaceFiles} files, ${formatBytes(s.workspaceSize)}`);
  console.log(`  Assets:       ${s.assets} images, ${formatBytes(s.assetSize)}`);
  console.log(`  Meta Files:   ${metaCount}`);
  console.log(`  User Dir:     ${userDir}`);
  console.log('');

  if (recent.length > 0) {
    console.log('  Recent Activity (last 10 files modified):');
    console.log('  ──────────────────────────────────────────────────────────────');
    for (const r of recent) {
      const rel = path.relative(ws, r.path);
      const mdate = new Date(r.mtime).toISOString().slice(0, 16).replace('T', ' ');
      console.log(`  ${mdate}  ${rel}`);
    }
    console.log('');
  }
}

function cmdAdd(username) {
  const users = loadUsers();

  if (users[username]) {
    console.error(`User "${username}" already exists in users.json`);
    process.exit(1);
  }

  if (fs.existsSync(getUserDir(username))) {
    console.error(`Directory for user "${username}" already exists`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  users[username] = { createdAt: now, lastLogin: now, status: 'active' };
  saveUsers(users);

  safeMkdir(getUserWorkspace(username));
  safeMkdir(getUserAssets(username));

  logAction('ADD', `Created account "${username}"`);
  console.log(`Created account "${username}"`);
}

function cmdDelete(username) {
  const users = loadUsers();

  if (!users[username]) {
    console.error(`User "${username}" not found in users.json`);
    process.exit(1);
  }

  const userDirPath = getUserDir(username);
  if (fs.existsSync(userDirPath)) {
    const removedDir = path.join(DATA_DIR, '.removed-users');
    const dest = path.join(removedDir, `${username}-${ts()}`);
    safeMove(userDirPath, dest);
    console.log(`Quarantined data to ${dest}`);
  }

  delete users[username];
  saveUsers(users);

  logAction('DELETE', `Quarantined account "${username}"`);
  console.log(`Deleted account "${username}" from users.json`);
}

function cmdDeactivate(username) {
  const users = loadUsers();

  if (!users[username]) {
    console.error(`User "${username}" not found in users.json`);
    process.exit(1);
  }

  users[username].status = 'inactive';
  users[username].deactivatedAt = new Date().toISOString();
  saveUsers(users);

  logAction('DEACTIVATE', `Deactivated account "${username}"`);
  console.log(`Deactivated account "${username}"`);
}

function cmdActivate(username) {
  const users = loadUsers();

  if (!users[username]) {
    console.error(`User "${username}" not found in users.json`);
    process.exit(1);
  }

  users[username].status = 'active';
  delete users[username].deactivatedAt;
  saveUsers(users);

  logAction('ACTIVATE', `Re-activated account "${username}"`);
  console.log(`Re-activated account "${username}"`);
}

function cmdPurge(username) {
  if (!process.argv.includes('--confirm')) {
    console.error('Purge requires --confirm flag. This action is irreversible.');
    console.error(`Usage: node account.js --purge ${username} --confirm`);
    process.exit(1);
  }

  const users = loadUsers();

  if (!users[username]) {
    console.error(`User "${username}" not found in users.json`);
    process.exit(1);
  }

  const userDirPath = getUserDir(username);
  if (fs.existsSync(userDirPath)) {
    fs.rmSync(userDirPath, { recursive: true, force: true });
    console.log(`Permanently deleted data directory for "${username}"`);
  }

  delete users[username];
  saveUsers(users);

  logAction('PURGE', `Hard-deleted account "${username}" (confirmed)`);
  console.log(`Purged account "${username}"`);
}

function cmdBulkDelete(pattern, confirm) {
  if (!pattern) {
    console.error('--bulk-delete requires --pattern <glob>');
    process.exit(1);
  }

  // Simple glob-like matching: support * and ? wildcards
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');

  const users = loadUsers();
  const matched = Object.keys(users).filter(name => regex.test(name));

  if (matched.length === 0) {
    console.log(`No users match pattern "${pattern}"`);
    return;
  }

  console.log(`\nUsers matching "${pattern}" (${matched.length}):\n`);
  for (const name of matched) {
    const s = getUserStats(name, users[name]);
    console.log(`  ${name.padEnd(26)} ${formatBytes(s.workspaceSize + s.assetSize).padEnd(10)} ${s.status}`);
  }

  if (!confirm) {
    console.log('\nDry-run only. Add --confirm to execute.');
    return;
  }

  console.log(`\nExecuting bulk delete of ${matched.length} users...`);
  for (const name of matched) {
    const userDirPath = getUserDir(name);
    if (fs.existsSync(userDirPath)) {
      const removedDir = path.join(DATA_DIR, '.removed-users');
      const dest = path.join(removedDir, `${name}-${ts()}`);
      safeMove(userDirPath, dest);
    }
    delete users[name];
    logAction('BULK_DELETE', `Quarantined account "${name}"`);
    console.log(`  Deleted "${name}"`);
  }
  saveUsers(users);
  console.log(`\nBulk delete complete. ${matched.length} accounts quarantined.`);
}

// ── Scan Mode (legacy: --user <username> [--fix]) ─────────────────────────────

function cmdScan(user, fix) {
  const users = loadUsers();
  if (!users[user]) {
    console.error(`User "${user}" not found in users.json`);
    process.exit(1);
  }

  console.log(`Account cleanup for: ${user}`);
  console.log(`  Workspace: ${getUserWorkspace(user)}`);
  console.log(`  Assets:    ${getUserAssets(user)}`);
  console.log(`  User Dir:  ${getUserDir(user)}`);

  const findings = [];
  findings.push(...detectOrphanedImages(user));
  findings.push(...detectOrphanedMetadata(user));
  findings.push(...detectEmptyDirs(user));
  findings.push(...detectCorruptedHtml(user));
  findings.push(...detectBrokenImageLinks(user));
  findings.push(...detectDuplicateImages(user));

  console.log(`\nFound ${findings.length} issues`);

  if (fix) {
    const count = applyFixes(findings);
    console.log(`Applied ${count} fixes`);
  }

  for (const f of findings) {
    const status = f.fixed ? '[FIXED]' : '[ ]';
    console.log(`  ${status} [${f.severity}] ${f.detail}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.list) return cmdList(args.format);
  if (args.show) return cmdShow(args.show, args.format);
  if (args.add) return cmdAdd(args.add);
  if (args.delete) return cmdDelete(args.delete);
  if (args.deactivate) return cmdDeactivate(args.deactivate);
  if (args.activate) return cmdActivate(args.activate);
  if (args.purge) return cmdPurge(args.purge);
  if (args.bulkDelete) return cmdBulkDelete(args.pattern, args.confirm);
  if (args.user) return cmdScan(args.user, args.fix);

  console.log(`Usage:
  node account.js --list [--format json]
  node account.js --show <username>
  node account.js --add <username>
  node account.js --delete <username>
  node account.js --deactivate <username>
  node account.js --activate <username>
  node account.js --purge <username> --confirm
  node account.js --bulk-delete --pattern <glob> [--confirm]
  node account.js --user <username> [--fix]`);
  process.exit(1);
}

main();