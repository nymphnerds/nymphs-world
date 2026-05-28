import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';
import { getSceneParticipants as detectSceneParticipants } from './dialogueService.js';

// Per-user conversation data stored in workspace
// Structure: .__wbu_conversations.json per scene
function getConversationsFilePath(username, sceneId) {
  const workspaceRoot = getUserWorkspaceDir(username);
  return path.join(workspaceRoot, `.__wbu_scene_${sceneId}_conversations.json`);
}

function loadConversations(username, sceneId) {
  const filePath = getConversationsFilePath(username, sceneId);
  if (!fs.existsSync(filePath)) {
    return { threads: [], participants: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { threads: [], participants: [] };
  }
}

function saveConversations(username, sceneId, data) {
  const filePath = getConversationsFilePath(username, sceneId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Scene Participants ---

function getSceneParticipants(username, sceneId) {
  const data = loadConversations(username, sceneId);
  const manualParticipants = data.participants || [];

  // If no manually added participants, auto-detect from scene-assigned files
  if (manualParticipants.length === 0) {
    try {
      const detected = detectSceneParticipants(username, sceneId);

      // Convert detected participants to conversation participant format
      const autoParticipants = detected.map(p => ({
        id: `part_auto_${p.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        entityPath: p.path,
        spawnX: 0,
        spawnY: 0,
        type: p.type,
        autoDetected: true,
        createdAt: new Date().toISOString()
      }));

      return autoParticipants;
    } catch (err) {
      console.error('[conversationService] Auto-detect participants failed:', err.message);
      // Return empty if detection fails
      return [];
    }
  }

  return manualParticipants;
}

function addSceneParticipant(username, sceneId, { entityPath, spawnX = 0, spawnY = 0 }) {
  if (!entityPath || !entityPath.trim()) {
    throw new Error('Entity path is required');
  }
  const data = loadConversations(username, sceneId);
  if (!data.participants) data.participants = [];

  const exists = data.participants.some(p => p.entityPath.toLowerCase() === entityPath.trim().toLowerCase());
  if (exists) {
    throw new Error(`Participant "${entityPath.trim()}" already assigned to this scene`);
  }

  const participant = {
    id: `part_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    entityPath: entityPath.trim(),
    spawnX,
    spawnY,
    createdAt: new Date().toISOString()
  };
  data.participants.push(participant);
  saveConversations(username, sceneId, data);
  return participant;
}

function removeSceneParticipant(username, sceneId, entityPath) {
  const data = loadConversations(username, sceneId);
  const before = (data.participants || []).length;
  data.participants = (data.participants || []).filter(p => p.entityPath !== entityPath);
  if (data.participants.length < before) {
    saveConversations(username, sceneId, data);
  }
  return { success: true, removed: entityPath };
}

// --- Conversation Threads ---

function getThreadsForScene(username, sceneId) {
  const data = loadConversations(username, sceneId);
  return data.threads || [];
}

function createThread(username, sceneId, { type, participants, proximityRadius = 5.0, title = 'Untitled Thread' }) {
  if (!type || !['idle', 'ambient', 'interactive'].includes(type)) {
    throw new Error('Thread type must be "idle", "ambient", or "interactive"');
  }
  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    throw new Error('At least one participant is required');
  }

  // Validate participants exist in scene (check both manual + auto-detected)
  const sceneData = loadConversations(username, sceneId);
  const manualParticipantPaths = (sceneData.participants || []).map(p => p.entityPath.toLowerCase());
  
  // Also detect participants from scene files for validation
  let detectedPaths = [];
  if (manualParticipantPaths.length === 0) {
    try {
      const detected = detectSceneParticipants(username, sceneId);
      detectedPaths = detected.map(p => p.path.toLowerCase());
    } catch { /* ignore detection failures */ }
  }
  
  const allValidPaths = [...new Set([...manualParticipantPaths, ...detectedPaths])];

  for (const p of participants) {
    if (!allValidPaths.includes(p.toLowerCase())) {
      throw new Error(`Participant "${p}" is not assigned to this scene. Add them first.`);
    }
  }

  // Validate participant count by type
  if (type === 'idle' && participants.length !== 1) {
    throw new Error('Idle chatter requires exactly 1 participant');
  }
  if (type === 'ambient' && participants.length < 2) {
    throw new Error('Ambient conversation requires at least 2 participants');
  }
  if (type === 'interactive' && participants.length < 2) {
    throw new Error('Interactive dialogue requires at least 2 participants');
  }

  const thread = {
    id: `thread_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    sceneId,
    type,
    participants,
    proximityRadius,
    title: title.trim() || 'Untitled Thread',
    isActive: true,
    nodes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  sceneData.threads = sceneData.threads || [];
  sceneData.threads.push(thread);
  saveConversations(username, sceneId, sceneData);
  return thread;
}

function getThreadById(username, sceneId, threadId) {
  const data = loadConversations(username, sceneId);
  const thread = (data.threads || []).find(t => t.id === threadId);
  if (!thread) {
    throw new Error('Thread not found');
  }
  return thread;
}

function updateThread(username, sceneId, threadId, updates) {
  const data = loadConversations(username, sceneId);
  const idx = (data.threads || []).findIndex(t => t.id === threadId);
  if (idx === -1) {
    throw new Error('Thread not found');
  }

  const thread = data.threads[idx];
  if (updates.title !== undefined) {
    thread.title = updates.title.trim();
  }
  if (updates.proximityRadius !== undefined) {
    thread.proximityRadius = Number(updates.proximityRadius);
  }
  if (updates.isActive !== undefined) {
    thread.isActive = Boolean(updates.isActive);
  }
  if (updates.participants !== undefined) {
    thread.participants = updates.participants;
  }

  thread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return thread;
}

function deleteThread(username, sceneId, threadId) {
  const data = loadConversations(username, sceneId);
  const before = (data.threads || []).length;
  data.threads = (data.threads || []).filter(t => t.id !== threadId);
  if (data.threads.length < before) {
    saveConversations(username, sceneId, data);
    return { success: true, removed: threadId };
  }
  throw new Error('Thread not found');
}

// --- Conversation Nodes ---

function addNode(username, sceneId, threadId, { speakerPath, speech = '', action, alignment, x = 0, y = 0 }) {
  if (!speakerPath || !speakerPath.trim()) {
    throw new Error('Speaker is required');
  }

  const data = loadConversations(username, sceneId);
  const thread = (data.threads || []).find(t => t.id === threadId);
  if (!thread) {
    throw new Error('Thread not found');
  }

  // Validate speaker is a participant
  if (!thread.participants.includes(speakerPath.trim())) {
    throw new Error(`Speaker "${speakerPath.trim()}" is not a participant in this thread`);
  }

  const node = {
    id: `node_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    threadId,
    speakerPath: speakerPath.trim(),
    speech,
    action: action || null,
    alignment: alignment || null,
    x: Number(x),
    y: Number(y),
    nextNodeId: null,
    choices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  thread.nodes = thread.nodes || [];
  thread.nodes.push(node);
  thread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return node;
}

function updateNode(username, sceneId, nodeId, updates) {
  const data = loadConversations(username, sceneId);
  let targetNode = null;
  let targetThread = null;

  for (const thread of (data.threads || [])) {
    const found = (thread.nodes || []).find(n => n.id === nodeId);
    if (found) {
      targetNode = found;
      targetThread = thread;
      break;
    }
  }

  if (!targetNode) {
    throw new Error('Node not found');
  }

  if (updates.speech !== undefined) targetNode.speech = updates.speech;
  if (updates.action !== undefined) targetNode.action = updates.action;
  if (updates.alignment !== undefined) targetNode.alignment = updates.alignment;
  if (updates.speakerPath !== undefined) targetNode.speakerPath = updates.speakerPath.trim();
  if (updates.x !== undefined) targetNode.x = Number(updates.x);
  if (updates.y !== undefined) targetNode.y = Number(updates.y);
  if (updates.nextNodeId !== undefined) targetNode.nextNodeId = updates.nextNodeId;

  targetNode.updatedAt = new Date().toISOString();
  if (targetThread) targetThread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return targetNode;
}

function connectNode(username, sceneId, nodeId, { nextNodeId }) {
  return updateNode(username, sceneId, nodeId, { nextNodeId: nextNodeId || null });
}

function deleteNode(username, sceneId, nodeId) {
  const data = loadConversations(username, sceneId);
  let deleted = false;

  for (const thread of (data.threads || [])) {
    const before = (thread.nodes || []).length;
    thread.nodes = (thread.nodes || []).filter(n => n.id !== nodeId);
    // Clear references to deleted node
    for (const node of (thread.nodes || [])) {
      if (node.nextNodeId === nodeId) node.nextNodeId = null;
    }
    if (thread.nodes.length < before) {
      deleted = true;
      thread.updatedAt = new Date().toISOString();
    }
  }

  if (!deleted) {
    throw new Error('Node not found');
  }
  saveConversations(username, sceneId, data);
  return { success: true, removed: nodeId };
}

// --- Choice Nodes ---

function addChoice(username, sceneId, nodeId, { text = '', alignment, targetNodeId, targetThreadId, outcomes, conditions, sortIndex = 0 }) {
  const data = loadConversations(username, sceneId);
  let targetNode = null;
  let targetThread = null;

  for (const thread of (data.threads || [])) {
    const found = (thread.nodes || []).find(n => n.id === nodeId);
    if (found) {
      targetNode = found;
      targetThread = thread;
      break;
    }
  }

  if (!targetNode) {
    throw new Error('Node not found');
  }

  const choice = {
    id: `choice_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    nodeId,
    text,
    alignment: alignment || null,
    targetNodeId: targetNodeId || null,
    targetThreadId: targetThreadId || null,
    outcomes: outcomes || { statChanges: [], itemsGranted: [], perksUnlocked: [], alignmentShift: 0 },
    conditions: conditions || {},
    sortIndex,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  targetNode.choices = targetNode.choices || [];
  targetNode.choices.push(choice);
  targetNode.updatedAt = new Date().toISOString();
  if (targetThread) targetThread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return choice;
}

function updateChoice(username, sceneId, choiceId, updates) {
  const data = loadConversations(username, sceneId);
  let targetChoice = null;
  let targetThread = null;

  for (const thread of (data.threads || [])) {
    for (const node of (thread.nodes || [])) {
      const found = (node.choices || []).find(c => c.id === choiceId);
      if (found) {
        targetChoice = found;
        targetThread = thread;
        break;
      }
    }
    if (targetChoice) break;
  }

  if (!targetChoice) {
    throw new Error('Choice not found');
  }

  if (updates.text !== undefined) targetChoice.text = updates.text;
  if (updates.alignment !== undefined) targetChoice.alignment = updates.alignment;
  if (updates.targetNodeId !== undefined) targetChoice.targetNodeId = updates.targetNodeId;
  if (updates.targetThreadId !== undefined) targetChoice.targetThreadId = updates.targetThreadId;
  if (updates.outcomes !== undefined) targetChoice.outcomes = updates.outcomes;
  if (updates.conditions !== undefined) targetChoice.conditions = updates.conditions;
  if (updates.sortIndex !== undefined) targetChoice.sortIndex = Number(updates.sortIndex);

  targetChoice.updatedAt = new Date().toISOString();
  if (targetThread) targetThread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return targetChoice;
}

// --- Participant Idle Lines ---
// Convenience helpers that auto-manage idle threads per participant

function findOrCreateIdleThread(username, sceneId, entityPath) {
  const data = loadConversations(username, sceneId);
  let thread = (data.threads || []).find(t =>
    t.type === 'idle' &&
    (t.participants || []).length === 1 &&
    t.participants[0].toLowerCase() === entityPath.toLowerCase()
  );

  if (!thread) {
    const id = `thread_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    thread = {
      id,
      sceneId,
      type: 'idle',
      participants: [entityPath],
      proximityRadius: 5.0,
      title: `${entityPath} - Idle`,
      isActive: true,
      nodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.threads = data.threads || [];
    data.threads.push(thread);
    saveConversations(username, sceneId, data);
  }

  return thread;
}

function getParticipantIdleLines(username, sceneId, entityPath) {
  const thread = findOrCreateIdleThread(username, sceneId, entityPath);
  return (thread.nodes || []).map(n => ({
    id: n.id,
    threadId: thread.id,
    speakerPath: n.speakerPath,
    speech: n.speech || '',
    action: n.action || null,
    x: n.x || 0,
    y: n.y || 0
  }));
}

function addParticipantIdleLine(username, sceneId, entityPath, { speech = '' }) {
  const thread = findOrCreateIdleThread(username, sceneId, entityPath);
  const data = loadConversations(username, sceneId);
  const currentThread = (data.threads || []).find(t => t.id === thread.id);
  if (!currentThread) {
    throw new Error('Failed to locate idle thread');
  }

  // Calculate position: place nodes in a vertical list
  const nodeCount = (currentThread.nodes || []).length;
  const x = 0;
  const y = nodeCount * 80;

  const node = {
    id: `node_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    threadId: currentThread.id,
    speakerPath: entityPath,
    speech,
    action: null,
    alignment: null,
    x,
    y,
    nextNodeId: null,
    choices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  currentThread.nodes = currentThread.nodes || [];
  currentThread.nodes.push(node);
  currentThread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return node;
}

function deleteChoice(username, sceneId, choiceId) {
  const data = loadConversations(username, sceneId);
  let deleted = false;

  for (const thread of (data.threads || [])) {
    for (const node of (thread.nodes || [])) {
      const before = (node.choices || []).length;
      node.choices = (node.choices || []).filter(c => c.id !== choiceId);
      if (node.choices.length < before) {
        deleted = true;
        node.updatedAt = new Date().toISOString();
        thread.updatedAt = new Date().toISOString();
      }
    }
  }

  if (!deleted) {
    throw new Error('Choice not found');
  }
  saveConversations(username, sceneId, data);
  return { success: true, removed: choiceId };
}

function deleteParticipantIdleLine(username, sceneId, nodeId) {
  return deleteNode(username, sceneId, nodeId);
}

// --- Scene NPC Banter ---
// A shared, scene-level banter thread involving all participants.
// Every banter line is a node in a single ambient "banter" thread.

const BANTER_THREAD_TITLE = 'NPC Banter';

function findOrCreateBanterThread(username, sceneId, allParticipants) {
  const data = loadConversations(username, sceneId);
  let thread = (data.threads || []).find(t =>
    t.type === 'ambient' &&
    t.title === BANTER_THREAD_TITLE &&
    (t._isBanter === true)
  );

  if (!thread) {
    const id = `thread_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    thread = {
      id,
      sceneId,
      type: 'ambient',
      participants: allParticipants || [],
      proximityRadius: 10.0,
      title: BANTER_THREAD_TITLE,
      _isBanter: true,
      isActive: true,
      nodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.threads = data.threads || [];
    data.threads.push(thread);
    saveConversations(username, sceneId, data);
  }

  return thread;
}

function getSceneBanter(username, sceneId) {
  // Need the participants list to create the thread
  const participants = getSceneParticipants(username, sceneId);
  const entityPaths = participants.map(p => p.entityPath);
  const thread = findOrCreateBanterThread(username, sceneId, entityPaths);
  return (thread.nodes || []).map(n => ({
    id: n.id,
    threadId: thread.id,
    speakerPath: n.speakerPath,
    speech: n.speech || '',
  }));
}

function addSceneBanterLine(username, sceneId, { speakerPath, speech = '' }) {
  const participants = getSceneParticipants(username, sceneId);
  const entityPaths = participants.map(p => p.entityPath);

  // Validate speaker is a participant
  if (!entityPaths.some(ep => ep.toLowerCase() === speakerPath.toLowerCase())) {
    throw new Error(`Speaker '${speakerPath}' is not a scene participant`);
  }

  const thread = findOrCreateBanterThread(username, sceneId, entityPaths);
  const data = loadConversations(username, sceneId);
  const currentThread = (data.threads || []).find(t => t.id === thread.id);
  if (!currentThread) {
    throw new Error('Failed to locate banter thread');
  }

  const node = {
    id: `node_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
    threadId: currentThread.id,
    speakerPath,
    speech,
    action: null,
    alignment: null,
    x: 0,
    y: (currentThread.nodes || []).length * 80,
    nextNodeId: null,
    choices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  currentThread.nodes = currentThread.nodes || [];
  currentThread.nodes.push(node);
  currentThread.updatedAt = new Date().toISOString();
  saveConversations(username, sceneId, data);
  return node;
}

function deleteSceneBanterLine(username, sceneId, nodeId) {
  return deleteNode(username, sceneId, nodeId);
}

export {
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
};
