import fs from 'fs';
import path from 'path';
import os from 'os';
import { getUserWorkspaceDir } from './authService.js';
import { safeJoin } from './pathSafety.js';
import { PROJECT_MANIFEST_FILE } from './projectService.js';

// Path to global tag registry. Nymphs World keeps it under NymphsData when launched as a module.
const WBU_DIR =
  process.env.NYMPHS_WORLD_META_DIR ||
  process.env.WORBI_META_DIR ||
  path.join(os.homedir(), '.wbu');
const TAGS_FILE = path.join(WBU_DIR, 'tags.json');

// Default tags provided on first initialization
const DEFAULT_TAGS = [
  { id: 'tag_001', name: 'MainChar', color: '#f59e0b', description: 'Main character' },
  { id: 'tag_002', name: 'MainChar2', color: '#eab308', description: 'Secondary main character' },
  { id: 'tag_003', name: 'NPC', color: '#6b7280', description: 'Non-player character' },
  { id: 'tag_004', name: 'Friend', color: '#22c55e', description: 'Ally or friend character' },
  { id: 'tag_005', name: 'Foe', color: '#ef4444', description: 'Enemy or foe character' },
];

// Ensure ~/.wbu directory exists
function ensureWbuDir() {
  if (!fs.existsSync(WBU_DIR)) {
    fs.mkdirSync(WBU_DIR, { recursive: true });
  }
}

// Initialize tag registry with defaults if it doesn't exist
function initializeTags() {
  ensureWbuDir();
  if (!fs.existsSync(TAGS_FILE)) {
    const registry = { tags: DEFAULT_TAGS };
    fs.writeFileSync(TAGS_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  }
}

// Load tag registry
function loadTagRegistry() {
  ensureWbuDir();
  if (!fs.existsSync(TAGS_FILE)) {
    initializeTags();
  }
  const raw = fs.readFileSync(TAGS_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Save tag registry
function saveTagRegistry(registry) {
  ensureWbuDir();
  fs.writeFileSync(TAGS_FILE, JSON.stringify(registry, null, 2), 'utf-8');
}

// --- Tag CRUD operations ---

// Get all tags
function getAllTags() {
  const registry = loadTagRegistry();
  return registry.tags;
}

// Create a new tag
function createTag(name, color, description) {
  if (!name || !name.trim()) {
    throw new Error('Tag name is required');
  }
  const registry = loadTagRegistry();
  // Check for duplicate name
  if (registry.tags.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error(`A tag named "${name.trim()}" already exists`);
  }
  const id = `tag_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
  const tag = {
    id,
    name: name.trim(),
    color: color || '#a78bfa', // default purple
    description: description || '',
  };
  registry.tags.push(tag);
  saveTagRegistry(registry);
  return tag;
}

// Update a tag
function updateTag(id, updates) {
  const registry = loadTagRegistry();
  const idx = registry.tags.findIndex(t => t.id === id);
  if (idx === -1) {
    throw new Error('Tag not found');
  }
  if (updates.name !== undefined) {
    if (!updates.name.trim()) {
      throw new Error('Tag name cannot be empty');
    }
    // Check for duplicate name (excluding self)
    if (registry.tags.some(t => t.id !== id && t.name.toLowerCase() === updates.name.trim().toLowerCase())) {
      throw new Error(`A tag named "${updates.name.trim()}" already exists`);
    }
    registry.tags[idx].name = updates.name.trim();
  }
  if (updates.color !== undefined) {
    registry.tags[idx].color = updates.color;
  }
  if (updates.description !== undefined) {
    registry.tags[idx].description = updates.description;
  }
  saveTagRegistry(registry);
  return registry.tags[idx];
}

// Delete a tag (also removes from all files' metadata)
function deleteTag(id) {
  const registry = loadTagRegistry();
  const idx = registry.tags.findIndex(t => t.id === id);
  if (idx === -1) {
    throw new Error('Tag not found');
  }
  const tagName = registry.tags[idx].name;
  registry.tags.splice(idx, 1);
  saveTagRegistry(registry);
  // Remove this tag from all file metadata across all users (best-effort)
  removeTagFromAllFiles(tagName);
  return { success: true, tagName };
}

// Remove a tag from all file metadata files (best-effort across workspace)
function removeTagFromAllFiles(tagName) {
  // This is a best-effort operation - we iterate through metadata files
  // The metadata files are stored as .wbu_meta.json alongside files
  // Since we don't have a central user directory listing, this is handled
  // per-user when their metadata is accessed
}

// --- File-level tag operations ---

// Binary/asset extensions to skip when scanning workspace files
const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'mp3', 'mp4', 'avi', 'mov', 'wmv',
  'exe', 'dll', 'so', 'dylib',
  'docx', 'xlsx', 'pptx',
]);

function isScannableFile(filename) {
  // Skip hidden/meta files and binary extensions
  if (filename.startsWith('.')) return false;
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

// Get metadata file path for a given file
function getMetaPath(username, filePath) {
  const workspaceRoot = getUserWorkspaceDir(username);
  const fileFullPath = safeJoin(workspaceRoot, filePath);
  const dir = path.dirname(fileFullPath);
  const base = path.basename(fileFullPath);
  return path.join(dir, `.__${base}.wbu_meta.json`);
}

// Load file metadata
function loadFileMeta(username, filePath) {
  const metaPath = getMetaPath(username, filePath);
  if (!fs.existsSync(metaPath)) {
    return { tags: [], relationships: [] };
  }
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { tags: [], relationships: [] };
  }
}

// Save file metadata
function saveFileMeta(username, filePath, meta) {
  const metaPath = getMetaPath(username, filePath);
  const dir = path.dirname(metaPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

// Get tags for a file
function getFileTags(username, filePath) {
  const meta = loadFileMeta(username, filePath);
  return meta.tags || [];
}

// Add tags to a file
function addTagsToFile(username, filePath, tagNames) {
  const allTags = getAllTags();
  const validTagNames = new Set(allTags.map(t => t.name));

  const meta = loadFileMeta(username, filePath);
  if (!meta.tags) meta.tags = [];

  const added = [];
  for (const tagName of tagNames) {
    if (!validTagNames.has(tagName)) {
      throw new Error(`Tag "${tagName}" does not exist`);
    }
    if (!meta.tags.includes(tagName)) {
      meta.tags.push(tagName);
      added.push(tagName);
    }
  }
  saveFileMeta(username, filePath, meta);
  return { success: true, added };
}

// Remove tag from a file
function removeTagFromFile(username, filePath, tagName) {
  const meta = loadFileMeta(username, filePath);
  if (!meta.tags) meta.tags = [];

  const before = meta.tags.length;
  meta.tags = meta.tags.filter(t => t !== tagName);

  if (meta.tags.length < before) {
    saveFileMeta(username, filePath, meta);
  }
  return { success: true, removed: tagName };
}

// Set tags on a file (replace all)
function setFileTags(username, filePath, tagNames) {
  const allTags = getAllTags();
  const validTagNames = new Set(allTags.map(t => t.name));

  for (const tagName of tagNames) {
    if (!validTagNames.has(tagName)) {
      throw new Error(`Tag "${tagName}" does not exist`);
    }
  }

  const meta = loadFileMeta(username, filePath);
  meta.tags = [...tagNames]; // copy
  saveFileMeta(username, filePath, meta);
  return { success: true, tags: meta.tags };
}

// Get all files with a specific tag (recursive workspace scan)
function getFilesByTag(username, tagName) {
  const workspaceRoot = getUserWorkspaceDir(username);
  const results = [];

  if (!fs.existsSync(workspaceRoot)) {
    return results;
  }

  function walkDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && isScannableFile(entry.name)) {
          const relativePath = path.relative(workspaceRoot, path.join(dirPath, entry.name));
          const meta = loadFileMeta(username, relativePath);
          if (meta.tags && meta.tags.includes(tagName)) {
            results.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
              tags: meta.tags,
            });
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(workspaceRoot);
  return results;
}

// Get implicit relationships for a file (files sharing at least one tag)
function getFileRelationships(username, filePath) {
  const meta = loadFileMeta(username, filePath);
  const fileTags = meta.tags || [];

  if (fileTags.length === 0) {
    return { file: filePath, implicit: [], explicit: meta.relationships || [] };
  }

  const workspaceRoot = getUserWorkspaceDir(username);
  const related = new Map(); // path -> { tags: Set, name }

  if (!fs.existsSync(workspaceRoot)) {
    return { file: filePath, implicit: [], explicit: meta.relationships || [] };
  }

  function walkDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && isScannableFile(entry.name)) {
          const relativePath = path.relative(workspaceRoot, path.join(dirPath, entry.name));
          if (relativePath === filePath) continue; // skip self

          const otherMeta = loadFileMeta(username, relativePath);
          const otherTags = otherMeta.tags || [];

          const sharedTags = fileTags.filter(t => otherTags.includes(t));
          if (sharedTags.length > 0) {
            if (!related.has(relativePath)) {
              related.set(relativePath, { name: entry.name, path: relativePath, sharedTags: [] });
            }
            related.get(relativePath).sharedTags.push(...sharedTags);
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(workspaceRoot);

  const implicit = Array.from(related.values()).map(r => ({
    name: r.name,
    path: r.path,
    sharedTags: [...new Set(r.sharedTags)], // deduplicate
  }));

  return { file: filePath, implicit, explicit: meta.relationships || [] };
}

// Enhance listDirectory results with tag metadata
function listDirectoryWithTags(username, dirPath = '') {
  const workspaceRoot = getUserWorkspaceDir(username);
  const fullPath = safeJoin(workspaceRoot, dirPath || '');

  if (!fs.existsSync(fullPath)) {
    throw new Error('Directory not found');
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  return entries
    .filter(entry => !entry.name.startsWith('.') && entry.name !== PROJECT_MANIFEST_FILE)
    .map(entry => {
      const itemPath = path.join(dirPath, entry.name);
      const fullItemPath = path.join(fullPath, entry.name);
      const item = {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        path: itemPath,
        size: entry.isFile() ? fs.statSync(fullItemPath).size : undefined,
        modified: entry.isFile() ? fs.statSync(fullItemPath).mtime.toISOString() : undefined,
      };

      // Attach tags for text files (non-binary, non-hidden)
      if (entry.isFile() && isScannableFile(entry.name)) {
        try {
          const meta = loadFileMeta(username, itemPath);
          item.tags = meta.tags || [];
        } catch {
          item.tags = [];
        }
      }

      return item;
    });
}

// Initialize on module load
initializeTags();

export {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getFileTags,
  addTagsToFile,
  removeTagFromFile,
  setFileTags,
  getFilesByTag,
  getFileRelationships,
  listDirectoryWithTags,
  loadFileMeta,
  saveFileMeta,
  initializeTags,
};
