import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './users-db.js';
import { ts } from './utils.js';

// ── Quarantine Log Collector ────────────────────────────────────────────────
// Collects all fix actions for QUARANTINE_INDEX.md generation
export const quarantineLog = {
  corruptedHtml: [],         // { user, originalPath, quarantinePath, issue }
  orphanedImage: [],         // { user, originalPath, quarantinePath }
  orphanedUserDir: [],       // { user, originalPath, quarantinePath }
  emptyDirRemoved: [],       // { user, path }
  orphanedMetadataDeleted: [], // { path, sourceFile }
  brokenLinksReported: [],   // { user, reportPath }
};

/** Reset all quarantine log arrays. */
export function resetQuarantineLog() {
  quarantineLog.corruptedHtml = [];
  quarantineLog.orphanedImage = [];
  quarantineLog.orphanedUserDir = [];
  quarantineLog.emptyDirRemoved = [];
  quarantineLog.orphanedMetadataDeleted = [];
  quarantineLog.brokenLinksReported = [];
}

// ── Quarantine Index Generation ─────────────────────────────────────────────

export function generateQuarantineIndex() {
  const t = ts();
  const now = new Date().toISOString();
  const md = [];

  md.push('# Quarantine Index');
  md.push(`**Generated:** ${now}`);
  md.push(`**Script Version:** 6.3.0`);
  md.push('');

  // Summary
  md.push('## Summary');
  md.push('');
  md.push('| Category | Count |');
  md.push('|---|---|');
  md.push(`| Corrupted HTML quarantined | ${quarantineLog.corruptedHtml.length} |`);
  md.push(`| Orphaned images moved | ${quarantineLog.orphanedImage.length} |`);
  md.push(`| Orphaned user dirs moved | ${quarantineLog.orphanedUserDir.length} |`);
  md.push(`| Empty dirs removed | ${quarantineLog.emptyDirRemoved.length} |`);
  md.push(`| Orphaned metadata deleted | ${quarantineLog.orphanedMetadataDeleted.length} |`);
  md.push(`| Broken links reported | ${quarantineLog.brokenLinksReported.length} |`);
  md.push('');

  const totalItems = quarantineLog.corruptedHtml.length +
    quarantineLog.orphanedImage.length +
    quarantineLog.orphanedUserDir.length +
    quarantineLog.emptyDirRemoved.length +
    quarantineLog.orphanedMetadataDeleted.length;

  if (totalItems === 0 && quarantineLog.brokenLinksReported.length === 0) {
    md.push('*No items were quarantined or removed.*');
    md.push('');
  }

  // Corrupted HTML
  if (quarantineLog.corruptedHtml.length > 0) {
    md.push('## Corrupted HTML Files');
    md.push('');
    md.push('Moved to `.corrupted-*` folder in user workspace.');
    md.push('');
    md.push('| User | Original Path | Quarantine Path | Issue | Restore Command |');
    md.push('|---|---|---|---|---|');
    for (const item of quarantineLog.corruptedHtml) {
      md.push(`| ${item.user} | \`${item.originalPath}\` | \`${item.quarantinePath}\` | ${item.issue} | \`mv "${item.quarantinePath}" "${item.originalPath}\"\` |`);
    }
    md.push('');
  }

  // Orphaned Images
  if (quarantineLog.orphanedImage.length > 0) {
    md.push('## Orphaned Images');
    md.push('');
    md.push('Moved to `.orphaned-*` folder in user assets.');
    md.push('');
    md.push('| User | Original Path | Quarantine Path | Restore Command |');
    md.push('|---|---|---|---|');
    for (const item of quarantineLog.orphanedImage) {
      md.push(`| ${item.user} | \`${item.originalPath}\` | \`${item.quarantinePath}\` | \`mv "${item.quarantinePath}" "${item.originalPath}\"\` |`);
    }
    md.push('');
  }

  // Orphaned User Directories
  if (quarantineLog.orphanedUserDir.length > 0) {
    md.push('## Orphaned User Directories');
    md.push('');
    md.push('Moved to `.removed-users/` in data directory.');
    md.push('');
    md.push('| Username | Original Path | Quarantine Path | Restore Command |');
    md.push('|---|---|---|---|');
    for (const item of quarantineLog.orphanedUserDir) {
      md.push(`| ${item.user} | \`${item.originalPath}\` | \`${item.quarantinePath}\` | \`mv "${item.quarantinePath}" "${item.originalPath}\"\` |`);
    }
    md.push('');
  }

  // Removed Empty Directories
  if (quarantineLog.emptyDirRemoved.length > 0) {
    md.push('## Removed Empty Directories');
    md.push('');
    md.push('These directories were empty and have been deleted.');
    md.push('');
    md.push('| User | Path | Note |');
    md.push('|---|---|---|');
    for (const item of quarantineLog.emptyDirRemoved) {
      md.push(`| ${item.user} | \`${item.path}\` | Empty directory |`);
    }
    md.push('');
  }

  // Deleted Orphaned Metadata
  if (quarantineLog.orphanedMetadataDeleted.length > 0) {
    md.push('## Deleted Orphaned Metadata');
    md.push('');
    md.push('Metadata files for non-existent source files have been deleted.');
    md.push('');
    md.push('| Path | Source File (missing) |');
    md.push('|---|---|');
    for (const item of quarantineLog.orphanedMetadataDeleted) {
      md.push(`| \`${item.path}\` | ${item.sourceFile} |`);
    }
    md.push('');
  }

  // Broken Links Reports
  if (quarantineLog.brokenLinksReported.length > 0) {
    md.push('## Broken Image Links Reports');
    md.push('');
    md.push('Reports generated in user workspaces.');
    md.push('');
    md.push('| User | Report Path |');
    md.push('|---|---|');
    for (const item of quarantineLog.brokenLinksReported) {
      md.push(`| ${item.user} | \`${item.reportPath}\` |`);
    }
    md.push('');
  }

  // Recovery Instructions
  md.push('## Recovery Instructions');
  md.push('');
  md.push('### Restore a quarantined file');
  md.push('');
  md.push('```bash');
  md.push('# Move file from quarantine back to its original location');
  md.push('mv "<quarantine_path>" "<original_path>"');
  md.push('```');
  md.push('');
  md.push('### Restore an orphaned user directory');
  md.push('');
  md.push('```bash');
  md.push('# Move user directory back and re-add to users.json');
  md.push('mv "<quarantine_path>" "<original_users_path>"');
  md.push('# Then add entry to server/src/data/users.json');
  md.push('```');
  md.push('');
  md.push('### Note on empty directories');
  md.push('');
  md.push('Empty directories cannot be recovered (they contained no files).');
  md.push('If needed, recreate with: `mkdir -p "<path>"`');
  md.push('');
  md.push('### Note on orphaned metadata');
  md.push('');
  md.push('Deleted metadata files cannot be recovered. If the source file is');
  md.push('restored, metadata will be recreated automatically on next access.');
  md.push('');
  md.push('---');
  md.push(`*Generated by WORBI Maintenance Script v6.3.0 at ${now}*`);

  const indexPath = path.join(DATA_DIR, `QUARANTINE_INDEX_${t}.md`);
  fs.writeFileSync(indexPath, md.join('\n'), 'utf-8');
  return indexPath;
}