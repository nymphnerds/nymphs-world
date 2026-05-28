import fs from 'fs';
import path from 'path';
import { walkDir, ext, isImage, ts } from '../lib/utils.js';
import { getUserWorkspace, getUserAssets, getUserDir } from '../lib/users-db.js';

/**
 * 4.2 Orphaned Image Detector
 * Finds images in user assets not referenced by any document.
 */
export function detectOrphanedImages(username) {
  const findings = [];
  const workspace = getUserWorkspace(username);
  const assetsDir = getUserAssets(username);
  if (!fs.existsSync(assetsDir)) return findings;

  const referenced = new Set();
  if (fs.existsSync(workspace)) {
    const { files } = walkDir(workspace);
    const htmlFiles = files.filter(f => ext(f) === 'html');
    for (const htmlFile of htmlFiles) {
      try {
        const content = fs.readFileSync(htmlFile, 'utf-8');
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          const src = match[1];
          if (src.startsWith('/api/files/images/')) {
            referenced.add(src.replace(/^\/api\/files\/images\//, ''));
          } else if (src.startsWith('/api/images/proxy?')) {
            const urlParts = new URL(src, 'http://localhost');
            const fileParam = urlParts.searchParams.get('file');
            if (fileParam) referenced.add(fileParam);
          }
        }
      } catch { /* skip */ }
    }
  }

  const { files } = walkDir(assetsDir);
  for (const imgFile of files) {
    if (!isImage(path.basename(imgFile))) continue;
    const relPath = path.relative(assetsDir, imgFile);
    const userRelPath = path.relative(getUserDir(username), imgFile);
    if (!referenced.has(relPath) && !referenced.has(userRelPath)) {
      findings.push({
        type: 'orphanedImage',
        severity: 'warning',
        user: username,
        path: imgFile,
        detail: 'Image not referenced by any HTML document in workspace',
        action: `Move to .orphaned-${ts()}/`,
        fixed: false,
      });
    }
  }
  return findings;
}