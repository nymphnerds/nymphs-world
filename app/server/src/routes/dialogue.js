import express from 'express';
import {
  ensureDialogueFile,
  readDialogueFile,
  saveDialogueFile,
  getSceneParticipants,
} from '../services/dialogueService.js';

const router = express.Router();

// All routes require auth (handled by middleware mounted in index.js)

// POST /api/dialogue/:sceneId/ensure
// Ensure Dialogue/ folder and file exist for the scene
// Returns: { path, existed }
router.post('/:sceneId/ensure', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const result = await ensureDialogueFile(req.user.username, sceneId);
    res.json(result);
  } catch (error) {
    console.error('[dialogue] Ensure failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to ensure dialogue file' });
  }
});

// GET /api/dialogue/:sceneId
// Read dialogue HTML for a scene
// Returns: { html, path, participants }
router.get('/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { html, path: filePath } = await readDialogueFile(req.user.username, sceneId);
    const participants = getSceneParticipants(req.user.username, sceneId);
    res.json({ html, path: filePath, participants });
  } catch (error) {
    console.error('[dialogue] Read failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to read dialogue file' });
  }
});

// POST /api/dialogue/:sceneId
// Save dialogue HTML for a scene
// Body: { html }
// Returns: { path }
router.post('/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'html content required' });
    }

    const result = await saveDialogueFile(req.user.username, sceneId, html);
    res.json(result);
  } catch (error) {
    console.error('[dialogue] Save failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save dialogue file' });
  }
});

export default router;