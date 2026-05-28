import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';

// Per-user scene registry stored in user's workspace
function getScenesFilePath(username) {
  const workspaceRoot = getUserWorkspaceDir(username);
  return path.join(workspaceRoot, '.__wbu_scenes.json');
}

// Load scene registry for a user
function loadSceneRegistry(username) {
  const filePath = getScenesFilePath(username);
  if (!fs.existsSync(filePath)) {
    return { scenes: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { scenes: [] };
  }
}

// Save scene registry for a user
function saveSceneRegistry(username, registry) {
  const filePath = getScenesFilePath(username);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf-8');
}

// --- Scene CRUD operations ---

// Get all scenes for a user
function getAllScenes(username) {
  const registry = loadSceneRegistry(username);
  return registry.scenes;
}

// Create a new scene for a user
function createScene(username, name, era, date, locationName) {
  if (!name || !name.trim()) {
    throw new Error('Scene name is required');
  }
  if (!era) {
    throw new Error('Era is required');
  }
  if (!locationName) {
    throw new Error('Location is required');
  }
  const registry = loadSceneRegistry(username);
  // Check for duplicate name
  if (registry.scenes.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error(`A scene named "${name.trim()}" already exists`);
  }
  const id = `scene_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
  const scene = {
    id,
    name: name.trim(),
    era,
    date: date || '',
    locationName,
  };
  registry.scenes.push(scene);
  saveSceneRegistry(username, registry);
  return scene;
}

// Update a scene for a user
function updateScene(username, id, updates) {
  const registry = loadSceneRegistry(username);
  const idx = registry.scenes.findIndex(s => s.id === id);
  if (idx === -1) {
    throw new Error('Scene not found');
  }
  if (updates.name !== undefined) {
    if (!updates.name.trim()) {
      throw new Error('Scene name cannot be empty');
    }
    // Check for duplicate name (excluding self)
    if (registry.scenes.some(s => s.id !== id && s.name.toLowerCase() === updates.name.trim().toLowerCase())) {
      throw new Error(`A scene named "${updates.name.trim()}" already exists`);
    }
    registry.scenes[idx].name = updates.name.trim();
  }
  if (updates.era !== undefined) {
    registry.scenes[idx].era = updates.era;
  }
  if (updates.date !== undefined) {
    registry.scenes[idx].date = updates.date;
  }
  if (updates.locationName !== undefined) {
    registry.scenes[idx].locationName = updates.locationName;
  }
  saveSceneRegistry(username, registry);
  return registry.scenes[idx];
}

// Delete a scene for a user (also removes from all files' metadata)
function deleteScene(username, id) {
  const registry = loadSceneRegistry(username);
  const idx = registry.scenes.findIndex(s => s.id === id);
  if (idx === -1) {
    throw new Error('Scene not found');
  }
  const sceneName = registry.scenes[idx].name;
  registry.scenes.splice(idx, 1);
  saveSceneRegistry(username, registry);
  // Remove this scene from all file metadata
  removeSceneFromAllFiles(username, id);
  return { success: true, scene: sceneName };
}

// Remove a scene from all file metadata files for a user
function removeSceneFromAllFiles(username, sceneId) {
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
            if (meta.scenes && meta.scenes.includes(sceneId)) {
              meta.scenes = meta.scenes.filter(s => s !== sceneId);
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

// --- File-level scene operations ---

// Get metadata file path for a given file
function getMetaPath(username, filePath) {
  const workspaceRoot = getUserWorkspaceDir(username);
  const fileFullPath = path.join(workspaceRoot, filePath);
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

// Get scenes for a file (returns scene IDs)
function getFileScenes(username, filePath) {
  const meta = loadFileMeta(username, filePath);
  return meta.scenes || [];
}

// Add scenes to a file (accepts scene IDs)
function addScenesToFile(username, filePath, sceneIds) {
  const allScenes = getAllScenes(username);
  const validSceneIds = new Set(allScenes.map(s => s.id));

  const meta = loadFileMeta(username, filePath);
  if (!meta.scenes) meta.scenes = [];

  const added = [];
  for (const sceneId of sceneIds) {
    if (!validSceneIds.has(sceneId)) {
      throw new Error(`Scene "${sceneId}" does not exist`);
    }
    if (!meta.scenes.includes(sceneId)) {
      meta.scenes.push(sceneId);
      added.push(sceneId);
    }
  }
  saveFileMeta(username, filePath, meta);
  return { success: true, added };
}

// Remove scene from a file
function removeSceneFromFile(username, filePath, sceneId) {
  const meta = loadFileMeta(username, filePath);
  if (!meta.scenes) meta.scenes = [];

  const before = meta.scenes.length;
  meta.scenes = meta.scenes.filter(s => s !== sceneId);

  if (meta.scenes.length < before) {
    saveFileMeta(username, filePath, meta);
  }
  return { success: true, removed: sceneId };
}

export {
  getAllScenes,
  createScene,
  updateScene,
  deleteScene,
  getFileScenes,
  addScenesToFile,
  removeSceneFromFile,
  loadFileMeta,
  saveFileMeta,
};