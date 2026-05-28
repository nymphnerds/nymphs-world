import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as fileService from '../services/fileService.js';
import * as tagService from '../services/tagService.js';
import * as locationService from '../services/locationService.js';
import * as templateService from '../services/templateService.js';
import { getUserAssetsDir } from '../services/authService.js';

const router = express.Router();

// Configure multer with memory storage so req.body (including folder) is available after parsing
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const mimeType = allowedTypes.test(file.mimetype);
    cb(mimeType ? null : new Error('Only image files are allowed'), mimeType);
  }
});

// GET /api/files?path=quests/main (includes tags on files)
router.get('/', (req, res) => {
  try {
    const username = req.user.username;
    const dirPath = req.query.path || '';
    const items = tagService.listDirectoryWithTags(username, dirPath);
    res.json({ items });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/content?path=quests/main/quest1.md
router.get('/content', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const content = fileService.readFile(username, filePath);
    res.json({ path: filePath, content });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files - create file or folder
router.post('/', (req, res) => {
  try {
    const username = req.user.username;
    const { path: itemPath, type, content, name } = req.body;
    if (!itemPath || !type) {
      return res.status(400).json({ error: 'Path and type are required' });
    }

    if (type === 'folder') {
      fileService.createFolder(username, itemPath);
    } else if (type === 'file') {
      fileService.writeFile(username, itemPath, content || '');
    } else {
      return res.status(400).json({ error: 'Type must be file or folder' });
    }

    res.json({ success: true, path: itemPath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/files - update file content
router.put('/', (req, res) => {
  try {
    const username = req.user.username;
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    fileService.writeFile(username, filePath, content);
    res.json({ success: true, path: filePath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/files?path=quests/main/quest1.md
router.delete('/', (req, res) => {
  try {
    const username = req.user.username;
    const itemPath = req.query.path;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    fileService.deleteItem(username, itemPath);
    res.json({ success: true, path: itemPath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/rename - rename file or folder
router.post('/rename', (req, res) => {
  try {
    const username = req.user.username;
    const { path: oldPath, name: newName } = req.body;
    if (!oldPath || !newName) {
      return res.status(400).json({ error: 'Path and new name are required' });
    }
    fileService.renameItem(username, oldPath, newName);
    res.json({ success: true, oldPath, newName });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/copy - copy file (adds -copy suffix, or copies to destFolder)
router.post('/copy', (req, res) => {
  try {
    const username = req.user.username;
    const { path: sourcePath, destFolder } = req.body;
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path is required' });
    }
    const result = fileService.copyItem(username, sourcePath, destFolder);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/move - move file to destination folder
router.post('/move', (req, res) => {
  try {
    const username = req.user.username;
    const { path: sourcePath, destFolder } = req.body;
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path is required' });
    }
    if (!destFolder && destFolder !== '') {
      return res.status(400).json({ error: 'Destination folder is required' });
    }
    const result = fileService.moveItem(username, sourcePath, destFolder);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/upload-file - upload any file to workspace folder (no image restrictions)
const genericUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB for general files
});

router.post('/upload-file', (req, res) => {
  try {
    const username = req.user.username;

    const handleUpload = genericUpload.single('file');
    handleUpload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      // Read folder AFTER multer parses the FormData (req.body is populated here)
      const folder = req.body.folder || '';
      const fileInfo = fileService.saveUploadedFile(username, req.file.buffer, req.file.originalname, folder);
      res.json({
        success: true,
        path: fileInfo.relativePath,
        name: fileInfo.name
      });
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/upload - upload image (accepts optional "folder" body param)
// Uses memoryStorage so req.body.folder is available after multer finishes parsing
router.post('/upload', (req, res) => {
  try {
    const username = req.user.username;
    const folder = req.body.folder || '';
    
    const handleUpload = memoryUpload.single('image');
    handleUpload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      // req.body.folder is now reliably available after multer completes
      const imageInfo = fileService.saveImageFromBuffer(username, req.file.buffer, req.file.originalname, folder, req.file.mimetype);
      res.json({
        success: true,
        path: imageInfo.relativePath,
        url: imageInfo.url
      });
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/images/* - serve uploaded image from assets directory (supports nested paths)
router.get('/images/*', (req, res) => {
  try {
    const username = req.user.username;
    // req.params[0] contains everything after /api/files/images/
    const pathStr = req.params[0];
    const pathSegments = pathStr.split('/').map(seg => decodeURIComponent(seg)).filter(Boolean);
    
    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'Image path required' });
    }
    
    const safePath = fileService.getImageFullPath(username, pathSegments);
    
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.sendFile(safePath);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/search?q=hello&limit=50
router.get('/search', (req, res) => {
  try {
    const username = req.user.username;
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit, 10) || 50;
    if (!query || !query.trim()) {
      return res.json({ results: [], total: 0 });
    }
    const result = fileService.searchWorkspace(username, query.trim(), { limit });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== TAG ROUTES =====

// GET /api/tags - list all registered tags
router.get('/tags', (req, res) => {
  try {
    const tags = tagService.getAllTags();
    res.json({ tags });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/tags - create a new tag
router.post('/tags', (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    const tag = tagService.createTag(name, color, description);
    res.json({ success: true, tag });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/tags/:id - update a tag
router.patch('/tags/:id', (req, res) => {
  try {
    const { name, color, description } = req.body;
    const tag = tagService.updateTag(req.params.id, { name, color, description });
    res.json({ success: true, tag });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/tags/:id - delete a tag
router.delete('/tags/:id', (req, res) => {
  try {
    const result = tagService.deleteTag(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/by-tag/:tagName - list all files with a specific tag
router.get('/by-tag/:tagName', (req, res) => {
  try {
    const username = req.user.username;
    const files = tagService.getFilesByTag(username, req.params.tagName);
    res.json({ files, tag: req.params.tagName });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/:path/tags - get tags for a file
router.get('/file-tags/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const tags = tagService.getFileTags(username, filePath);
    res.json({ path: filePath, tags });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/:path/tags - add tag(s) to a file
router.post('/file-tags/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const { tags } = req.body;
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags array is required' });
    }
    const result = tagService.addTagsToFile(username, filePath, tags);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/files/:path/tags/:tagName - remove tag from a file
router.delete('/file-tags/:path(*)/tags/:tagName', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const tagName = req.params.tagName;
    const result = tagService.removeTagFromFile(username, filePath, tagName);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/files/:path/tags - set tags on a file (replace all)
router.put('/file-tags/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const { tags } = req.body;
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags array is required' });
    }
    const result = tagService.setFileTags(username, filePath, tags);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/:path/relationships - get relationships for a file
router.get('/relationships/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const result = tagService.getFileRelationships(username, filePath);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== LOCATION ROUTES =====

// GET /api/locations - list all registered locations
router.get('/locations', (req, res) => {
  try {
    const username = req.user.username;
    const locations = locationService.getAllLocations(username);
    res.json({ locations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/locations - create a new location
router.post('/locations', (req, res) => {
  try {
    const username = req.user.username;
    const { name, color, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const location = locationService.createLocation(username, name, color, description);
    res.json({ success: true, location });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/locations/:id - update a location
router.patch('/locations/:id', (req, res) => {
  try {
    const username = req.user.username;
    const { name, color, description } = req.body;
    const location = locationService.updateLocation(username, req.params.id, { name, color, description });
    res.json({ success: true, location });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/locations/:id - delete a location
router.delete('/locations/:id', (req, res) => {
  try {
    const username = req.user.username;
    const result = locationService.deleteLocation(username, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/by-location/:locationName - list all files with a specific location
router.get('/by-location/:locationName', (req, res) => {
  try {
    const username = req.user.username;
    const files = locationService.getFilesByLocation(username, req.params.locationName);
    res.json({ files, location: req.params.locationName });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/:path/locations - get locations for a file
router.get('/file-locations/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const locations = locationService.getFileLocations(username, filePath);
    res.json({ path: filePath, locations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/:path/locations - add location(s) to a file
router.post('/file-locations/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const { locations } = req.body;
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'Locations array is required' });
    }
    const result = locationService.addLocationsToFile(username, filePath, locations);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/files/:path/locations/:locationName - remove location from a file
router.delete('/file-locations/:path(*)/locations/:locationName', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const locationName = req.params.locationName;
    const result = locationService.removeLocationFromFile(username, filePath, locationName);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/files/:path/locations - set locations on a file (replace all)
router.put('/file-locations/:path(*)', (req, res) => {
  try {
    const username = req.user.username;
    const filePath = req.params.path;
    const { locations } = req.body;
    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({ error: 'Locations array is required' });
    }
    const result = locationService.setFileLocations(username, filePath, locations);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== PROFILE ROUTES =====

// GET /api/files/profile - detect and return current profile
router.get('/profile', (req, res) => {
  try {
    const username = req.user.username;
    const profiles = fileService.getWorkspaceProfiles();
    const currentProfile = fileService.detectProfile(username);
    // Return null if no profile detected so client knows user hasn't chosen yet
    res.json({
      profile: currentProfile,
      profiles: Object.entries(profiles).map(([key, val]) => ({
        key,
        label: val.label,
        description: val.description,
        folders: val.folders,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/files/profile - apply/switch workspace profile (merge)
router.post('/profile', (req, res) => {
  try {
    const username = req.user.username;
    const { profile } = req.body;
    if (!profile || (profile !== 'game' && profile !== 'work')) {
      return res.status(400).json({ error: 'Profile must be "game" or "work"' });
    }
    const result = fileService.applyProfile(username, profile);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== TEMPLATE ROUTES =====

// GET /api/files/templates - list available templates
router.get('/templates', (req, res) => {
  try {
    const templates = templateService.getAvailableTemplates(req.query.profile);
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/files/template - create file from template
router.post('/template', (req, res) => {
  try {
    const username = req.user.username;
    const { template, name, folder } = req.body;
    if (!template) {
      return res.status(400).json({ error: 'Template key is required' });
    }
    const result = templateService.createFromTemplate(username, template, name, folder);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/compile - compile story bible
router.post('/compile', (req, res) => {
  try {
    const username = req.user.username;
    const {
      files,
      folders,
      entireWorkspace,
      title,
      includeTableOfContents,
      includeSectionDividers,
      includeFilePaths,
      excludeMarginNotes,
      orderBy,
    } = req.body;

    const content = templateService.compileStoryBible(username, {
      files,
      folders,
      entireWorkspace,
      title,
      includeTableOfContents,
      includeSectionDividers,
      includeFilePaths,
      excludeMarginNotes,
      orderBy,
    });

    // Save the compiled bible to /Story Bibles/ folder
    const safeTitle = (title || 'Story Bible').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const fileName = `${safeTitle}.html`;
    const biblePath = path.join('Story Bibles', fileName).replace(/\\/g, '/');
    fileService.writeFile(username, biblePath, content);

    const fullPath = fileService.getSafePath(username, biblePath);
    const totalSize = fs.statSync(fullPath).size;

    res.json({
      path: biblePath,
      content,
      documentCount: (files || []).length + (folders || []).length,
      totalSize,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== WIKILINK ROUTES =====

// Helper: recursively list all .html files in workspace (excluding assets/)
function listHtmlFiles(username) {
  const workspaceDir = fileService.getSafePath(username, '');
  const results = [];

  function scan(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Skip assets/ directories
        const relPath = path.relative(workspaceDir, fullPath);
        if (relPath.startsWith('assets') || entry.name === 'assets') continue;

        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          const rel = path.relative(workspaceDir, fullPath).replace(/\\/g, '/');
          const nameWithoutExt = entry.name.replace(/\.html$/i, '');
          results.push({
            name: nameWithoutExt,
            nameLower: nameWithoutExt.toLowerCase(),
            path: rel,
            folder: path.dirname(rel) + '/'
          });
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  scan(workspaceDir);
  return results;
}

// GET /api/files/resolve-wikilink?name=Goblin+King
router.get('/resolve-wikilink', (req, res) => {
  try {
    const username = req.user.username;
    const name = req.query.name;
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    const nameLower = name.toLowerCase().trim();
    const htmlFiles = listHtmlFiles(username);
    const match = htmlFiles.find(f => f.nameLower === nameLower);

    if (match) {
      // Read first ~100 chars of content for preview
      let contentPreview = '';
      try {
        const content = fileService.readFile(username, match.path);
        // Strip HTML tags for preview
        const textOnly = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        contentPreview = textOnly.substring(0, 100);
      } catch {
        // Preview unavailable
      }

      return res.json({
        exists: true,
        filePath: match.path,
        contentPreview
      });
    } else {
      // Suggest path based on current folder (empty root by default)
      const suggestedName = name.trim().replace(/[\\/:*?"<>|]/g, '');
      return res.json({
        exists: false,
        suggestedPath: `${suggestedName}.html`
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/wikilink-search?q=goblin&limit=10
router.get('/wikilink-search', (req, res) => {
  try {
    const username = req.user.username;
    const query = (req.query.q || '').toLowerCase().trim();
    const limit = parseInt(req.query.limit, 10) || 10;

    const htmlFiles = listHtmlFiles(username);
    let results = htmlFiles;

    if (query) {
      results = results.filter(f => f.nameLower.includes(query));
    }

    // Deduplicate by nameLower (keep first match)
    const seen = new Set();
    results = results.filter(f => {
      if (seen.has(f.nameLower)) return false;
      seen.add(f.nameLower);
      return true;
    });

    const sliced = results.slice(0, limit).map(f => ({
      name: f.name,
      path: f.path,
      folder: f.folder === '/' ? '' : f.folder
    }));

    res.json({ results: sliced });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/backlinks?path=Quests%2FGoblin+King.html
router.get('/backlinks', (req, res) => {
  try {
    const username = req.user.username;
    const targetPath = req.query.path;
    if (!targetPath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // Extract the document name from the path
    const targetName = path.basename(targetPath, '.html');
    const targetNameLower = targetName.toLowerCase();
    const searchPattern = `[[${targetName}]]`;

    const workspaceDir = fileService.getSafePath(username, '');
    const backlinks = [];

    function scan(dir) {
      try {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(workspaceDir, fullPath).replace(/\\/g, '/');

          // Skip assets
          if (relPath.startsWith('assets') || entry.name === 'assets') continue;

          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.html')) {
            // Skip the file itself
            if (relPath.toLowerCase() === targetPath.toLowerCase()) continue;

            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              // Case-insensitive search for [[Target Name]]
              const regex = new RegExp(`\\[\\[([^\\]]*${targetNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*)\\]\\]`, 'gi');
              let m;
              while ((m = regex.exec(content)) !== null) {
                // Extract snippet around the match
                const snippetStart = Math.max(0, m.index - 30);
                const snippetEnd = Math.min(content.length, m.index + m[0].length + 30);
                let snippet = content.substring(snippetStart, snippetEnd).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                if (snippetStart > 0) snippet = '...' + snippet;
                if (snippetEnd < content.length) snippet = snippet + '...';

                backlinks.push({
                  filePath: relPath,
                  snippet,
                  lineApprox: content.substring(0, m.index).split('\n').length
                });
                break; // One entry per file
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }

    scan(workspaceDir);

    res.json({ backlinks });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== USER RECENTS/STARRED ROUTES =====

// GET /api/user/recents - load user's recent files from server
router.get('/user/recents', (req, res) => {
  try {
    const username = req.user.username;
    console.log(`[Recents] GET /user/recents for user: ${username}`);
    const recents = fileService.loadUserRecents(username);
    console.log(`[Recents] Loaded ${recents.length} recent files for ${username}:`, recents.map(r => r.path));
    res.json({ recents });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/user/recents - save user's recent files to server
router.put('/user/recents', (req, res) => {
  try {
    const username = req.user.username;
    const { recents } = req.body;
    if (!Array.isArray(recents)) {
      return res.status(400).json({ error: 'Recents array is required' });
    }
    console.log(`[Recents] PUT /user/recents for user: ${username}, count: ${recents.length}`);
    fileService.saveUserRecents(username, recents);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/user/starred - load user's starred files from server
router.get('/user/starred', (req, res) => {
  try {
    const username = req.user.username;
    console.log(`[Starred] GET /user/starred for user: ${username}`);
    const starred = fileService.loadUserStarred(username);
    console.log(`[Starred] Loaded ${starred.length} starred files for ${username}:`, starred.map(s => s.path));
    res.json({ starred });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/user/starred - save user's starred files to server
router.put('/user/starred', (req, res) => {
  try {
    const username = req.user.username;
    const { starred } = req.body;
    if (!Array.isArray(starred)) {
      return res.status(400).json({ error: 'Starred array is required' });
    }
    console.log(`[Starred] PUT /user/starred for user: ${username}, count: ${starred.length}`);
    fileService.saveUserStarred(username, starred);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/workspace/* - serve any file from the user's workspace directory
router.get('/workspace/*', (req, res) => {
  try {
    const username = req.user.username;
    const pathStr = req.params[0];
    const pathSegments = pathStr.split('/').map(seg => decodeURIComponent(seg)).filter(Boolean);
    
    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const safePath = fileService.getSafeWorkspaceFilePath(username, pathSegments);
    
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Don't serve directories
    if (fs.statSync(safePath).isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }
    
    res.sendFile(safePath);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
