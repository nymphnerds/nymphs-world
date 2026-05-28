import fs from 'fs';
import path from 'path';
import { walkDir, isImage, hashFile } from '../lib/utils.js';
import { getUserAssets } from '../lib/users-db.js';

/**
 * 4.8 Duplicate Image Detector
 * Finds images with identical content hashes in user assets.
 */
export function detectDuplicateImages(username) {
  const findings = [];
  const assetsDir = getUserAssets(username);
  if (!fs.existsSync(assetsDir)) return findings;

  const { files } = walkDir(assetsDir);
  const images = files.filter(f => isImage(path.basename(f)));

  // Build hash -> files map
  const hashMap = new Map();
  for (const img of images) {
    try {
      const hash = hashFile(img);
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash).push(img);
    } catch {
      // Skip files that can't be hashed
    }
  }

  // Report duplicates
  for (const [hash, paths] of hashMap) {
    if (paths.length > 1) {
      const originals = [paths[0]];
      const duplicates = paths.slice(1);
      for (const dup of duplicates) {
        findings.push({
          type: 'duplicateImage',
          severity: 'info',
          user: username,
          path: dup,
          detail: `Duplicate of ${path.basename(originals[0])} (hash: ${hash})`,
          action: 'Report only - no automatic action',
          fixed: false,
        });
      }
    }
  }
  return findings;
}