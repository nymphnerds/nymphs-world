import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';
import {
  getAllScenes,
  addScenesToFile,
  loadFileMeta,
} from './sceneService.js';

// Sanitize scene name for filename
function sanitizeFileName(sceneName) {
  return sceneName.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

// Get the Dialogue folder path for a user
function getDialogueDir(username) {
  const workspaceDir = getUserWorkspaceDir(username);
  const dialogueDir = path.join(workspaceDir, 'Dialogue');
  if (!fs.existsSync(dialogueDir)) {
    fs.mkdirSync(dialogueDir, { recursive: true });
  }
  return dialogueDir;
}

// Look up a scene by ID
function getSceneById(username, sceneId) {
  const scenes = getAllScenes(username);
  return scenes.find(s => s.id === sceneId) || null;
}

// Get dialogue file path for a scene
function getDialogueFilePath(username, sceneName) {
  const dialogueDir = getDialogueDir(username);
  const fileName = sanitizeFileName(sceneName) + '.html';
  return {
    fullPath: path.join(dialogueDir, fileName),
    relativePath: `Dialogue/${fileName}`,
  };
}

// Generate initial HTML for a scene
function generateDialogueHtml(scene) {
  const dateStr = scene.date ? ` | <strong>Date:</strong> ${scene.date}` : '';
  return `<!-- Build: Yes -->
<!-- Template: Dialogue -->
<h2>Scene: ${scene.name}</h2>
<p><strong>Era:</strong> ${scene.era}${dateStr} | <strong>Location:</strong> ${scene.locationName}</p>
<hr>
`;
}

// Ensure dialogue file exists for a scene (idempotent)
async function ensureDialogueFile(username, sceneId) {
  const scene = getSceneById(username, sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }

  const { fullPath, relativePath } = getDialogueFilePath(username, scene.name);
  const existed = fs.existsSync(fullPath);

  if (!existed) {
    const html = generateDialogueHtml(scene);
    fs.writeFileSync(fullPath, html, 'utf-8');
  }

  return { path: relativePath, existed };
}

// Read dialogue HTML file for a scene
async function readDialogueFile(username, sceneId) {
  const scene = getSceneById(username, sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }

  const { fullPath, relativePath } = getDialogueFilePath(username, scene.name);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Dialogue file not found: ${scene.name}`);
  }

  const html = fs.readFileSync(fullPath, 'utf-8');
  return { html, path: relativePath };
}

// Save dialogue HTML file for a scene and auto-assign to scene
async function saveDialogueFile(username, sceneId, html) {
  const scene = getSceneById(username, sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }

  const { fullPath, relativePath } = getDialogueFilePath(username, scene.name);

  // Ensure Dialogue folder exists
  getDialogueDir(username);

  fs.writeFileSync(fullPath, html, 'utf-8');

  // Auto-assign the dialogue file to the scene
  try {
    const fileMeta = loadFileMeta(username, relativePath);
    const currentScenes = fileMeta.scenes || [];
    if (!currentScenes.includes(sceneId)) {
      addScenesToFile(username, relativePath, [sceneId]);
    }
  } catch (err) {
    console.error('[dialogue] Failed to auto-assign file to scene:', err.message);
    // Don't fail the save if assignment fails
  }

  // Also assign scene to the dialogue file's meta (dialogue file → scene relationship)
  try {
    addScenesToFile(username, relativePath, [sceneId]);
  } catch (err) {
    // May already be assigned, ignore
  }

  return { path: relativePath };
}

// Get participants (NPCs and PlayerCharacters) assigned to a scene
function getSceneParticipants(username, sceneId) {
  const scenes = getAllScenes(username);
  const scene = scenes.find(s => s.id === sceneId);
  if (!scene) {
    return [];
  }

  const workspaceDir = getUserWorkspaceDir(username);
  const participants = [];

  // Walk the workspace to find files assigned to this scene
  function walkDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skip hidden directories and Dialogue folder
          if (entry.name.startsWith('.__') || entry.name === 'Dialogue') {
            continue;
          }
          walkDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          const filePath = path.join(dirPath, entry.name);
          const relativeFile = path.relative(workspaceDir, filePath);

          // Check if this file is in NPCs or PlayerCharacters folder
          const isInNpcs = relativeFile.startsWith('NPCs/');
          const isInPlayerCharacters = relativeFile.startsWith('PlayerCharacters/');

          if (isInNpcs || isInPlayerCharacters) {
            try {
              const meta = loadFileMeta(username, relativeFile);
              if (meta.scenes && meta.scenes.includes(sceneId)) {
                const name = entry.name.replace('.html', '');
                participants.push({
                  name,
                  path: relativeFile,
                  type: isInNpcs ? 'npc' : 'playercharacter',
                });
              }
            } catch {
              // Skip files with invalid meta
            }
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(workspaceDir);
  return participants;
}

export {
  ensureDialogueFile,
  readDialogueFile,
  saveDialogueFile,
  getSceneParticipants,
  getSceneById,
  sanitizeFileName,
  generateDialogueHtml,
};