#!/usr/bin/env node

/**
 * WORBI Maintenance Cleanup Script - v6.3.0 (Modular)
 *
 * Orchestrates 8 detectors + fix actions across all users.
 *
 * Usage:
 *   node server/src/scripts/maintenance.js              # Report only
 *   node server/src/scripts/maintenance.js --fix         # Auto-fix safe issues
 *   node server/src/scripts/maintenance.js --review      # Review mode for stale/duplicates
 *   node server/src/scripts/maintenance.js --json        # JSON output
 *   node server/src/scripts/maintenance.js --user alice  # Scan only one user
 */

import fs from 'fs';
import path from 'path';

// ── Lib imports ──────────────────────────────────────────────────────────────
import { loadUsers, DATA_DIR } from './lib/users-db.js';
import { buildReport, formatTextReport, formatJsonReport } from './lib/logger.js';
import { resetQuarantineLog, generateQuarantineIndex } from './lib/quarantine.js';
import { applyFixes } from './fixes/apply-fixes.js';

// ── Detector imports ─────────────────────────────────────────────────────────
import { detectBrokenImageLinks } from './detectors/broken-links.js';
import { detectOrphanedImages } from './detectors/orphaned-images.js';
import { detectOrphanedMetadata } from './detectors/orphaned-meta.js';
import { detectEmptyDirs } from './detectors/empty-dirs.js';
import { detectCorruptedHtml } from './detectors/corrupted-html.js';
import { detectStaleAccounts } from './detectors/stale-accounts.js';
import { detectOrphanedUsers } from './detectors/orphaned-users.js';
import { detectDuplicateImages } from './detectors/duplicate-images.js';
import { detectTestAccounts } from './detectors/test-accounts.js';

// ── CLI Args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { fix: false, review: false, json: false, user: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--fix') args.fix = true;
    else if (argv[i] === '--review') args.review = true;
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--user' && argv[i + 1]) args.user = argv[++i];
  }
  return args;
}

// ── Run a single detector ────────────────────────────────────────────────────
function runDetector(label, fn, json, ...args) {
  const log = json ? console.error : console.log;
  log(`  ${label}...`);
  const t0 = Date.now();
  const findings = fn(...args);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  log(`    Found ${findings.length} issues (${elapsed}s)`);
  return findings;
}

// ── Scan a single user ───────────────────────────────────────────────────────
function scanUser(username, json) {
  const findings = [];
  findings.push(...runDetector('Broken image links', detectBrokenImageLinks, json, username));
  findings.push(...runDetector('Orphaned images', detectOrphanedImages, json, username));
  findings.push(...runDetector('Orphaned metadata', detectOrphanedMetadata, json, username));
  findings.push(...runDetector('Empty directories', detectEmptyDirs, json, username));
  findings.push(...runDetector('Corrupted HTML', detectCorruptedHtml, json, username));
  findings.push(...runDetector('Duplicate images', detectDuplicateImages, json, username));
  return findings;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  const mode = args.fix ? 'fix' : 'report';

  const log = args.json ? console.error : console.log;
  log('═══════════════════════════════════════════════════════════');
  log('  WORBI Maintenance Cleanup Script v6.3.0');
  log('═══════════════════════════════════════════════════════════');
  log(`  Mode: ${mode}${args.fix ? ' (auto-fix)' : ' (report only)'}${args.json ? ' (JSON)' : ''}`);
  log(`  User: ${args.user || 'all'}`);
  log('');

  resetQuarantineLog();

  const users = loadUsers();
  const usernames = args.user
    ? (users[args.user] ? [args.user] : [])
    : Object.keys(users);

  if (args.user && usernames.length === 0) {
    console.error(`User '${args.user}' not found in users.json`);
    process.exit(1);
  }

  // Global detectors (not per-user)
  let allFindings = [];
  allFindings.push(...runDetector('Orphaned user dirs', detectOrphanedUsers, args.json));
  if (args.review) {
    allFindings.push(...runDetector('Stale accounts', detectStaleAccounts, args.json));
    allFindings.push(...runDetector('Test accounts', detectTestAccounts, args.json));
  }

  // Per-user detectors
  for (const username of usernames) {
    log(`\n  Scanning: ${username}`);
    const userFindings = scanUser(username, args.json);
    allFindings.push(...userFindings);
  }

  // Apply fixes
  if (args.fix) {
    log('\n  Applying fixes...');
    const fixCount = applyFixes(allFindings);
    log(`    Applied ${fixCount} fixes`);
  }

  // Build & output report
  const report = buildReport(allFindings, mode);
  const indexPath = generateQuarantineIndex();

  // When --json: only JSON to stdout, progress to stderr
  const output = args.json ? formatJsonReport(report) : formatTextReport(report);
  if (args.json) {
    console.log(output);
  } else {
    log('');
    log(output);
  }

  // Save report to disk
  const ext = args.json ? 'json' : 'txt';
  const t = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
  const reportPath = path.join(DATA_DIR, `maintenance-report-${t}.${ext}`);
  fs.writeFileSync(reportPath, output, 'utf-8');

  log(`\n  Report saved to: ${reportPath}`);
  log(`  Quarantine index: ${indexPath}`);
}

main();