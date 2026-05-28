#!/usr/bin/env node

/**
 * WORBI Maintenance Suite Dispatcher
 *
 * Single entry point that routes to sub-commands:
 *
 * Usage:
 *   node suite.js health [--fix] [--user <username>] [--format json]
 *   node suite.js accounts [--list|--show|--add|--delete|--purge|--bulk-delete]
 *   node suite.js all [--fix]
 *   node suite.js --help
 */

import { spawn } from 'child_process';
import path from 'path';

const SCRIPTS_DIR = path.dirname(new URL(import.meta.url).pathname);

function spawnScript(scriptName, args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: path.join(SCRIPTS_DIR, '..', '..')
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });

    child.on('error', reject);
  });
}

function printHelp() {
  console.log(`
WORBI Maintenance Suite v6.3.0

Usage:
  node suite.js health [options]       Run file/asset health scan
  node suite.js accounts [options]     Manage user accounts
  node suite.js all [options]          Run all checks
  node suite.js --help                 Show this help

Health Options:
  --fix                                Auto-fix safe issues
  --user <username>                    Scan single user
  --format json                        JSON output
  --review                             Review mode (stale accounts, duplicates)

Account Options:
  --list [--format json]               List all users
  --show <username>                    Detailed user info
  --add <username>                     Create account + directories
  --delete <username>                  Quarantine account data
  --deactivate <username>              Soft-delete account
  --activate <username>                Re-enable account
  --purge <username> --confirm         Permanently delete account
  --bulk-delete --pattern <glob> [--confirm]

Examples:
  node suite.js health
  node suite.js health --fix --user alice
  node suite.js accounts --list
  node suite.js accounts --show rauty
  node suite.js all
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case 'health':
      await spawnScript('maintenance.js', rest);
      break;

    case 'accounts':
    case 'account':
      await spawnScript('account.js', rest);
      break;

    case 'all':
      console.log('═══ Running Health Scan ═══\n');
      await spawnScript('maintenance.js', rest);
      console.log('\n═══ Running Account Scan ═══\n');
      await spawnScript('account.js', ['--list', ...rest.filter(a => !['--fix', '--review'].includes(a))]);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "node suite.js --help" for usage.');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});