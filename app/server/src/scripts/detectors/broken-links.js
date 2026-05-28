import fs from 'fs';
import path from 'path';
import { walkDir, ext } from '../lib/utils.js';
import { getUserWorkspace, getUserAssets, getUserDir } from '../lib/users-db.js';

/**
 * 4.1 Broken Image Link Detector
 * Finds <img> tags in HTML documents where the src points to a file that no longer exists.
 */
export function detectBrokenImageLinks(username) {
  const findings = [];
  const workspace = getUserWorkspace(username);
  if (!fs.existsSync(workspace)) return findings;

  const { files } = walkDir(workspace);
  const htmlFiles = files.filter(f => ext(f) === 'html');

  // Build a set of all asset image paths for quick lookup
  const assetsDir = getUserAssets(username);
  const assetFiles = new Set();
  if (fs.existsSync(assetsDir)) {
    const { files: af } = walkDir(assetsDir);
    af.forEach(f => {
      assetFiles.add(path.relative(assetsDir, f));
      assetFiles.add(path.relative(getUserDir(username), f));
    });
  }

  for (const htmlFile of htmlFiles) {
    try {
      const content = fs.readFileSync(htmlFile, 'utf-8');
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        const src = match[1];
        let exists = true;

        if (src.startsWith('blob:')) {
          // Skip ephemeral blobs
        } else if (src.startsWith('/api/files/images/')) {
          const relPath = src.replace(/^\/api\/files\/images\//, '');
          exists = assetFiles.has(relPath);
        } else if (src.startsWith('/api/files/workspace/')) {
          const relPath = src.replace(/^\/api\/files\/workspace\//, '');
          const fullPath = path.join(workspace, relPath);
          exists = fs.existsSync(fullPath);
        } else if (src.startsWith('http://') || src.startsWith('https://')) {
          findings.push({
            type: 'brokenImageLink',
            severity: 'info',
            user: username,
            path: path.relative(workspace, htmlFile),
            detail: `External URL cannot be verified: ${src}`,
            action: 'Review manually',
            fixed: false,
          });
          continue;
        } else if (src.startsWith('/api/images/proxy?')) {
          const urlParts = new URL(src, 'http://localhost');
          const fileParam = urlParts.searchParams.get('file');
          if (fileParam) exists = assetFiles.has(fileParam);
        } else if (!src.startsWith('data:')) {
          const docDir = path.dirname(htmlFile);
          const resolved = path.resolve(docDir, src);
          exists = fs.existsSync(resolved);
        }

        if (!exists) {
          findings.push({
            type: 'brokenImageLink',
            severity: 'warning',
            user: username,
            path: path.relative(workspace, htmlFile),
            detail: `Broken image reference: ${src}`,
            action: 'Document broken links in maintenance report file',
            fixed: false,
          });
        }
      }
    } catch {
      // Skip unreadable HTML files
    }
  }
  return findings;
}