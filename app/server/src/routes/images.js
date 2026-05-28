import express from 'express';
import fs from 'fs';
import path from 'path';
import { verifyToken } from '../services/authService.js';
import { getImageFullPath, getSafeWorkspaceFilePath } from '../services/fileService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Image MIME type mapping
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

/**
 * Normalize a file path for token signing/validation:
 * - Decode URL-encoded characters
 * - Convert backslashes to forward slashes
 * - Trim whitespace
 * - Reject null bytes and control characters
 */
function normalizeFilePath(raw) {
  const decoded = decodeURIComponent(raw);
  const normalized = decoded.replace(/\\/g, '/').trim();

  // Reject null bytes and control characters
  if (/[\x00-\x1f]/.test(normalized)) {
    throw new Error('Invalid file path: contains control characters');
  }

  // Reject path traversal
  if (normalized.includes('..')) {
    throw new Error('Invalid file path: path traversal detected');
  }

  return normalized;
}

/**
 * Detect MIME type from file extension
 */
function detectMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Generate a signed proxy URL for a single image file.
 * Uses the existing JWT to create a URL that can be used in <img> tags
 * without requiring an Authorization header.
 */
function generateSignedUrl(filePath, username, token) {
  const encodedPath = encodeURIComponent(filePath);
  return `/api/images/proxy?path=${encodedPath}&token=${token}&user=${encodeURIComponent(username)}`;
}

// ============================================================
// Public Route: Image Proxy (no auth header needed)
// ============================================================

/**
 * GET /api/images/proxy?path=folder/image.png&token=JWT&user=username
 *
 * Serves images without requiring an Authorization header. The JWT token
 * is passed as a query parameter instead, allowing <img> tags to work
 * since browsers cannot attach custom headers to image requests.
 */
router.get('/proxy', (req, res) => {
  try {
    const { path: filePath, token, user: username } = req.query;

    if (!filePath || !token || !username) {
      return res.status(400).json({
        error: 'Missing required parameter: path, token, and user are required',
      });
    }

    // Verify the JWT token from query string
    const result = verifyToken(token);
    if (!result.valid) {
      return res.status(403).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Ensure the token belongs to the requesting user
    if (result.username !== username) {
      return res.status(403).json({
        error: 'Token does not match user',
        code: 'USER_MISMATCH',
      });
    }

    // Normalize and validate the file path
    const normalizedPath = normalizeFilePath(filePath);
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'Image path required' });
    }

    // Resolve the safe full path (reuses existing path traversal guard)
    const safePath = getImageFullPath(username, pathSegments);

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }

    // Determine Content-Type from extension
    const mimeType = detectMimeType(pathSegments[pathSegments.length - 1]);

    // Set cache headers — 1 hour, private to prevent shared cache leakage
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    // Stream the file
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('[images/proxy] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve image' });
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid file path')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[images/proxy] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// Authenticated Routes: Image Signing
// ============================================================

/**
 * POST /api/images/sign
 * Auth required. Returns a signed proxy URL for a single image file.
 *
 * Body: { file: string } — relative path within the user's assets/images directory
 * Response: { url: string }
 */
router.post('/sign', authMiddleware, (req, res) => {
  try {
    const username = req.user.username;
    const { file: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Normalize and validate
    const normalizedPath = normalizeFilePath(filePath);
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    // Verify the file exists in the user's assets
    const safePath = getImageFullPath(username, pathSegments);
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Use the user's existing JWT token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'Token is required' });
    }

    const url = generateSignedUrl(normalizedPath, username, token);
    res.json({ url });
  } catch (error) {
    if (error.message.includes('Invalid file path')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[images/sign] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/images/sign-batch
 * Auth required. Returns signed proxy URLs for multiple image files.
 *
 * Body: { files: string[] } — array of relative paths
 * Response: { signed: [{ path: string, url: string }] }
 */
router.post('/sign-batch', authMiddleware, (req, res) => {
  try {
    const username = req.user.username;
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }

    // Limit batch size to prevent abuse
    if (files.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 files per batch' });
    }

    // Get the user's JWT token
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'Token is required' });
    }

    const signed = [];

    for (const filePath of files) {
      try {
        const normalizedPath = normalizeFilePath(filePath);
        const pathSegments = normalizedPath.split('/').filter(Boolean);

        // Skip files that don't exist (don't fail the entire batch)
        const safePath = getImageFullPath(username, pathSegments);
        if (!fs.existsSync(safePath)) {
          console.warn(`[images/sign-batch] Skipping missing file: ${filePath}`);
          continue;
        }

        const url = generateSignedUrl(normalizedPath, username, token);
        signed.push({ path: filePath, url });
      } catch (err) {
        console.warn(`[images/sign-batch] Skipping invalid file ${filePath}:`, err.message);
      }
    }

    res.json({ signed });
  } catch (error) {
    console.error('[images/sign-batch] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/images/sign-workspace
 * Auth required. Returns a signed proxy URL for an image in the workspace directory.
 * Used when the user clicks an image file in the file explorer to insert it into the editor.
 *
 * Body: { file: string } — relative path within the user's workspace directory
 * Response: { url: string }
 */
router.post('/sign-workspace', authMiddleware, (req, res) => {
  try {
    const username = req.user.username;
    const { file: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const normalizedPath = normalizeFilePath(filePath);
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    // Verify the file exists in the user's workspace
    const safePath = getSafeWorkspaceFilePath(username, pathSegments);
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'Token is required' });
    }

    const encodedPath = encodeURIComponent(normalizedPath);
    const url = `/api/images/proxy-ws?path=${encodedPath}&token=${token}&user=${encodeURIComponent(username)}`;
    res.json({ url });
  } catch (error) {
    if (error.message.includes('Invalid file path')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[images/sign-workspace] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/images/proxy-ws — proxy for workspace images (no auth header needed)
 * Same as /proxy but serves from the workspace directory instead of assets/images.
 */
router.get('/proxy-ws', (req, res) => {
  try {
    const { path: filePath, token, user: username } = req.query;

    if (!filePath || !token || !username) {
      return res.status(400).json({
        error: 'Missing required parameter: path, token, and user are required',
      });
    }

    const result = verifyToken(token);
    if (!result.valid) {
      return res.status(403).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    if (result.username !== username) {
      return res.status(403).json({ error: 'Token does not match user', code: 'USER_MISMATCH' });
    }

    const normalizedPath = normalizeFilePath(filePath);
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'File path required' });
    }

    const safePath = getSafeWorkspaceFilePath(username, pathSegments);

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }

    const mimeType = detectMimeType(pathSegments[pathSegments.length - 1]);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('[images/proxy-ws] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve file' });
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid file path')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[images/proxy-ws] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
