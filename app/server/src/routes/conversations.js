import express from 'express';
import {
  getSceneParticipants,
  addSceneParticipant,
  removeSceneParticipant,
  getThreadsForScene,
  createThread,
  getThreadById,
  updateThread,
  deleteThread,
  addNode,
  updateNode,
  connectNode,
  deleteNode,
  addChoice,
  updateChoice,
  deleteChoice,
  getParticipantIdleLines,
  addParticipantIdleLine,
  deleteParticipantIdleLine,
  getSceneBanter,
  addSceneBanterLine,
  deleteSceneBanterLine
} from '../services/conversationService.js';

const router = express.Router();

// All routes require auth (handled by middleware mounted in index.js)

// =============================================
// Scene Participants
// =============================================

// GET /api/conversations/:sceneId/participants
router.get('/:sceneId/participants', (req, res) => {
  try {
    const participants = getSceneParticipants(req.user.username, req.params.sceneId);
    res.json(participants);
  } catch (error) {
    console.error('[conversations] Get participants failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversations/:sceneId/participants
router.post('/:sceneId/participants', (req, res) => {
  try {
    const { entityPath, spawnX, spawnY } = req.body;
    const participant = addSceneParticipant(req.user.username, req.params.sceneId, { entityPath, spawnX, spawnY });
    res.status(201).json(participant);
  } catch (error) {
    console.error('[conversations] Add participant failed:', error);
    if (error.message.includes('already assigned')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/participants/:entityPath
router.delete('/:sceneId/participants/:entityPath', (req, res) => {
  try {
    const result = removeSceneParticipant(req.user.username, req.params.sceneId, req.params.entityPath);
    res.json(result);
  } catch (error) {
    console.error('[conversations] Remove participant failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// Conversation Threads
// =============================================

// GET /api/conversations/:sceneId/threads
router.get('/:sceneId/threads', (req, res) => {
  try {
    const threads = getThreadsForScene(req.user.username, req.params.sceneId);
    res.json(threads);
  } catch (error) {
    console.error('[conversations] Get threads failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversations/:sceneId/threads
router.post('/:sceneId/threads', (req, res) => {
  try {
    const { type, participants, proximityRadius, title } = req.body;
    const thread = createThread(req.user.username, req.params.sceneId, { type, participants, proximityRadius, title });
    res.status(201).json(thread);
  } catch (error) {
    console.error('[conversations] Create thread failed:', error);
    if (error.message.includes('not assigned')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// GET /api/conversations/threads/:threadId
router.get('/threads/:threadId', (req, res) => {
  try {
    // Need sceneId from the thread - look it up by searching
    const { sceneId } = req.query;
    if (!sceneId) {
      return res.status(400).json({ error: 'sceneId query parameter required' });
    }
    const thread = getThreadById(req.user.username, sceneId, req.params.threadId);
    res.json(thread);
  } catch (error) {
    console.error('[conversations] Get thread failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/conversations/:sceneId/threads/:threadId
router.put('/:sceneId/threads/:threadId', (req, res) => {
  try {
    const thread = updateThread(req.user.username, req.params.sceneId, req.params.threadId, req.body);
    res.json(thread);
  } catch (error) {
    console.error('[conversations] Update thread failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/threads/:threadId
router.delete('/:sceneId/threads/:threadId', (req, res) => {
  try {
    const result = deleteThread(req.user.username, req.params.sceneId, req.params.threadId);
    res.json(result);
  } catch (error) {
    console.error('[conversations] Delete thread failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// Conversation Nodes
// =============================================

// POST /api/conversations/:sceneId/nodes
router.post('/:sceneId/nodes', (req, res) => {
  try {
    const { threadId, speakerPath, speech, action, alignment, x, y } = req.body;
    const node = addNode(req.user.username, req.params.sceneId, threadId, { speakerPath, speech, action, alignment, x, y });
    res.status(201).json(node);
  } catch (error) {
    console.error('[conversations] Add node failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/conversations/:sceneId/nodes/:nodeId
router.put('/:sceneId/nodes/:nodeId', (req, res) => {
  try {
    const node = updateNode(req.user.username, req.params.sceneId, req.params.nodeId, req.body);
    res.json(node);
  } catch (error) {
    console.error('[conversations] Update node failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/conversations/:sceneId/nodes/:nodeId/connect
router.patch('/:sceneId/nodes/:nodeId/connect', (req, res) => {
  try {
    const { nextNodeId } = req.body;
    const node = connectNode(req.user.username, req.params.sceneId, req.params.nodeId, { nextNodeId });
    res.json(node);
  } catch (error) {
    console.error('[conversations] Connect node failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/nodes/:nodeId
router.delete('/:sceneId/nodes/:nodeId', (req, res) => {
  try {
    const result = deleteNode(req.user.username, req.params.sceneId, req.params.nodeId);
    res.json(result);
  } catch (error) {
    console.error('[conversations] Delete node failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// Choice Nodes
// =============================================

// POST /api/conversations/:sceneId/choices
router.post('/:sceneId/choices', (req, res) => {
  try {
    const { nodeId, text, alignment, targetNodeId, targetThreadId, outcomes, conditions, sortIndex } = req.body;
    const choice = addChoice(req.user.username, req.params.sceneId, nodeId, { text, alignment, targetNodeId, targetThreadId, outcomes, conditions, sortIndex });
    res.status(201).json(choice);
  } catch (error) {
    console.error('[conversations] Add choice failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/conversations/:sceneId/choices/:choiceId
router.put('/:sceneId/choices/:choiceId', (req, res) => {
  try {
    const choice = updateChoice(req.user.username, req.params.sceneId, req.params.choiceId, req.body);
    res.json(choice);
  } catch (error) {
    console.error('[conversations] Update choice failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/choices/:choiceId
router.delete('/:sceneId/choices/:choiceId', (req, res) => {
  try {
    const result = deleteChoice(req.user.username, req.params.sceneId, req.params.choiceId);
    res.json(result);
  } catch (error) {
    console.error('[conversations] Delete choice failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// Participant Idle Lines (per-participant idle chatter)
// Using entityPath as query param since it can contain '/'
// =============================================

// GET /api/conversations/:sceneId/participants/idleLines?entityPath=...
router.get('/:sceneId/participants/idleLines', (req, res) => {
  try {
    const { entityPath } = req.query;
    if (!entityPath) return res.status(400).json({ error: 'entityPath query parameter required' });
    const lines = getParticipantIdleLines(
      req.user.username,
      req.params.sceneId,
      decodeURIComponent(entityPath)
    );
    res.json(lines);
  } catch (error) {
    console.error('[conversations] Get idle lines failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversations/:sceneId/participants/idleLines?entityPath=...
router.post('/:sceneId/participants/idleLines', (req, res) => {
  try {
    const { entityPath } = req.query;
    const { speech } = req.body;
    if (!entityPath) return res.status(400).json({ error: 'entityPath query parameter required' });
    const node = addParticipantIdleLine(
      req.user.username,
      req.params.sceneId,
      decodeURIComponent(entityPath),
      { speech }
    );
    res.status(201).json(node);
  } catch (error) {
    console.error('[conversations] Add idle line failed:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/idleLines/:nodeId
router.delete('/:sceneId/idleLines/:nodeId', (req, res) => {
  try {
    const result = deleteParticipantIdleLine(
      req.user.username,
      req.params.sceneId,
      req.params.nodeId
    );
    res.json(result);
  } catch (error) {
    console.error('[conversations] Delete idle line failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// Scene NPC Banter (shared across all participants)
// =============================================

// GET /api/conversations/:sceneId/banter
router.get('/:sceneId/banter', (req, res) => {
  try {
    const lines = getSceneBanter(
      req.user.username,
      req.params.sceneId
    );
    res.json(lines);
  } catch (error) {
    console.error('[conversations] Get banter failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversations/:sceneId/banter
router.post('/:sceneId/banter', (req, res) => {
  try {
    const { speakerPath, speech } = req.body;
    if (!speakerPath) return res.status(400).json({ error: 'speakerPath is required' });
    const node = addSceneBanterLine(
      req.user.username,
      req.params.sceneId,
      { speakerPath, speech }
    );
    res.status(201).json(node);
  } catch (error) {
    console.error('[conversations] Add banter line failed:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/conversations/:sceneId/banter/:nodeId
router.delete('/:sceneId/banter/:nodeId', (req, res) => {
  try {
    const result = deleteSceneBanterLine(
      req.user.username,
      req.params.sceneId,
      req.params.nodeId
    );
    res.json(result);
  } catch (error) {
    console.error('[conversations] Delete banter line failed:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
