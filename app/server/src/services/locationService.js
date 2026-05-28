import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';
import { safeJoin } from './pathSafety.js';

// Per-user location registry stored in user's workspace
function getLocationsFilePath(username) {
  const workspaceRoot = getUserWorkspaceDir(username);
  return path.join(workspaceRoot, '.__wbu_locations.json');
}

// Load location registry for a user
function loadLocationRegistry(username) {
  const filePath = getLocationsFilePath(username);
  if (!fs.existsSync(filePath)) {
    return { locations: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { locations: [] };
  }
}

// Save location registry for a user
function saveLocationRegistry(username, registry) {
  const filePath = getLocationsFilePath(username);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf-8');
}

// --- Location CRUD operations ---

// Get all locations for a user
function getAllLocations(username) {
  const registry = loadLocationRegistry(username);
  return registry.locations;
}

// Create a new location for a user
function createLocation(username, name, color, description) {
  if (!name || !name.trim()) {
    throw new Error('Location name is required');
  }
  const registry = loadLocationRegistry(username);
  // Check for duplicate name
  if (registry.locations.some(l => l.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error(`A location named "${name.trim()}" already exists`);
  }
  const id = `loc_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
  const location = {
    id,
    name: name.trim(),
    color: color || '#10b981', // default emerald
    description: description || '',
  };
  registry.locations.push(location);
  saveLocationRegistry(username, registry);
  return location;
}

// Update a location for a user
function updateLocation(username, id, updates) {
  const registry = loadLocationRegistry(username);
  const idx = registry.locations.findIndex(l => l.id === id);
  if (idx === -1) {
    throw new Error('Location not found');
  }
  if (updates.name !== undefined) {
    if (!updates.name.trim()) {
      throw new Error('Location name cannot be empty');
    }
    // Check for duplicate name (excluding self)
    if (registry.locations.some(l => l.id !== id && l.name.toLowerCase() === updates.name.trim().toLowerCase())) {
      throw new Error(`A location named "${updates.name.trim()}" already exists`);
    }
    registry.locations[idx].name = updates.name.trim();
  }
  if (updates.color !== undefined) {
    registry.locations[idx].color = updates.color;
  }
  if (updates.description !== undefined) {
    registry.locations[idx].description = updates.description;
  }
  saveLocationRegistry(username, registry);
  return registry.locations[idx];
}

// Delete a location for a user (also removes from all files' metadata)
function deleteLocation(username, id) {
  const registry = loadLocationRegistry(username);
  const idx = registry.locations.findIndex(l => l.id === id);
  if (idx === -1) {
    throw new Error('Location not found');
  }
  const locationName = registry.locations[idx].name;
  registry.locations.splice(idx, 1);
  saveLocationRegistry(username, registry);
  // Remove this location from all file metadata
  removeLocationFromAllFiles(username, locationName);
  return { success: true, location: locationName };
}

// Remove a location from all file metadata files for a user
function removeLocationFromAllFiles(username, locationName) {
  const workspaceRoot = getUserWorkspaceDir(username);
  if (!fs.existsSync(workspaceRoot)) {
    return;
  }

  function walkDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && entry.name.endsWith('.wbu_meta.json')) {
          try {
            const metaPath = path.join(dirPath, entry.name);
            const raw = fs.readFileSync(metaPath, 'utf-8');
            const meta = JSON.parse(raw);
            if (meta.locations && meta.locations.includes(locationName)) {
              meta.locations = meta.locations.filter(l => l !== locationName);
              fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
            }
          } catch {
            // Skip unreadable/corrupt meta files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(workspaceRoot);
}

// --- File-level location operations ---

// Binary/asset extensions to skip when scanning workspace files
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
    return { tags: [], relationships: [], locations: [], scenes: [] };
  }
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(raw);
    // Ensure scenes field exists for backward compatibility
    if (!meta.scenes) meta.scenes = [];
    return meta;
  } catch {
    return { tags: [], relationships: [], locations: [], scenes: [] };
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

// Get locations for a file
function getFileLocations(username, filePath) {
  const meta = loadFileMeta(username, filePath);
  return meta.locations || [];
}

// Add locations to a file
function addLocationsToFile(username, filePath, locationNames) {
  const allLocations = getAllLocations(username);
  const validLocationNames = new Set(allLocations.map(l => l.name));

  const meta = loadFileMeta(username, filePath);
  if (!meta.locations) meta.locations = [];

  const added = [];
  for (const locationName of locationNames) {
    if (!validLocationNames.has(locationName)) {
      throw new Error(`Location "${locationName}" does not exist`);
    }
    if (!meta.locations.includes(locationName)) {
      meta.locations.push(locationName);
      added.push(locationName);
    }
  }
  saveFileMeta(username, filePath, meta);
  return { success: true, added };
}

// Remove location from a file
function removeLocationFromFile(username, filePath, locationName) {
  const meta = loadFileMeta(username, filePath);
  if (!meta.locations) meta.locations = [];

  const before = meta.locations.length;
  meta.locations = meta.locations.filter(l => l !== locationName);

  if (meta.locations.length < before) {
    saveFileMeta(username, filePath, meta);
  }
  return { success: true, removed: locationName };
}

// Set locations on a file (replace all)
function setFileLocations(username, filePath, locationNames) {
  const allLocations = getAllLocations(username);
  const validLocationNames = new Set(allLocations.map(l => l.name));

  for (const locationName of locationNames) {
    if (!validLocationNames.has(locationName)) {
      throw new Error(`Location "${locationName}" does not exist`);
    }
  }

  const meta = loadFileMeta(username, filePath);
  meta.locations = [...locationNames]; // copy
  saveFileMeta(username, filePath, meta);
  return { success: true, locations: meta.locations };
}

// Get all files with a specific location (recursive workspace scan)
function getFilesByLocation(username, locationName) {
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
          if (meta.locations && meta.locations.includes(locationName)) {
            results.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
              locations: meta.locations,
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

export {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getFileLocations,
  addLocationsToFile,
  removeLocationFromFile,
  setFileLocations,
  getFilesByLocation,
  loadFileMeta,
  saveFileMeta,
};
