import fs from 'fs';
import path from 'path';
import { walkDir, isEmptyDir } from '../lib/utils.js';
import { getUserWorkspace } from '../lib/users-db.js';

/**
 * 4.4 Empty Directory Detector
 * Finds empty directories in workspace (excludes default template dirs).
 */
export function detectEmptyDirs(username) {
  const findings = [];
  const workspace = getUserWorkspace(username);
  if (!fs.existsSync(workspace)) return findings;

  const skipDirs = new Set(['MainStory', 'Quests', 'PlayerCharacters', 'NPCs', 'Locations', 'Items']);

  const { dirs } = walkDir(workspace);
  const sorted = [...dirs].sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);

  for (const dir of sorted) {
    const relPath = path.relative(workspace, dir);
    const dirName = path.basename(dir);

    if (skipDirs.has(dirName)) continue;

    if (isEmptyDir(dir)) {
      findings.push({
        type: 'emptyDir',
        severity: 'info',
        user: username,
        path: dir,
        detail: `Empty directory: ${relPath}`,
        action: 'Remove empty directory',
        fixed: false,
      });
    }
  }
  return findings;
}
