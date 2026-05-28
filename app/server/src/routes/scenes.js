import express from 'express';
import {
  getAllScenes,
  createScene,
  updateScene,
  deleteScene,
  getFileScenes,
  addScenesToFile,
  removeSceneFromFile,
} from '../services/sceneService.js';

const router = express.Router();

// GET /api/scenes - Get all workspace scenes
router.get('/scenes', (req, res) => {
  try {
    const scenes = getAllScenes(req.user.username);
    res.json({ scenes });
  } catch (error) {
    console.error('[scenes] Error fetching scenes:', error);
    res.status(500).json({ error: 'Failed to fetch scenes' });
  }
});

// POST /api/scenes - Create a new scene
router.post('/scenes', (req, res) => {
  try {
    const { name, era, date, locationName } = req.body;
    const scene = createScene(req.user.username, name, era, date, locationName);
    res.json({ scene });
  } catch (error) {
    console.error('[scenes] Error creating scene:', error);
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/scenes/:id - Update a scene
router.put('/scenes/:id', (req, res) => {
  try {
    const scene = updateScene(req.user.username, req.params.id, req.body);
    res.json({ scene });
  } catch (error) {
    console.error('[scenes] Error updating scene:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/scenes/:id - Delete a scene
router.delete('/scenes/:id', (req, res) => {
  try {
    const result = deleteScene(req.user.username, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[scenes] Error deleting scene:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

// GET /api/scenes/file/:filePath(*) - Get scenes assigned to a file
router.get('/scenes/file/:filePath(*)', (req, res) => {
  try {
    const filePath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : req.params.filePath;
    const sceneIds = getFileScenes(req.user.username, filePath);
    res.json({ scenes: sceneIds });
  } catch (error) {
    console.error('[scenes] Error fetching file scenes:', error);
    res.status(500).json({ error: 'Failed to fetch file scenes' });
  }
});

// POST /api/scenes/assign - Assign scenes to a file (filePath in body)
router.post('/scenes/assign', (req, res) => {
  try {
    const { filePath, sceneIds } = req.body;
    console.log('[scenes] Assign request:', { filePath, sceneIds, user: req.user.username });
    if (!filePath || !sceneIds || !Array.isArray(sceneIds)) {
      return res.status(400).json({ error: 'filePath and sceneIds array required' });
    }
    const result = addScenesToFile(req.user.username, filePath, sceneIds);
    console.log('[scenes] Assign result:', result);
    res.json(result);
  } catch (error) {
    console.error('[scenes] Error assigning scenes:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/scenes/file/:filePath*/:sceneId - Remove scene from file
router.delete('/scenes/file/:filePath*/:sceneId', (req, res) => {
  try {
    const filePath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : req.params.filePath;
    const { sceneId } = req.params;
    console.log('[scenes] Remove request:', { filePath, sceneId, user: req.user.username });
    const result = removeSceneFromFile(req.user.username, filePath, sceneId);
    console.log('[scenes] Remove result:', result);
    res.json(result);
  } catch (error) {
    console.error('[scenes] Error removing scene from file:', error);
    res.status(500).json({ error: 'Failed to remove scene from file' });
  }
});

export default router;