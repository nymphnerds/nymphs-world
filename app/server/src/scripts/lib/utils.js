import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Image extensions ────────────────────────────────────────────────────────
export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico']);

/** Get file extension (lowercase, without dot). */
export function ext(name) {
  return path.extname(name).toLowerCase().slice(1);
}

/** Check if a filename has an image extension. */
export function isImage(filename) {
  return IMAGE_EXTS.has(ext(filename));
}

/** Get timestamp string for quarantine directories. */
export function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
}

/** Recursively walk a directory and return arrays of file paths and dir paths. */
export function walkDir(dirPath) {
  let files = [];
  let dirs = [];
  if (!fs.existsSync(dirPath)) return { files, dirs };
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        dirs.push(fullPath);
        const sub = walkDir(fullPath);
        files.push(...sub.files);
        dirs.push(...sub.dirs);
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return { files, dirs };
}

/** Check if a directory is empty (no files at any depth). */
export function isEmptyDir(dirPath) {
  const { files } = walkDir(dirPath);
  return files.length === 0;
}

/** Create directory recursively if it doesn't exist. */
export function safeMkdir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/** Move a file or directory to a destination path (creates parent dirs). */
export function safeMove(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(src, dest);
}

/** SHA-256 hash of the first N bytes of a file (pre-filter for duplicates). */
export function hashFilePrefix(filePath, byteCount) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(byteCount);
  const bytesRead = fs.readSync(fd, buf, 0, byteCount, 0);
  fs.closeSync(fd);
  const actual = buf.slice(0, bytesRead);
  return crypto.createHash('sha256').update(actual).digest('hex');
}

/** SHA-256 hash of an entire file. */
export function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Recursively calculate total byte size and file count of a directory. */
export function dirSize(dirPath) {
  let totalBytes = 0;
  let fileCount = 0;
  if (!fs.existsSync(dirPath)) return { bytes: 0, files: 0 };
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = dirSize(fullPath);
        totalBytes += sub.bytes;
        fileCount += sub.files;
      } else {
        try {
          const stat = fs.statSync(fullPath);
          totalBytes += stat.size;
          fileCount++;
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return { bytes: totalBytes, files: fileCount };
}

/** Format bytes to human-readable string. */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}
