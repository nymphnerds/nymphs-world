import fs from 'fs';
import express from 'express';
import path from 'path';
import { getUserWorkspaceDir } from '../services/authService.js';
import { getFileTags as getFileTagsFromService, getAllTags as getAllTagsFromService } from '../services/tagService.js';
import { getAllScenes, loadFileMeta, getFileScenes } from '../services/sceneService.js';

const router = express.Router();

const TIMELINE_METADATA_FILE = '.wbu_timeline_metadata.json';

// Load persisted timeline metadata from sidecar JSON
function loadTimelineMetadata(workspaceRoot) {
  const metaPath = path.join(workspaceRoot, TIMELINE_METADATA_FILE);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

// Save timeline metadata to sidecar JSON
function saveTimelineMetadata(workspaceRoot, data) {
  const metaPath = path.join(workspaceRoot, TIMELINE_METADATA_FILE);
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf-8');
}

// PUT /api/files/timeline/metadata - Persist timeline metadata server-side
router.put('/timeline/metadata', (req, res) => {
  try {
    const username = req.user.username;
    const workspaceRoot = getUserWorkspaceDir(username);
    const { filePath, metadata } = req.body;

    if (!filePath || !metadata) {
      return res.status(400).json({ error: 'filePath and metadata required' });
    }

    const all = loadTimelineMetadata(workspaceRoot);
    if (!all[filePath]) {
      all[filePath] = {};
    }
    // Merge: add/update fields, delete fields set to empty string
    for (const [key, value] of Object.entries(metadata)) {
      if (value === '') {
        delete all[filePath][key];
      } else {
        all[filePath][key] = value;
      }
    }
    // Clean up empty entries
    if (Object.keys(all[filePath]).length === 0) {
      delete all[filePath];
    }
    saveTimelineMetadata(workspaceRoot, all);
    res.json({ ok: true });
  } catch (error) {
    console.error('[timeline] Error saving metadata:', error);
    res.status(500).json({ error: 'Failed to save timeline metadata' });
  }
});

// Default era ordering (fallback when client doesn't send eraOrder)
const DEFAULT_ERA_ORDER = [
  'First Age',
  'Second Age',
  'Third Age',
  'Fourth Age',
  'Future',
  'Unknown'
];

// Extract a sortable number from a date string
function extractSortableDate(dateStr) {
  if (!dateStr) return null;

  // Try to extract the longest numeric sequence (1-6 digits)
  // Prefer 4-6 digit years, but also accept single digits like "1", "8", etc.
  const yearMatch = dateStr.match(/(\d{4,6})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (dateStr.toLowerCase().includes('bce') || dateStr.toLowerCase().includes(' bc')) {
      return -year;
    }
    return year;
  }

  // Any number 1-3 digits (e.g., "1", "18", "301")
  const numMatch = dateStr.match(/(\d{1,3})/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return null;
}

// Binary/asset extensions to skip when scanning
const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'mp3', 'mp4', 'avi', 'mov', 'wmv',
  'exe', 'dll', 'so', 'dylib',
  'docx', 'xlsx', 'pptx',
]);

function isScannableFile(filename) {
  if (filename.startsWith('.')) return false;
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

// Recursively walk directory to find all scannable text files
function walkDir(dirPath, workspaceRoot, entries = []) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        walkDir(path.join(dirPath, item.name), workspaceRoot, entries);
      } else if (item.isFile() && isScannableFile(item.name)) {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(workspaceRoot, fullPath);
        entries.push({ fullPath, relativePath });
      }
    }
  } catch (e) {
    // Skip directories that can't be read
  }
  return entries;
}

// GET /api/files/timeline/suggest-date?era=Third+Age - Suggest next date for era
router.get('/timeline/suggest-date', (req, res) => {
  try {
    const { era } = req.query;
    if (!era) {
      return res.status(400).json({ error: 'era query parameter required' });
    }

    const username = req.user.username;
    const workspaceRoot = getUserWorkspaceDir(username);
    if (!fs.existsSync(workspaceRoot)) {
      return res.json({ suggestedDate: '1' });
    }

    let maxDate = null;
    let countInEra = 0;

    // Scan scenes for date suggestions (scenes are the primary timeline entries)
    const allScenes = getAllScenes(username);
    for (const scene of allScenes) {
      if (scene.era === era) {
        countInEra++;
        const num = extractSortableDate(scene.date);
        if (num !== null && (maxDate === null || num > maxDate)) {
          maxDate = num;
        }
      }
    }

    // Use highest existing date + 1, or fall back to count + 1 for non-numeric dates
    const suggested = maxDate !== null ? String(maxDate + 1) : String(countInEra + 1);
    res.json({ suggestedDate: suggested });
  } catch (error) {
    console.error('[timeline] Error suggesting date:', error);
    res.status(500).json({ error: 'Failed to suggest date' });
  }
});

// GET /api/files/timeline - Get timeline grouped by era → scenes → files
// Accepts optional eraOrder query param (JSON array) for user-defined era ordering
router.get('/timeline', (req, res) => {
  try {
    const username = req.user.username;
    const workspaceRoot = getUserWorkspaceDir(username);
    if (!fs.existsSync(workspaceRoot)) {
      return res.json({ eras: [] });
    }

    // Parse era order from client (or use defaults)
    let eraOrder = [...DEFAULT_ERA_ORDER];
    try {
      if (req.query.eraOrder) {
        const parsed = JSON.parse(req.query.eraOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          eraOrder = parsed;
        }
      }
    } catch {
      // Use defaults if parsing fails
    }

    // Get all workspace scenes
    const allScenes = getAllScenes(username);

    // Walk workspace to build a reverse map: sceneId → files
    const files = walkDir(workspaceRoot, workspaceRoot);
    const sceneToFiles = new Map(); // sceneId → [{ path, name, tags }]

    for (const file of files) {
      try {
        const sceneIds = getFileScenes(username, file.relativePath);
        for (const sceneId of sceneIds) {
          if (!sceneToFiles.has(sceneId)) {
            sceneToFiles.set(sceneId, []);
          }

          // Get file tags
          let fileTags = [];
          try {
            const tagNames = getFileTagsFromService(username, file.relativePath);
            const allTags = getAllTagsFromService();
            fileTags = tagNames.map(name => {
              const tagDef = allTags.find(t => t.name === name);
              return { name, color: tagDef ? tagDef.color : '#a78bfa' };
            });
          } catch { /* skip */ }

          sceneToFiles.get(sceneId).push({
            path: file.relativePath,
            name: path.basename(file.relativePath, path.extname(file.relativePath)),
            tags: fileTags
          });
        }
      } catch { /* skip */ }
    }

    // Build era → scenes → files structure
    const eraMap = new Map();

    for (const scene of allScenes) {
      const eraName = scene.era || 'Unknown';
      if (!eraMap.has(eraName)) {
        eraMap.set(eraName, []);
      }

      const sceneEntry = {
        id: scene.id,
        name: scene.name,
        era: scene.era,
        date: scene.date || '',
        dateSortable: extractSortableDate(scene.date),
        locationName: scene.locationName || '',
        files: sceneToFiles.get(scene.id) || []
      };

      eraMap.get(eraName).push(sceneEntry);
    }

    // Sort scenes within each era by date
    for (const [era, scenes] of eraMap) {
      scenes.sort((a, b) => {
        if (a.dateSortable !== null && b.dateSortable !== null) {
          return a.dateSortable - b.dateSortable;
        }
        if (a.dateSortable !== null) return -1;
        if (b.dateSortable !== null) return 1;
        if (a.date && b.date) {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
        }
        return a.name.localeCompare(b.name);
      });
    }

    // Sort eras by user-defined order, unknown eras at bottom
    const sortedEras = [];
    const unknownEras = [];

    for (const eraName of eraOrder) {
      if (eraMap.has(eraName)) {
        sortedEras.push({
          name: eraName,
          scenes: eraMap.get(eraName)
        });
        eraMap.delete(eraName);
      }
    }

    // Remaining eras (not in eraOrder) go to bottom, sorted alphabetically
    for (const [eraName, scenes] of eraMap) {
      unknownEras.push({ name: eraName, scenes });
    }
    unknownEras.sort((a, b) => a.name.localeCompare(b.name));

    sortedEras.push(...unknownEras);

    res.json({ eras: sortedEras });
  } catch (error) {
    console.error('[timeline] Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

export default router;
