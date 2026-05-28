import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir, getUserAssetsDir } from './authService.js';
import { assertInsideRoot, normalizeRelativePath, safeJoin, safeLeafName, toPosixRelative } from './pathSafety.js';
import { PROJECT_MANIFEST_FILE } from './projectService.js';

// Workspace profile definitions
const workspaceProfiles = {
  game: {
    label: 'Game',
    description: 'Story writing and world-building',
    folders: [
      'MainStory',
      'Quests',
      'PlayerCharacters',
      'NPCs',
      'Locations',
      'Factions',
      'Items',
      'Scenes',
      'Lore',
      'Maps',
      'Biomes',
      'Data',
      'Assets',
      'Production',
      '_system',
    ],
  },
  work: {
    label: 'Work',
    description: 'Business management and client work',
    folders: ['Customers', 'Jobs', 'Bookings', 'Quotes'],
  },
};

// Default profile (used when no profile is set)
const defaultProfile = 'game';

// Get profile config
function getWorkspaceProfiles() {
  return workspaceProfiles;
}

// Get a specific profile
function getProfile(profileKey) {
  return workspaceProfiles[profileKey] || null;
}

// Detect current profile based on which folders exist in workspace
function detectProfile(username) {
  const workspaceRoot = getUserWorkspaceDir(username);
  if (!fs.existsSync(workspaceRoot)) {
    return null;
  }

  const dirs = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  const folderNames = dirs.filter(d => d.isDirectory()).map(d => d.name);

  const hasGame = workspaceProfiles.game.folders.some(f => folderNames.includes(f));
  const hasWork = workspaceProfiles.work.folders.some(f => folderNames.includes(f));

  if (hasWork && !hasGame) return 'work';
  if (hasGame && !hasWork) return 'game';
  if (hasGame && hasWork) return 'game'; // default to game if both exist
  return null;
}

// Apply a profile — merge folders from the selected profile (never deletes)
function applyProfile(username, profileKey) {
  const profile = workspaceProfiles[profileKey];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileKey}`);
  }

  const workspaceRoot = getUserWorkspaceDir(username);
  if (!fs.existsSync(workspaceRoot)) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  // Create missing folders from the profile
  for (const dir of profile.folders) {
    const fullPath = path.join(workspaceRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  return { success: true, profile: profileKey, folders: profile.folders };
}

// Default directory structure for new users (legacy — kept for backward compat)
const initDirs = [
  'MainStory',
  'Quests',
  'PlayerCharacters',
  'NPCs',
  'Locations',
  'Factions',
  'Items',
  'Scenes',
  'Lore',
  'Maps',
  'Biomes',
  'Data',
  'Assets',
  'Production',
  '_system',
];

// Initialize workspace directories for a user
function initializeUserDirs(username, profileKey = defaultProfile) {
  const workspaceRoot = getUserWorkspaceDir(username);
  const assetsRoot = getUserAssetsDir(username);
  
  // Ensure base dirs exist
  if (!fs.existsSync(workspaceRoot)) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }
  if (!fs.existsSync(assetsRoot)) {
    fs.mkdirSync(assetsRoot, { recursive: true });
  }

  // Use profile folders or fall back to initDirs (empty array when profileKey is null)
  const profile = profileKey ? workspaceProfiles[profileKey] : null;
  const dirsToCreate = profile ? profile.folders : (profileKey === null ? [] : initDirs);
  
  // Create default structure
  for (const dir of dirsToCreate) {
    const fullPath = path.join(workspaceRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

// Get safe path within user's workspace
function getSafePath(username, relPath) {
  return safeJoin(getUserWorkspaceDir(username), relPath || '');
}

// Get safe path for images within user's assets
function getSafeImagePath(username, imageName) {
  return safeJoin(getUserAssetsDir(username), imageName);
}

// List files/folders in a directory
function listDirectory(username, dirPath = '') {
  const fullPath = getSafePath(username, dirPath);
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  return entries
    .filter(entry => !entry.name.startsWith('.') && entry.name !== PROJECT_MANIFEST_FILE)  // Hide app metadata.
    .map(entry => {
      const itemPath = path.join(dirPath, entry.name);
      const fullItemPath = path.join(fullPath, entry.name);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        path: itemPath,
        size: entry.isFile() ? fs.statSync(fullItemPath).size : undefined,
        modified: entry.isFile() ? fs.statSync(fullItemPath).mtime.toISOString() : undefined
      };
    });
}

// Read file content
function readFile(username, filePath) {
  const fullPath = getSafePath(username, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found');
  }
  if (fs.statSync(fullPath).isDirectory()) {
    throw new Error('Path is a directory');
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

// Write file content
function writeFile(username, filePath, content) {
  const fullPath = getSafePath(username, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
}

// Create folder
function createFolder(username, folderPath) {
  const fullPath = getSafePath(username, folderPath);
  if (fs.existsSync(fullPath)) {
    throw new Error('Folder already exists');
  }
  fs.mkdirSync(fullPath, { recursive: true });
}

// Delete file or folder
function deleteItem(username, itemPath) {
  const fullPath = getSafePath(username, itemPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Item not found');
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(fullPath);
  }
}

// Rename/move file or folder
function renameItem(username, oldPath, newName) {
  const fullOldPath = getSafePath(username, oldPath);
  if (!fs.existsSync(fullOldPath)) {
    throw new Error('Item not found');
  }
  const safeNewName = safeLeafName(newName, 'new_name');
  const parentDir = path.dirname(fullOldPath);
  const fullNewPath = assertInsideRoot(getUserWorkspaceDir(username), path.join(parentDir, safeNewName));
  if (fs.existsSync(fullNewPath)) {
    throw new Error('A file or folder with that name already exists');
  }
  fs.renameSync(fullOldPath, fullNewPath);
}

// Copy file to a destination folder. If destFolder is omitted, copies to the same parent folder with "-copy" suffix.
function copyItem(username, sourcePath, destFolder = '') {
  const fullSourcePath = getSafePath(username, sourcePath);
  if (!fs.existsSync(fullSourcePath)) {
    throw new Error('Source file not found');
  }
  if (fs.statSync(fullSourcePath).isDirectory()) {
    throw new Error('Only files can be copied (folder copy not supported)');
  }

  const sourceRelPath = normalizeRelativePath(sourcePath);
  const fileName = safeLeafName(path.posix.basename(sourceRelPath), 'file_name');
  const nameWithoutExt = path.basename(fileName, path.extname(fileName));
  const ext = path.extname(fileName);
  const copyName = `${nameWithoutExt}-copy${ext}`;

  // Determine destination: if destFolder provided, use it; otherwise use source parent folder
  const destBase = destFolder
    ? getSafePath(username, destFolder)
    : path.dirname(fullSourcePath);

  const fullDestPath = path.join(destBase, copyName);
  const normalizedDest = assertInsideRoot(getUserWorkspaceDir(username), fullDestPath);

  if (fs.existsSync(normalizedDest)) {
    throw new Error(`A file named "${copyName}" already exists in the destination`);
  }

  // Ensure destination directory exists
  const destDir = path.dirname(normalizedDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read source and write to destination
  const content = fs.readFileSync(fullSourcePath);
  fs.writeFileSync(normalizedDest, content);

  // Build relative path from workspace root
  const workspaceRoot = getUserWorkspaceDir(username);
  const relativeDest = toPosixRelative(workspaceRoot, normalizedDest);

  return {
    sourcePath,
    destPath: relativeDest,
    destName: copyName
  };
}

// Move file to a destination folder
function moveItem(username, sourcePath, destFolder) {
  if (!destFolder && destFolder !== '') {
    throw new Error('Destination folder is required');
  }

  const fullSourcePath = getSafePath(username, sourcePath);
  if (!fs.existsSync(fullSourcePath)) {
    throw new Error('Source file not found');
  }
  if (fs.statSync(fullSourcePath).isDirectory()) {
    throw new Error('Only files can be moved (folder move not supported)');
  }

  const sourceRelPath = normalizeRelativePath(sourcePath);
  const fileName = safeLeafName(path.posix.basename(sourceRelPath), 'file_name');
  const destBase = getSafePath(username, destFolder);
  const fullDestPath = path.join(destBase, fileName);
  const normalizedDest = assertInsideRoot(getUserWorkspaceDir(username), fullDestPath);

  if (fs.existsSync(normalizedDest)) {
    throw new Error(`A file named "${fileName}" already exists in the destination folder`);
  }

  // Ensure destination directory exists
  if (!fs.existsSync(destBase)) {
    fs.mkdirSync(destBase, { recursive: true });
  }

  fs.renameSync(fullSourcePath, normalizedDest);

  // Build relative path from workspace root
  const workspaceRoot = getUserWorkspaceDir(username);
  const relativeDest = toPosixRelative(workspaceRoot, normalizedDest);

  return {
    sourcePath,
    destPath: relativeDest,
    destFolder
  };
}

// Save uploaded image to a specific folder within the user's workspace
function saveImage(username, file, folderPath = '') {
  const assetsRoot = getUserAssetsDir(username);
  const safeFilename = safeLeafName(file.filename, 'filename');
  // Create subdirectory structure: assets/{folderPath}/
  const targetDir = safeJoin(assetsRoot, folderPath || '');
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const fullPath = assertInsideRoot(assetsRoot, path.join(targetDir, safeFilename));
  
  // Build relative path from assets root for URL routing
  const relativeFromAssets = toPosixRelative(assetsRoot, fullPath);
  const urlPath = folderPath
    ? `/api/files/images/${encodeURIComponent(normalizeRelativePath(folderPath))}/${encodeURIComponent(safeFilename)}`
    : `/api/files/images/${encodeURIComponent(safeFilename)}`;
  
  return {
    fullPath,
    relativePath: relativeFromAssets,
    url: urlPath
  };
}

// Save uploaded image from buffer (memoryStorage) to a specific folder within the user's workspace
function saveImageFromBuffer(username, buffer, originalname, folderPath = '', mimeType = '') {
  const assetsRoot = getUserAssetsDir(username);
  const originalName = safeLeafName(originalname || 'image', 'filename');
  
  // Generate unique filename
  const ext = path.extname(originalName) || (mimeType ? '.' + mimeType.split('/')[1] : '');
  const baseName = path.basename(originalName, ext);
  const uniqueName = `${baseName}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  
  // Create subdirectory structure: assets/{folderPath}/
  const targetDir = safeJoin(assetsRoot, folderPath || '');
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const fullPath = assertInsideRoot(assetsRoot, path.join(targetDir, uniqueName));
  
  // Write the buffer to the correct folder path
  fs.writeFileSync(fullPath, buffer);
  
  // Build URL with folder path for routing
  const urlPath = folderPath
    ? `/api/files/images/${encodeURIComponent(folderPath)}/${encodeURIComponent(uniqueName)}`
    : `/api/files/images/${encodeURIComponent(uniqueName)}`;
  
  // Build relative path from assets root
  const relativeFromAssets = toPosixRelative(assetsRoot, fullPath);
  
  return {
    fullPath,
    relativePath: relativeFromAssets,
    url: urlPath
  };
}

// Save arbitrary uploaded file to the user's workspace folder
function saveUploadedFile(username, buffer, originalname, folderPath = '') {
  const workspaceRoot = getUserWorkspaceDir(username);
  
  // Determine target directory
  const targetDir = safeJoin(workspaceRoot, folderPath || '');
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Sanitize filename to prevent path traversal
  const safeFilename = safeLeafName(path.posix.basename(String(originalname || '').replace(/\\/g, '/')), 'filename');
  const fullPath = assertInsideRoot(workspaceRoot, path.join(targetDir, safeFilename));
  
  fs.writeFileSync(fullPath, buffer);
  
  // Build relative path from workspace root
  const relativeFromWorkspace = toPosixRelative(workspaceRoot, fullPath);
  
  return {
    fullPath,
    relativePath: relativeFromWorkspace,
    name: safeFilename
  };
}

// Get full path for serving an image by decoded path segments
function getImageFullPath(username, pathSegments) {
  return safeJoin(getUserAssetsDir(username), ...(pathSegments || []));
}

// Get safe full path for serving any file from workspace by decoded path segments
function getSafeWorkspaceFilePath(username, pathSegments) {
  return safeJoin(getUserWorkspaceDir(username), ...(pathSegments || []));
}

// Binary file extensions to skip when searching
const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'mp3', 'mp4', 'avi', 'mov', 'wmv',
  'exe', 'dll', 'so', 'dylib',
  'docx', 'xlsx', 'pptx',
]);

function isBinaryFile(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return BINARY_EXTENSIONS.has(ext);
}

// Search workspace recursively for query in file names and contents
// Returns array of { name, path, matches: [{ line, context }] }
function searchWorkspace(username, query, options = {}) {
  const { limit = 50 } = options;
  const workspaceRoot = getUserWorkspaceDir(username);
  
  if (!fs.existsSync(workspaceRoot)) {
    return { results: [], total: 0 };
  }

  const q = query.toLowerCase();
  const results = [];

  function walkDir(dirPath) {
    if (results.length >= limit) return;
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= limit) break;
        
        const fullEntryPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(workspaceRoot, fullEntryPath);

        // Skip dotfiles & dotdirs (hidden system files like .wbu_recents.json)
        if (entry.name.startsWith('.')) {
          if (entry.isDirectory()) {
            // Still walk into non-dot subdirectories of dotdirs — skip entirely
          }
          continue;
        }

        // Skip system-generated metadata files
        if (entry.name.endsWith('.wbu_meta.json')) {
          continue;
        }

        if (entry.isDirectory()) {
          walkDir(fullEntryPath);
        } else if (entry.isFile() && !isBinaryFile(entry.name)) {
          // Check name match
          const nameMatch = entry.name.toLowerCase().includes(q);
          
          if (nameMatch) {
            results.push({
              name: entry.name,
              path: relativePath,
              type: 'file',
              matches: [{ line: 0, context: `Name matches: "${entry.name}"` }],
            });
            continue;
          }

          // Check content match (only text files)
          try {
            const content = fs.readFileSync(fullEntryPath, 'utf-8');
            const lines = content.split('\n');
            const lineMatches = [];
            
            for (let i = 0; i < lines.length && lineMatches.length < 10; i++) {
              if (lines[i].toLowerCase().includes(q)) {
                // Get context: up to 80 chars around match
                const line = lines[i];
                const idx = line.toLowerCase().indexOf(q);
                const start = Math.max(0, idx - 30);
                const end = Math.min(line.length, idx + q.length + 30);
                let context = line.substring(start, end).trim();
                if (start > 0) context = '...' + context;
                if (end < line.length) context = context + '...';
                
                lineMatches.push({
                  line: i + 1,
                  context,
                });
              }
            }
            
            if (lineMatches.length > 0) {
              results.push({
                name: entry.name,
                path: relativePath,
                type: 'file',
                matches: lineMatches,
              });
            }
          } catch (e) {
            // Skip files that can't be read as text
          }
        }
      }
    } catch (e) {
      // Skip directories that can't be read
    }
  }

  walkDir(workspaceRoot);
  
  return { results, total: results.length };
}

// Save user recents as hidden file in workspace
function saveUserRecents(username, data) {
  const fileName = '.wbu_recents.json';
  writeFile(username, fileName, JSON.stringify(data, null, 2));
}

// Load user recents from hidden file in workspace
function loadUserRecents(username) {
  try {
    const content = readFile(username, '.wbu_recents.json');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Save user starred files as hidden file in workspace
function saveUserStarred(username, data) {
  const fileName = '.wbu_starred.json';
  writeFile(username, fileName, JSON.stringify(data, null, 2));
}

// Load user starred files from hidden file in workspace
function loadUserStarred(username) {
  try {
    const content = readFile(username, '.wbu_starred.json');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export {
  getWorkspaceProfiles,
  getProfile,
  detectProfile,
  applyProfile,
  initializeUserDirs,
  listDirectory,
  readFile,
  writeFile,
  createFolder,
  deleteItem,
  renameItem,
  copyItem,
  moveItem,
  saveImage,
  saveImageFromBuffer,
  saveUploadedFile,
  getImageFullPath,
  getSafeWorkspaceFilePath,
  getSafePath,
  searchWorkspace,
  saveUserRecents,
  loadUserRecents,
  saveUserStarred,
  loadUserStarred
};
