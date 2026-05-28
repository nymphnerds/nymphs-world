import fs from 'fs';
import path from 'path';
import { walkDir } from '../lib/utils.js';
import { getUserWorkspace } from '../lib/users-db.js';

/**
 * 4.3 Orphaned Metadata File Detector
 * Finds .__<filename>.wbu_meta.json files where the source file no longer exists.
 */
export function detectOrphanedMetadata(username) {
  const findings = [];
  const workspace = getUserWorkspace(username);
  if (!fs.existsSync(workspace)) return findings;

  const { files } = walkDir(workspace);
  for (const file of files) {
    const base = path.basename(file);
    if (base.endsWith('.wbu_meta.json') && base.startsWith('.__')) {
      const sourceName = base.slice(3, base.length - '.wbu_meta.json'.length);
      const sourcePath = path.join(path.dirname(file), sourceName);

      if (!fs.existsSync(sourcePath)) {
        findings.push({
          type: 'orphanedMetadata',
          severity: 'warning',
          user: username,
          path: file,
          detail: `Metadata file for non-existent source: ${sourceName}`,
          action: 'Delete orphaned metadata file',
          fixed: false,
        });
      } else {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const parsed = JSON.parse(content);
          if (!parsed || typeof parsed !== 'object') {
            findings.push({
              type: 'orphanedMetadata',
              severity: 'error',
              user: username,
              path: file,
              detail: 'Metadata file has invalid JSON structure',
              action: 'Delete corrupted metadata file',
              fixed: false,
            });
          }
        } catch {
          findings.push({
            type: 'orphanedMetadata',
            severity: 'error',
            user: username,
            path: file,
            detail: 'Metadata file contains invalid JSON',
            action: 'Delete corrupted metadata file',
            fixed: false,
          });
        }
      }
    }
  }
  return findings;
}