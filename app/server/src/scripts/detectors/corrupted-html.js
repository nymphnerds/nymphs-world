import fs from 'fs';
import path from 'path';
import { walkDir, ext, ts } from '../lib/utils.js';
import { getUserWorkspace } from '../lib/users-db.js';

/**
 * 4.5 Corrupted HTML Detector
 * Finds HTML files with missing doctype/html/body tags or invalid JSON data attributes.
 */
export function detectCorruptedHtml(username) {
  const findings = [];
  const workspace = getUserWorkspace(username);
  if (!fs.existsSync(workspace)) return findings;

  const { files } = walkDir(workspace);
  const htmlFiles = files.filter(f => ext(f) === 'html');

  for (const htmlFile of htmlFiles) {
    let content;
    try {
      content = fs.readFileSync(htmlFile, 'utf-8');
    } catch {
      findings.push({
        type: 'corruptedHtml',
        severity: 'error',
        user: username,
        path: path.relative(workspace, htmlFile),
        detail: 'File cannot be read - possible encoding corruption',
        action: `Move to .corrupted-${ts()}/`,
        fixed: false,
      });
      continue;
    }

    // Check for required structural tags
    const lower = content.toLowerCase();
    if (!lower.includes('<!doctype') || !lower.includes('<html') || !lower.includes('<body')) {
      findings.push({
        type: 'corruptedHtml',
        severity: 'error',
        user: username,
        path: path.relative(workspace, htmlFile),
        detail: 'Missing required structural tags (doctype, html, or body)',
        action: `Move to .corrupted-${ts()}/`,
        fixed: false,
      });
      continue;
    }

    // Check JSON data attributes
    const dataAttrRegex = /\s(data-[^=]+)="([^"]*(?:\\.|[^"])*?)"([^0-9])/g;
    let match;
    while ((match = dataAttrRegex.exec(content)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      if (attrName.includes('json') || attrName.includes('data') || attrName.includes('config')) {
        try {
          JSON.parse(attrValue);
        } catch {
          findings.push({
            type: 'corruptedHtml',
            severity: 'warning',
            user: username,
            path: path.relative(workspace, htmlFile),
            detail: `Invalid JSON in data attribute: ${attrName}`,
            action: `Move to .corrupted-${ts()}/`,
            fixed: false,
          });
          break; // One finding per file for data attributes
        }
      }
    }
  }
  return findings;
}