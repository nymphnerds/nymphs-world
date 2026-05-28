/**
 * Scene Conversation Designer
 *
 * A participant-centric conversation designer with three panels:
 * - Left: Participants of the scene (click to select)
 * - Center: Freeform canvas with speech bubble nodes (filtered by selected participant)
 * - Right: Three sections — Idle Chatter, NPC↔NPC Dialogue, Tools palette
 *
 * Supports idle chatter, ambient, and interactive conversation threads.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  MessageSquare, MessagesSquare, Gamepad2, Plus, X, Save, Download,
  ZoomIn, ZoomOut, Grid3X3, Trash2, GripVertical, User, UserX,
  ChevronDown, ChevronRight, MessageCircle, UserCircle,
  Award, Gift, TrendingUp, Shield, AlertTriangle
} from 'lucide-react';

// =============================================
// Types
// =============================================

type ThreadType = 'idle' | 'ambient' | 'interactive';

interface SceneParticipant {
  id: string;
  entityPath: string;
  spawnX: number;
  spawnY: number;
  type?: string;
  autoDetected?: boolean;
}

interface ChoiceOutcomes {
  statChanges: Array<{ statId: string; amount: number }>;
  itemsGranted: Array<{ itemId: string; quantity: number }>;
  perksUnlocked: string[];
  alignmentShift: number;
}

type ConditionType = 'quest' | 'stat' | 'item' | 'flag';

interface ChoiceCondition {
  id: string;
  type: ConditionType;
  // For quest: questId, minStage
  // For stat: statId, minValue
  // For item: itemId
  // For flag: flagId
  fieldId: string;
  minValue?: number;
}

interface ConversationChoice {
  id: string;
  nodeId: string;
  text: string;
  alignment: string | null;
  targetNodeId: string | null;
  targetThreadId: string | null;
  outcomes: ChoiceOutcomes;
  conditions: ChoiceCondition[];
  sortIndex: number;
}

interface ConversationNode {
  id: string;
  threadId: string;
  speakerPath: string;
  speech: string;
  action: string | null;
  alignment: string | null;
  x: number;
  y: number;
  nextNodeId: string | null;
  choices: ConversationChoice[];
}

interface ConversationThread {
  id: string;
  sceneId: string;
  type: ThreadType;
  participants: string[];
  proximityRadius: number;
  title: string;
  isActive: boolean;
  nodes: ConversationNode[];
}

type SelectionType = 'none' | 'thread' | 'node' | 'choice';

interface Selection {
  type: SelectionType;
  threadId?: string;
  nodeId?: string;
  choiceId?: string;
}

// Tool types for the right panel
type ToolType = 'choice' | 'stat' | 'item' | 'perk' | 'alignment';

interface ToolDefinition {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const TOOLS: ToolDefinition[] = [
  { id: 'choice', label: 'Choice Branch', icon: <MessagesSquare size={12} />, description: 'Add a player choice to the selected node', color: '#f59e0b' },
  { id: 'stat', label: 'Stat Boost', icon: <TrendingUp size={12} />, description: 'Add a stat change outcome', color: '#22c55e' },
  { id: 'item', label: 'Item Grant', icon: <Gift size={12} />, description: 'Grant an item on choice', color: '#60a5fa' },
  { id: 'perk', label: 'Perk Unlock', icon: <Award size={12} />, description: 'Unlock a perk on choice', color: '#a78bfa' },
  { id: 'alignment', label: 'Alignment Shift', icon: <AlertTriangle size={12} />, description: 'Shift alignment on choice', color: '#ec4899' },
];

// =============================================
// API Helpers
// =============================================

const API = '/api';
const TOKEN_KEY = 'wbu_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

// =============================================
// Component
// =============================================

interface Props {
  sceneId: string;
  sceneName: string;
  onClose: () => void;
}

export default function SceneConversationDesigner({ sceneId, sceneName, onClose }: Props) {
  // --- Data State ---
  const [participants, setParticipants] = useState<SceneParticipant[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });

  // --- Selected Participant ---
  const [selectedParticipantPath, setSelectedParticipantPath] = useState<string | null>(null);

  // --- Active Tool (click-to-apply mode) ---
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  // --- Canvas State ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // --- Drag State for Nodes ---
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- Panel Widths (resizable) ---
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);
  const resizingRef = useRef<'left' | 'right' | null>(null);

  // Handle panel resizing via mouse events on the outer body
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const bodyRect = (document.activeElement?.closest('.conv-designer__body') || document.activeElement?.parentElement)?.getBoundingClientRect();
      if (!bodyRect) return;
      if (resizingRef.current === 'left') {
        const newWidth = Math.max(160, Math.min(450, e.clientX - bodyRect.left));
        setLeftWidth(newWidth);
      } else if (resizingRef.current === 'right') {
        const newWidth = Math.max(220, Math.min(500, bodyRect.right - e.clientX));
        setRightWidth(newWidth);
      }
    };
    const handleMouseUp = () => { resizingRef.current = null; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizerMouseDown = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = side;
  };

  // --- New Thread Dialog ---
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadType, setNewThreadType] = useState<ThreadType>('interactive');
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadParticipants, setNewThreadParticipants] = useState<string[]>([]);
  const [newThreadRadius, setNewThreadRadius] = useState(5.0);

  // --- Add Participant ---
  const [newParticipantPath, setNewParticipantPath] = useState('');

  // --- New Node Form ---
  const [newNodeSpeaker, setNewNodeSpeaker] = useState('');
  const [newNodeSpeech, setNewNodeSpeech] = useState('');

  // --- Per-Participant Idle Lines ---
  const [idleLines, setIdleLines] = useState<Array<{ id: string; speech: string }>>([]);
  const [newIdleSpeech, setNewIdleSpeech] = useState('');
  const [editingIdleLine, setEditingIdleLine] = useState<string | null>(null);
  const [editingIdleSpeech, setEditingIdleSpeech] = useState('');

  // --- Scene-level NPC Banter (shared across all participants) ---
  const [banterLines, setBanterLines] = useState<Array<{ id: string; speakerPath: string; speech: string }>>([]);
  const [newBanterSpeaker, setNewBanterSpeaker] = useState('');
  const [newBanterSpeech, setNewBanterSpeech] = useState('');
  const [editingBanterLine, setEditingBanterLine] = useState<string | null>(null);
  const [editingBanterSpeech, setEditingBanterSpeech] = useState('');

  // --- Canvas Ref ---
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- DOM Position Tracking for Connection Lines ---
  const choiceBadgeRefMap = useRef<Map<string, HTMLSpanElement>>(new Map());
  const nodeRefMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectionLines, setConnectionLines] = useState<Array<{
    id: string;
    x1: number; y1: number;
    x2: number; y2: number;
    isChoice: boolean;
  }>>([]);

  // =============================================
  // Data Loading
  // =============================================

  // Normalize choices to ensure conditions and outcomes are always arrays/objects
  const normalizeChoice = (c: any): ConversationChoice => ({
    ...c,
    conditions: Array.isArray(c.conditions) ? c.conditions : [],
    outcomes: c.outcomes && typeof c.outcomes === 'object' ? c.outcomes : { statChanges: [], itemsGranted: [], perksUnlocked: [], alignmentShift: 0 }
  });

  const normalizeThreads = (threads: any[]) =>
    threads.map(t => ({
      ...t,
      nodes: (t.nodes || []).map((n: any) => ({
        ...n,
        choices: (n.choices || []).map(normalizeChoice)
      }))
    }));

  const loadData = useCallback(async () => {
    try {
      const [parts, thrs] = await Promise.all([
        apiFetch(`/conversations/${sceneId}/participants`),
        apiFetch(`/conversations/${sceneId}/threads`)
      ]);
      setParticipants(Array.isArray(parts) ? parts : []);
      setThreads(Array.isArray(thrs) ? normalizeThreads(thrs) : []);
    } catch (err) {
      console.error('[ConvDesigner] Load failed:', err);
    }
  }, [sceneId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Set default selected participant when participants load
  useEffect(() => {
    if (participants.length > 0 && !selectedParticipantPath) {
      setSelectedParticipantPath(participants[0].entityPath);
    }
  }, [participants, selectedParticipantPath]);

  // Load idle lines for the selected participant
  useEffect(() => {
    if (!selectedParticipantPath) {
      setIdleLines([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/conversations/${sceneId}/participants/idleLines?entityPath=${encodeURIComponent(selectedParticipantPath)}`)
      .then(data => {
        if (!cancelled) setIdleLines(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('[ConvDesigner] Load idle lines failed:', err));
    return () => { cancelled = true; };
  }, [sceneId, selectedParticipantPath]);

  // Load scene-level NPC Banter (shared across all participants)
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/conversations/${sceneId}/banter`)
      .then(data => {
        if (!cancelled) setBanterLines(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('[ConvDesigner] Load banter failed:', err));
    return () => { cancelled = true; };
  }, [sceneId]);

  // Clear active tool on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTool) {
        setActiveTool(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTool]);

  // =============================================
  // Compute Connection Line Positions from DOM
  // =============================================

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const lines: typeof connectionLines = [];
    const allNodesLocal = threads.flatMap(t => t.nodes || []);

    // Build set of visible threads
    const visibleThreads = threads.filter(thread => {
      if (thread.type !== 'interactive') return false;
      if (selectedParticipantPath && !thread.participants.includes(selectedParticipantPath)) return false;
      return true;
    });

    // Sequential connections
    visibleThreads.forEach(thread => {
      (thread.nodes || []).forEach(node => {
        if (!node.nextNodeId) return;
        const target = allNodesLocal.find(n => n.id === node.nextNodeId);
        if (!target) return;
        const nodeEl = nodeRefMap.current.get(node.id);
        const targetEl = nodeRefMap.current.get(target.id);
        if (!nodeEl || !targetEl) return;

        const nodeRect = nodeEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // Source: bottom center of source node
        const x1 = nodeRect.left + nodeRect.width / 2 - canvasRect.left;
        const y1 = nodeRect.bottom - canvasRect.top;
        // Target: top center of target node
        const x2 = targetRect.left + targetRect.width / 2 - canvasRect.left;
        const y2 = targetRect.top - canvasRect.top;

        lines.push({ id: `conn-${node.id}`, x1, y1, x2, y2, isChoice: false });
      });
    });

    // Choice connections
    visibleThreads.forEach(thread => {
      (thread.nodes || []).forEach(node => {
        (node.choices || []).forEach(choice => {
          if (!choice.targetNodeId) return;
          const target = allNodesLocal.find(n => n.id === choice.targetNodeId);
          if (!target) return;
          const badgeEl = choiceBadgeRefMap.current.get(choice.id);
          const targetEl = nodeRefMap.current.get(target.id);
          if (!badgeEl || !targetEl) return;

          const badgeRect = badgeEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          // Source: right center of the badge
          const x1 = badgeRect.right - canvasRect.left;
          const y1 = badgeRect.top + badgeRect.height / 2 - canvasRect.top;
          // Target: left center of target node
          const x2 = targetRect.left - canvasRect.left;
          const y2 = targetRect.top + targetRect.height / 2 - canvasRect.top;

          lines.push({ id: `choice-conn-${choice.id}`, x1, y1, x2, y2, isChoice: true });
        });
      });
    });

    setConnectionLines(lines);
  }, [threads, zoom, pan, selectedParticipantPath]);

  // =============================================
  // Derived Data
  // =============================================

  const selectedParticipant = participants.find(p => p.entityPath === selectedParticipantPath);

  // Threads involving the selected participant
  const participantThreads = threads.filter(t =>
    selectedParticipantPath && t.participants.includes(selectedParticipantPath)
  );

  // Idle chatter for selected participant
  const idleThreads = participantThreads.filter(t => t.type === 'idle');

  // Ambient (NPC-to-NPC, not player) for selected participant
  const ambientThreads = participantThreads.filter(t => t.type === 'ambient');

  // Interactive threads for selected participant
  const interactiveThreads = participantThreads.filter(t => t.type === 'interactive');

  // Nodes for the selected participant (all types)
  const participantNodes = selectedParticipantPath
    ? threads
        .filter(t => t.participants.includes(selectedParticipantPath))
        .flatMap(t => t.nodes || [])
    : [];

  const selectedThread = threads.find(t => t.id === selection.threadId);
  const allNodes = threads.flatMap(t => t.nodes || []);
  const selectedNode = allNodes.find(n => n.id === selection.nodeId);
  const selectedChoice = allNodes
    .flatMap(n => n.choices || [])
    .find(c => c.id === selection.choiceId);

  const totalNodes = threads.reduce((sum, t) => sum + (t.nodes?.length || 0), 0);
  const totalChoices = threads.reduce(
    (sum, t) => sum + t.nodes?.reduce((s, n) => s + (n.choices?.length || 0), 0) || 0, 0
  );

  // =============================================
  // Participant Actions
  // =============================================

  const handleAddParticipant = async () => {
    if (!newParticipantPath.trim()) return;
    try {
      const p = await apiFetch(`/conversations/${sceneId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ entityPath: newParticipantPath, spawnX: 0, spawnY: 0 })
      });
      setParticipants(prev => [...prev, p]);
      setNewParticipantPath('');
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleRemoveParticipant = async (entityPath: string) => {
    try {
      await apiFetch(`/conversations/${sceneId}/participants/${encodeURIComponent(entityPath)}`, {
        method: 'DELETE'
      });
      setParticipants(prev => prev.filter(p => p.entityPath !== entityPath));
      if (selectedParticipantPath === entityPath) {
        setSelectedParticipantPath(null);
      }
    } catch (err) {
      console.error('Remove failed:', err);
    }
  };

  // =============================================
  // Thread Actions
  // =============================================

  const handleCreateThread = async () => {
    // Auto-include selected participant
    const partList = newThreadParticipants.length > 0
      ? newThreadParticipants
      : (selectedParticipantPath ? [selectedParticipantPath] : []);

    if (partList.length === 0) {
      alert('Select at least one participant');
      return;
    }
    try {
      const thread = await apiFetch(`/conversations/${sceneId}/threads`, {
        method: 'POST',
        body: JSON.stringify({
          type: newThreadType,
          participants: partList,
          proximityRadius: newThreadRadius,
          title: newThreadTitle || 'Untitled'
        })
      });
      setThreads(prev => [...prev, thread]);
      setShowNewThread(false);
      setNewThreadTitle('');
      setNewThreadParticipants([]);
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Delete this thread and all its nodes?')) return;
    try {
      await apiFetch(`/conversations/${sceneId}/threads/${threadId}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (selection.threadId === threadId) setSelection({ type: 'none' });
    } catch (err) {
      console.error('Delete thread failed:', err);
    }
  };

  // =============================================
  // Node Actions
  // =============================================

  const handleAddNode = async (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    const speaker = newNodeSpeaker || thread.participants[0];
    if (!speaker) return;

    try {
      const nodes = thread.nodes || [];
      const node = await apiFetch(`/conversations/${sceneId}/nodes`, {
        method: 'POST',
        body: JSON.stringify({
          threadId,
          speakerPath: speaker,
          speech: newNodeSpeech,
          x: 100 + nodes.length * 220,
          y: 80 + nodes.length * 80
        })
      });
      // Normalize choices on the new node
      const normalizedNode = {
        ...node,
        choices: (node.choices || []).map(normalizeChoice)
      };
      setThreads(prev => prev.map(t =>
        t.id === threadId ? { ...t, nodes: [...(t.nodes || []), normalizedNode] } : t
      ));
      setNewNodeSpeech('');
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleUpdateNode = async (nodeId: string, updates: any) => {
    try {
      const updated = await apiFetch(`/conversations/${sceneId}/nodes/${nodeId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      // Normalize choices on the updated node
      const normalizedNode = {
        ...updated,
        choices: (updated.choices || []).map(normalizeChoice)
      };
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).map(n => n.id === nodeId ? normalizedNode : n)
      })));
    } catch (err) {
      console.error('Update node failed:', err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      await apiFetch(`/conversations/${sceneId}/nodes/${nodeId}`, { method: 'DELETE' });
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).filter(n => n.id !== nodeId)
      })));
      if (selection.nodeId === nodeId) setSelection({ type: 'none' });
    } catch (err) {
      console.error('Delete node failed:', err);
    }
  };

  // =============================================
  // Choice Actions
  // =============================================

  const handleAddChoice = async (nodeId: string) => {
    try {
      const choice = await apiFetch(`/conversations/${sceneId}/choices`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, text: 'New Choice', sortIndex: 0 })
      });
      // Normalize the new choice to ensure conditions/outcomes exist
      const normalized = normalizeChoice(choice);
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).map(n =>
          n.id === nodeId ? { ...n, choices: [...(n.choices || []), normalized] } : n
        )
      })));
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleUpdateChoice = async (choiceId: string, updates: any) => {
    try {
      await apiFetch(`/conversations/${sceneId}/choices/${choiceId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).map(n => ({
          ...n,
          choices: (n.choices || []).map(c => {
            if (c.id !== choiceId) return c;
            // Preserve existing fields that aren't being updated
            return {
              ...c,
              ...updates,
              conditions: (updates.conditions !== undefined ? updates.conditions : c.conditions) || [],
              outcomes: (updates.outcomes !== undefined ? updates.outcomes : c.outcomes) || { statChanges: [], itemsGranted: [], perksUnlocked: [], alignmentShift: 0 }
            };
          })
        }))
      })));
    } catch (err) {
      console.error('Update choice failed:', err);
    }
  };

  const handleDeleteChoice = async (choiceId: string) => {
    try {
      await apiFetch(`/conversations/${sceneId}/choices/${choiceId}`, { method: 'DELETE' });
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).map(n => ({
          ...n,
          choices: (n.choices || []).filter(c => c.id !== choiceId)
        }))
      })));
      if (selection.choiceId === choiceId) setSelection({ type: 'none' });
    } catch (err) {
      console.error('Delete choice failed:', err);
    }
  };

  // =============================================
  // Tool Application (click-to-apply on nodes)
  // =============================================

  const handleNodeToolClick = useCallback((nodeId: string) => {
    if (!activeTool) return;

    switch (activeTool) {
      case 'choice':
        handleAddChoice(nodeId);
        break;
      default:
        // Other tools are for choices, not nodes
        break;
    }
    setActiveTool(null);
  }, [activeTool, handleAddChoice]);

  // =============================================
  // Tool Application on Choices (click-to-apply)
  // =============================================

  const handleChoiceToolClick = useCallback(async (choiceId: string, nodeId: string) => {
    if (!activeTool) return;

    // Tools that apply to choices
    const choiceTools: ToolType[] = ['stat', 'item', 'perk', 'alignment'];
    if (!choiceTools.includes(activeTool)) {
      // Tool doesn't apply to choices, ignore
      return;
    }

    // Find the current choice
    const allNodesLocal = threads.flatMap(t => t.nodes || []);
    const choice = allNodesLocal.flatMap(n => n.choices || []).find(c => c.id === choiceId);
    if (!choice) return;

    const outcomes = choice.outcomes || { statChanges: [], itemsGranted: [], perksUnlocked: [], alignmentShift: 0 };

    switch (activeTool) {
      case 'item': {
        const itemId = prompt('Enter item ID to grant:');
        if (!itemId) return;
        const quantity = prompt('Quantity:', '1');
        const updated = {
          ...outcomes,
          itemsGranted: [...(outcomes.itemsGranted || []), { itemId, quantity: Number(quantity) || 1 }]
        };
        await handleUpdateChoice(choiceId, { outcomes: updated });
        break;
      }
      case 'stat': {
        const statId = prompt('Enter stat ID:');
        if (!statId) return;
        const amount = prompt('Amount (e.g. 5 or -5):', '5');
        const updated = {
          ...outcomes,
          statChanges: [...(outcomes.statChanges || []), { statId, amount: Number(amount) || 5 }]
        };
        await handleUpdateChoice(choiceId, { outcomes: updated });
        break;
      }
      case 'perk': {
        const perkId = prompt('Enter perk ID to unlock:');
        if (!perkId) return;
        const updated = {
          ...outcomes,
          perksUnlocked: [...(outcomes.perksUnlocked || []), perkId]
        };
        await handleUpdateChoice(choiceId, { outcomes: updated });
        break;
      }
      case 'alignment': {
        const shift = prompt('Alignment shift amount (positive=good, negative=evil):', '5');
        const updated = {
          ...outcomes,
          alignmentShift: (outcomes.alignmentShift || 0) + (Number(shift) || 0)
        };
        await handleUpdateChoice(choiceId, { outcomes: updated });
        break;
      }
    }
    setActiveTool(null);
  }, [activeTool, threads, handleUpdateChoice]);

  // =============================================
  // Idle Line Actions (per-participant)
  // =============================================

  const handleAddIdleLine = async () => {
    if (!selectedParticipantPath) {
      console.warn('[ConvDesigner] No participant selected for idle line');
      return;
    }
    if (!newIdleSpeech.trim()) {
      console.warn('[ConvDesigner] Idle speech is empty, adding anyway');
    }
    try {
      console.log('[ConvDesigner] Adding idle line:', { sceneId, entityPath: selectedParticipantPath, speech: newIdleSpeech.trim() });
      const url = `/conversations/${sceneId}/participants/idleLines?entityPath=${encodeURIComponent(selectedParticipantPath)}`;
      console.log('[ConvDesigner] POST to:', url);
      const node = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify({ speech: newIdleSpeech.trim() })
      });
      console.log('[ConvDesigner] Idle line added:', node);
      setIdleLines(prev => [...prev, { id: node.id, speech: node.speech }]);
      setNewIdleSpeech('');
    } catch (err: any) {
      console.error('[ConvDesigner] Add idle line failed:', err);
      alert(err.message || String(err));
    }
  };

  const handleDeleteIdleLine = async (id: string) => {
    try {
      await apiFetch(`/conversations/${sceneId}/idleLines/${id}`, { method: 'DELETE' });
      setIdleLines(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleUpdateIdleLine = async (id: string, speech: string) => {
    try {
      const updated = await apiFetch(`/conversations/${sceneId}/nodes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ speech })
      });
      setIdleLines(prev => prev.map(l => l.id === id ? { id: l.id, speech: updated.speech } : l));
      setEditingIdleLine(null);
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  // =============================================
  // NPC Banter Actions (scene-level, shared)
  // =============================================

  const handleAddBanterLine = async () => {
    if (!newBanterSpeaker) {
      alert('Select a speaker for the banter line');
      return;
    }
    try {
      const node = await apiFetch(`/conversations/${sceneId}/banter`, {
        method: 'POST',
        body: JSON.stringify({ speakerPath: newBanterSpeaker, speech: newBanterSpeech.trim() })
      });
      setBanterLines(prev => [...prev, { id: node.id, speakerPath: node.speakerPath, speech: node.speech }]);
      setNewBanterSpeech('');
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleDeleteBanterLine = async (id: string) => {
    try {
      await apiFetch(`/conversations/${sceneId}/banter/${id}`, { method: 'DELETE' });
      setBanterLines(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleUpdateBanterLine = async (id: string, speech: string) => {
    try {
      const updated = await apiFetch(`/conversations/${sceneId}/nodes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ speech })
      });
      setBanterLines(prev => prev.map(l => l.id === id ? { ...l, speech: updated.speech } : l));
      setEditingBanterLine(null);
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  // =============================================
  // Canvas Pan/Zoom
  // =============================================

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // middle mouse
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
    if (draggingNode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setThreads(prev => prev.map(t => ({
        ...t,
        nodes: (t.nodes || []).map(n =>
          n.id === draggingNode ? { ...n, x: x - dragOffset.current.x, y: y - dragOffset.current.y } : n
        )
      })));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (draggingNode) {
      // Save position to server
      const allNodesLocal = threads.flatMap(t => t.nodes || []);
      const node = allNodesLocal.find(n => n.id === draggingNode);
      if (node) {
        handleUpdateNode(node.id, { x: node.x, y: node.y });
      }
      setDraggingNode(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(0.3, Math.min(2, prev + delta)));
  };

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const allNodesLocal = threads.flatMap(t => t.nodes || []);
    const node = allNodesLocal.find(n => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    dragOffset.current = { x: mouseX - node.x, y: mouseY - node.y };
    setDraggingNode(nodeId);
  };

  // =============================================
  // Helper Functions
  // =============================================

  const getParticipantDisplayName = (entityPath: string): string => {
    const basename = entityPath.split('/').pop() || entityPath;
    return basename.replace(/\.html$/i, '');
  };

  const getParticipantLetter = (entityPath: string): string => {
    const name = getParticipantDisplayName(entityPath);
    return name.charAt(0).toUpperCase();
  };

  const isPlayerCharacter = (entityPath: string): boolean => entityPath.startsWith('PlayerCharacters/');

  // Get the thread type for a given node
  const getNodeThreadType = (nodeId: string): ThreadType | null => {
    for (const t of threads) {
      const found = (t.nodes || []).find(n => n.id === nodeId);
      if (found) return t.type;
    }
    return null;
  };

  // =============================================
  // Render Helpers
  // =============================================

  const threadIcon = (type: ThreadType) => {
    switch (type) {
      case 'idle': return <MessageCircle size={12} />;
      case 'ambient': return <MessagesSquare size={12} />;
      case 'interactive': return <Gamepad2 size={12} />;
    }
  };

  const threadLabel = (type: ThreadType) => {
    switch (type) {
      case 'idle': return 'Idle Chatter';
      case 'ambient': return 'Ambient';
      case 'interactive': return 'Interactive';
    }
  };

  // =============================================
  // Render
  // =============================================

  return (
    <div className="conv-designer">
      {/* Header */}
      <div className="conv-designer__header">
        <div className="conv-designer__header-left">
          <span className="conv-designer__title">Conversation Designer — {sceneName}</span>
        </div>
        <div className="conv-designer__actions">
          {activeTool && (
            <span className="conv-tool-active" style={{ color: TOOLS.find(t => t.id === activeTool)?.color || '#fff', fontSize: '0.7rem', marginRight: '0.5rem' }}>
              {(activeTool === 'stat' || activeTool === 'item' || activeTool === 'perk' || activeTool === 'alignment')
                ? `Click a choice to apply: ${TOOLS.find(t => t.id === activeTool)?.label}`
                : `Click a node to apply: ${TOOLS.find(t => t.id === activeTool)?.label}`}
            </span>
          )}
          <button className="conv-btn" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {/* Main Body - Three Panels */}
      <div className="conv-designer__body">

        {/* ---- Left Sidebar: Participants Only ---- */}
        <div className="conv-designer__sidebar" style={{ width: leftWidth, minWidth: '160px' }}>

          {/* Participants Section */}
          <div className="conv-designer__sidebar-section">
            <div className="conv-designer__sidebar-section-title">
              <span>Participants</span>
              <span className="conv-thread-group__badge">{participants.length}</span>
            </div>

            {participants.map(p => (
              <div
                key={p.id}
                className={`conv-participant conv-participant--selectable ${selectedParticipantPath === p.entityPath ? 'conv-participant--selected' : ''}`}
                onClick={() => setSelectedParticipantPath(p.entityPath)}
              >
                <div className={`conv-participant__avatar ${isPlayerCharacter(p.entityPath) ? 'conv-participant__avatar--player' : ''}`}>
                  {getParticipantLetter(p.entityPath)}
                </div>
                <span
                  className="conv-participant__name"
                  style={isPlayerCharacter(p.entityPath) ? { color: '#4ade80' } : {}}
                >
                  {getParticipantDisplayName(p.entityPath)}
                </span>
                {!p.autoDetected && (
                  <span
                    className="conv-participant__remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(p.entityPath); }}
                  >
                    <X size={12} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resizer: Left panel */}
        <div className="conv-resizer conv-resizer--left" onMouseDown={handleResizerMouseDown('left')} />

        {/* ---- Center Canvas ---- */}
        <div className="conv-designer__canvas">
          {/* Canvas Header */}
          <div className="conv-canvas__header">Player Conversation</div>
          {/* Canvas Toolbar */}
          <div className="conv-canvas__toolbar">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><ZoomOut size={14} /></button>
            <span className="conv-canvas__zoom">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn size={14} /></button>
            <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 0.25rem' }} />
            <button onClick={() => setPan({ x: 0, y: 0 })}>Reset View</button>
            <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 0.25rem' }} />
            <button onClick={() => {
              // Add node to the first interactive thread of selected participant
              const firstInteractive = interactiveThreads[0];
              if (!firstInteractive) {
                alert('Create an interactive thread first');
                return;
              }
              setSelection({ type: 'thread', threadId: firstInteractive.id });
            }}>
              <Plus size={12} /> Add Node
            </button>
          </div>

          {/* Viewport */}
          <div
            ref={canvasRef}
            className="conv-canvas__viewport"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
          >
            <div className="conv-canvas__grid" />

            {/* Transformed content */}
            <div style={{
              position: 'absolute',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              zIndex: 3
            }}>

              {/* Render nodes for selected participant's interactive threads only (player dialogue) */}
              {threads.flatMap(thread => {
                // Only show interactive threads (participant ↔ player) on the canvas
                if (thread.type !== 'interactive') return [];
                if (selectedParticipantPath && !thread.participants.includes(selectedParticipantPath)) return [];

                return (thread.nodes || []).map(node => {
                  // Only show nodes spoken by the selected participant
                  if (selectedParticipantPath && node.speakerPath !== selectedParticipantPath) return null;

                  return (
                    <div
                      key={node.id}
                      className={`conv-node conv-node--${thread.type} ${selection.nodeId === node.id ? 'conv-node--selected' : ''} ${activeTool ? 'conv-node--tool-active' : ''}`}
                      style={{ left: node.x, top: node.y }}
                      ref={(el) => {
                        if (el) nodeRefMap.current.set(node.id, el);
                        else nodeRefMap.current.delete(node.id);
                      }}
                      onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        // If a tool is active, apply it
                        if (activeTool) {
                          handleNodeToolClick(node.id);
                        } else {
                          setSelection({ type: 'node', threadId: thread.id, nodeId: node.id });
                        }
                      }}
                    >
                    {/* Connection dots */}
                    <div className="conv-node__dot conv-node__dot--top" />
                    <div className="conv-node__dot conv-node__dot--bottom" />
                    {thread.type === 'interactive' && (
                      <div className="conv-node__dot conv-node__dot--right"
                        onClick={(e) => { e.stopPropagation(); handleAddChoice(node.id); }}
                        title="Add Choice"
                      />
                    )}

                    <div className="conv-node__header">
                      <MessageSquare size={10} />
                      {getParticipantDisplayName(node.speakerPath)}
                    </div>
                    <div className="conv-node__speech">{node.speech || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Empty speech...</span>}</div>
                    {node.action && <div className="conv-node__action">{node.action}</div>}

                    {/* Choice badges */}
                    {(node.choices || []).length > 0 && (
                      <div className="conv-node__badges">
                        {(node.choices || []).map(c => {
                          // Compute which tools are attached to this choice
                          const attachedTools: ToolType[] = [];
                          if (c.outcomes?.itemsGranted?.length) attachedTools.push('item');
                          if (c.outcomes?.statChanges?.length) attachedTools.push('stat');
                          if (c.outcomes?.perksUnlocked?.length) attachedTools.push('perk');
                          if (c.outcomes?.alignmentShift) attachedTools.push('alignment');

                          return (
                            <span key={c.id} className="conv-node__badge conv-node__badge--choice" style={{ cursor: 'pointer', borderColor: c.conditions?.length ? '#f97316' : '#f59e0b', position: 'relative', borderWidth: c.conditions?.length ? '1.5px' : '1px' }}
                              ref={(el) => {
                                if (el) choiceBadgeRefMap.current.set(c.id, el);
                                else choiceBadgeRefMap.current.delete(c.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                // If a choice-targeting tool is active, apply it to this choice
                                const choiceTargetingTools: ToolType[] = ['stat', 'item', 'perk', 'alignment'];
                                if (activeTool && choiceTargetingTools.includes(activeTool)) {
                                  handleChoiceToolClick(c.id, node.id);
                                } else {
                                  setSelection({ type: 'choice', threadId: thread.id, nodeId: node.id, choiceId: c.id });
                                }
                              }}
                            >
                              ◇ {c.text || 'New Choice'}
                              {/* Tool icons on the choice badge */}
                              {attachedTools.length > 0 && (
                                <span className="conv-choice__tool-icons">
                                  {attachedTools.map(t => {
                                    const toolDef = TOOLS.find(tt => tt.id === t);
                                    return toolDef ? (
                                      <span key={t} className="conv-choice__tool-icon" style={{ color: toolDef.color }} title={toolDef.label}>
                                        {toolDef.icon}
                                      </span>
                                    ) : null;
                                  })}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Outcome indicators */}
                    {(node.choices || []).flatMap(c => [
                      ...(c.outcomes?.statChanges || []).map((s: any, i: number) => ({ type: 'stat' as const, label: `${s.statId} +${s.amount}`, key: `s-${i}` })),
                      ...(c.outcomes?.itemsGranted || []).map((it: any, i: number) => ({ type: 'item' as const, label: `${it.itemId} x${it.quantity}`, key: `i-${i}` })),
                      ...(c.outcomes?.perksUnlocked || []).map((p: string, i: number) => ({ type: 'perk' as const, label: p, key: `p-${i}` })),
                      ...(c.outcomes?.alignmentShift ? [{ type: 'alignment' as const, label: `${c.outcomes.alignmentShift > 0 ? '+' : ''}${c.outcomes.alignmentShift}`, key: `a` }] : []),
                    ]).length > 0 && (
                      <div className="conv-node__outcomes">
                        {(node.choices || []).flatMap(c => [
                          ...(c.outcomes?.statChanges || []).map((s: any, i: number) => ({ type: 'stat' as const, label: `${s.statId} +${s.amount}`, key: `s-${i}` })),
                          ...(c.outcomes?.itemsGranted || []).map((it: any, i: number) => ({ type: 'item' as const, label: `${it.itemId} x${it.quantity}`, key: `i-${i}` })),
                          ...(c.outcomes?.perksUnlocked || []).map((p: string, i: number) => ({ type: 'perk' as const, label: p, key: `p-${i}` })),
                          ...(c.outcomes?.alignmentShift ? [{ type: 'alignment' as const, label: `${c.outcomes.alignmentShift > 0 ? '+' : ''}${c.outcomes.alignmentShift}`, key: `a` }] : []),
                        ]).map((o: any) => (
                          <span key={o.key} className={`conv-node__outcome-badge conv-node__outcome--${o.type}`}>
                            {o.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })}

            </div>

            {/* SVG Connections Layer */}
            <svg className="conv-canvas__connections" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <marker id="conv-arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--border-color)" />
                </marker>
                <marker id="conv-choice-arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                </marker>
              </defs>
              {/* Connection lines computed from actual DOM positions */}
              {connectionLines.map(line => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={line.isChoice ? '#f59e0b' : 'var(--border-color)'}
                  strokeWidth={line.isChoice ? 1.5 : 1}
                  strokeDasharray={line.isChoice ? '6,3' : 'none'}
                  fill="none"
                  markerEnd={line.isChoice ? 'url(#conv-choice-arrowhead)' : 'url(#conv-arrowhead)'}
                />
              ))}
            </svg>

            {/* Empty state */}
            {participantNodes.length === 0 && selectedParticipant && (
              <div className="conv-empty">
                <div className="conv-empty__icon"><MessagesSquare size={48} /></div>
                <div>No conversations for {getParticipantDisplayName(selectedParticipant.entityPath)}.</div>
                <div className="conv-empty__tips">
                  • Create a thread using "New Thread" above<br />
                  • Middle-mouse drag to pan canvas<br />
                  • Scroll to zoom
                </div>
              </div>
            )}

            {participants.length === 0 && (
              <div className="conv-empty">
                <div className="conv-empty__icon"><UserCircle size={48} /></div>
                <div>No participants in this scene.</div>
                <div className="conv-empty__tips">
                  • Add participants using the left panel<br />
                  • Then create threads and conversation nodes
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resizer: Right panel */}
        <div className="conv-resizer conv-resizer--right" onMouseDown={handleResizerMouseDown('right')} />

        {/* ---- Right Panel: Three Sections ---- */}
        <div className="conv-designer__props" style={{ width: rightWidth, minWidth: '220px' }}>
          {selectedParticipant && (
            <div className="conv-props__section conv-props__section--idle">
              <div className="conv-props__section-title">
                <MessageCircle size={12} style={{ marginRight: 4 }} />
                Idle Chatter — {getParticipantDisplayName(selectedParticipant.entityPath)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Lines this NPC says when idle (auto-managed)
              </div>

              {/* Idle lines list */}
              {idleLines.length === 0 ? (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.3rem 0' }}>
                  No idle lines yet. Add one below.
                </div>
              ) : (
                idleLines.map(line => (
                  <div key={line.id} className="conv-idle-line" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0' }}>
                    <MessageCircle size={10} style={{ color: '#a78bfa', flexShrink: 0 }} />
                    {editingIdleLine === line.id ? (
                      <input
                        className="conv-props__input"
                        style={{ flex: 1, fontSize: '0.7rem' }}
                        value={editingIdleSpeech}
                        onChange={e => setEditingIdleSpeech(e.target.value)}
                        onBlur={() => handleUpdateIdleLine(line.id, editingIdleSpeech)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateIdleLine(line.id, editingIdleSpeech); if (e.key === 'Escape') setEditingIdleLine(null); }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="conv-idle-line__text"
                        style={{ flex: 1, fontSize: '0.75rem', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onDoubleClick={() => { setEditingIdleLine(line.id); setEditingIdleSpeech(line.speech); }}
                        title="Double-click to edit"
                      >
                        {line.speech || '(empty)'}
                      </span>
                    )}
                    <button
                      className="conv-participant__remove"
                      onClick={() => handleDeleteIdleLine(line.id)}
                      title="Delete idle line"
                      style={{ flexShrink: 0 }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))
              )}

              {/* Add new idle line */}
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', alignItems: 'center' }}>
                <input
                  className="conv-props__input"
                  style={{ flex: 1, fontSize: '0.7rem' }}
                  placeholder="Add idle line..."
                  value={newIdleSpeech}
                  onChange={e => setNewIdleSpeech(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddIdleLine(); }}
                />
                <button className="conv-btn conv-btn--sm" onClick={handleAddIdleLine} title="Add idle line">
                  <Plus size={11} />
                </button>
              </div>
            </div>
          )}

          {/* === Section 2: NPC Banter (scene-level, shared) === */}
          <div className="conv-props__section conv-props__section--ambient">
            <div className="conv-props__section-title">
              <MessagesSquare size={12} style={{ marginRight: 4 }} />
              NPC Banter
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Shared banter lines across all scene NPCs
            </div>

            {/* Banter lines list */}
            {banterLines.length === 0 ? (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.3rem 0' }}>
                No banter lines yet. Add one below.
              </div>
            ) : (
              banterLines.map(line => (
                <div key={line.id} className="conv-idle-line" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0' }}>
                  <UserCircle size={10} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0, maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={line.speakerPath}>
                    {getParticipantDisplayName(line.speakerPath)}
                  </span>
                  {editingBanterLine === line.id ? (
                    <input
                      className="conv-props__input"
                      style={{ flex: 1, fontSize: '0.7rem' }}
                      value={editingBanterSpeech}
                      onChange={e => setEditingBanterSpeech(e.target.value)}
                      onBlur={() => handleUpdateBanterLine(line.id, editingBanterSpeech)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateBanterLine(line.id, editingBanterSpeech); if (e.key === 'Escape') setEditingBanterLine(null); }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="conv-idle-line__text"
                      style={{ flex: 1, fontSize: '0.75rem', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onDoubleClick={() => { setEditingBanterLine(line.id); setEditingBanterSpeech(line.speech); }}
                      title="Double-click to edit"
                    >
                      {line.speech || '(empty)'}
                    </span>
                  )}
                  <button
                    className="conv-participant__remove"
                    onClick={() => handleDeleteBanterLine(line.id)}
                    title="Delete banter line"
                    style={{ flexShrink: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))
            )}

            {/* Add new banter line */}
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', alignItems: 'center' }}>
              <select
                className="conv-props__select"
                style={{ flex: 1, fontSize: '0.7rem' }}
                value={newBanterSpeaker}
                onChange={e => setNewBanterSpeaker(e.target.value)}
              >
                <option value="">Speaker...</option>
                {participants.map(p => (
                  <option key={p.entityPath} value={p.entityPath}>{getParticipantDisplayName(p.entityPath)}</option>
                ))}
              </select>
              <input
                className="conv-props__input"
                style={{ flex: 2, fontSize: '0.7rem' }}
                placeholder="Banter line..."
                value={newBanterSpeech}
                onChange={e => setNewBanterSpeech(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddBanterLine(); }}
              />
              <button className="conv-btn conv-btn--sm" onClick={handleAddBanterLine} title="Add banter line">
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* === Section 3: Tools Palette === */}
          <div className="conv-props__section conv-props__section--tools">
            <div className="conv-props__section-title">
              <Grid3X3 size={12} style={{ marginRight: 4 }} />
              Tools
            </div>
            <div className="conv-tools-grid">
              {TOOLS.map(tool => (
                <button
                  key={tool.id}
                  className={`conv-tool-btn ${activeTool === tool.id ? 'conv-tool-btn--active' : ''}`}
                  style={{ '--tool-color': tool.color } as React.CSSProperties}
                  onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                  title={tool.description}
                >
                  <span className="conv-tool-btn__icon" style={{ color: tool.color }}>
                    {tool.icon}
                  </span>
                  <span className="conv-tool-btn__label">{tool.label}</span>
                </button>
              ))}
            </div>
            {activeTool && (
              <div className="conv-tool-hint">
                {(activeTool === 'stat' || activeTool === 'item' || activeTool === 'perk' || activeTool === 'alignment')
                  ? `Click a <strong>choice</strong> on the canvas to apply <strong>${TOOLS.find(t => t.id === activeTool)?.label}</strong>`
                  : `Click a <strong>node</strong> on the canvas to apply <strong>${TOOLS.find(t => t.id === activeTool)?.label}</strong>`}
                . Press Escape to cancel.
              </div>
            )}
          </div>

          {/* === Node/Choice Properties (when selected) === */}
          {selection.type === 'thread' && selectedThread && (
            <div className="conv-props__section">
              <div className="conv-props__section-title">Thread Properties</div>
              <div className="conv-props__field">
                <label className="conv-props__label">Type</label>
                <span className={`conv-type-badge conv-type-badge--${selectedThread.type}`}>
                  {threadIcon(selectedThread.type)} {threadLabel(selectedThread.type)}
                </span>
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Title</label>
                <input
                  className="conv-props__input"
                  value={selectedThread.title}
                  onChange={e => {
                    setThreads(prev => prev.map(t =>
                      t.id === selectedThread.id ? { ...t, title: e.target.value } : t
                    ));
                  }}
                  onBlur={() => {
                    apiFetch(`/conversations/${sceneId}/threads/${selectedThread.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ title: selectedThread.title })
                    }).catch(console.error);
                  }}
                />
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Participants</label>
                {selectedThread.participants.map(p => (
                  <div key={p} className="conv-participant" style={{ marginBottom: 2 }}>
                    <div className={`conv-participant__avatar ${isPlayerCharacter(p) ? 'conv-participant__avatar--player' : ''}`}>
                      {getParticipantLetter(p)}
                    </div>
                    {getParticipantDisplayName(p)}
                  </div>
                ))}
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Proximity Radius</label>
                <input
                  className="conv-props__input"
                  type="number"
                  step="0.5"
                  value={selectedThread.proximityRadius}
                  onChange={e => {
                    setThreads(prev => prev.map(t =>
                      t.id === selectedThread.id ? { ...t, proximityRadius: Number(e.target.value) } : t
                    ));
                  }}
                  onBlur={() => {
                    apiFetch(`/conversations/${sceneId}/threads/${selectedThread.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ proximityRadius: selectedThread.proximityRadius })
                    }).catch(console.error);
                  }}
                />
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Status</label>
                <div className={`conv-toggle ${selectedThread.isActive ? 'conv-toggle--active' : ''}`}
                  onClick={() => {
                    const newActive = !selectedThread.isActive;
                    setThreads(prev => prev.map(t =>
                      t.id === selectedThread.id ? { ...t, isActive: newActive } : t
                    ));
                    apiFetch(`/conversations/${sceneId}/threads/${selectedThread.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ isActive: newActive })
                    }).catch(console.error);
                  }}
                >
                  <div className="conv-toggle__knob" />
                </div>
              </div>
              <div className="conv-props__field" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {(selectedThread.nodes || []).length} nodes · {(selectedThread.nodes || []).reduce((s, n) => s + (n.choices?.length || 0), 0)} choices
              </div>

              <div style={{ marginTop: 0.5 }}>
                <button className="conv-btn conv-btn--danger" onClick={() => handleDeleteThread(selectedThread.id)}>
                  <Trash2 size={12} /> Delete Thread
                </button>
              </div>

              {/* Add Node Form */}
              <div className="conv-props__section" style={{ marginTop: '0.5rem' }}>
                <div className="conv-props__section-title">Add Node</div>
                <div className="conv-props__field">
                  <label className="conv-props__label">Speaker</label>
                  <select
                    className="conv-props__select"
                    value={newNodeSpeaker}
                    onChange={e => setNewNodeSpeaker(e.target.value)}
                  >
                    <option value="">Select speaker...</option>
                    {selectedThread.participants.map(p => (
                      <option key={p} value={p}>{getParticipantDisplayName(p)}</option>
                    ))}
                  </select>
                </div>
                <div className="conv-props__field">
                  <label className="conv-props__label">Speech</label>
                  <textarea
                    className="conv-props__textarea"
                    value={newNodeSpeech}
                    onChange={e => setNewNodeSpeech(e.target.value)}
                    placeholder="What do they say..."
                    rows={3}
                  />
                </div>
                <button
                  className="conv-btn conv-btn--primary"
                  style={{ width: '100%' }}
                  onClick={() => handleAddNode(selectedThread.id)}
                >
                  <Plus size={12} /> Add Node
                </button>
              </div>
            </div>
          )}

          {selection.type === 'node' && selectedNode && (
            <div className="conv-props__section">
              <div className="conv-props__section-title">Node Properties</div>
              <div className="conv-props__field">
                <label className="conv-props__label">Speaker</label>
                <div className="conv-participant">
                  <div className={`conv-participant__avatar ${isPlayerCharacter(selectedNode.speakerPath) ? 'conv-participant__avatar--player' : ''}`}>
                    {getParticipantLetter(selectedNode.speakerPath)}
                  </div>
                  {getParticipantDisplayName(selectedNode.speakerPath)}
                </div>
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Speech</label>
                <textarea
                  className="conv-props__textarea"
                  value={selectedNode.speech}
                  onChange={e => {
                    setThreads(prev => prev.map(t => ({
                      ...t,
                      nodes: (t.nodes || []).map(n =>
                        n.id === selectedNode.id ? { ...n, speech: e.target.value } : n
                      )
                    })));
                  }}
                  onBlur={() => handleUpdateNode(selectedNode.id, { speech: selectedNode.speech })}
                  rows={4}
                />
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Action / Stage Direction</label>
                <input
                  className="conv-props__input"
                  value={selectedNode.action || ''}
                  onChange={e => {
                    setThreads(prev => prev.map(t => ({
                      ...t,
                      nodes: (t.nodes || []).map(n =>
                        n.id === selectedNode.id ? { ...n, action: e.target.value || null } : n
                      )
                    })));
                  }}
                  onBlur={() => handleUpdateNode(selectedNode.id, { action: selectedNode.action })}
                  placeholder="Italic action text..."
                />
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Alignment</label>
                <select
                  className="conv-props__select"
                  value={selectedNode.alignment || ''}
                  onChange={e => {
                    const val = e.target.value || null;
                    setThreads(prev => prev.map(t => ({
                      ...t,
                      nodes: (t.nodes || []).map(n =>
                        n.id === selectedNode.id ? { ...n, alignment: val } : n
                      )
                    })));
                  }}
                  onBlur={() => handleUpdateNode(selectedNode.id, { alignment: selectedNode.alignment })}
                >
                  <option value="">None</option>
                  <option value="good">Good</option>
                  <option value="neutral">Neutral</option>
                  <option value="evil">Evil</option>
                </select>
              </div>
              <div className="conv-props__row">
                <div className="conv-props__field">
                  <label className="conv-props__label">X</label>
                  <input className="conv-props__input" type="number" value={Math.round(selectedNode.x)}
                    onChange={e => setThreads(prev => prev.map(t => ({
                      ...t, nodes: (t.nodes || []).map(n => n.id === selectedNode.id ? { ...n, x: Number(e.target.value) } : n)
                    })))}
                    onBlur={() => handleUpdateNode(selectedNode.id, { x: selectedNode.x })}
                  />
                </div>
                <div className="conv-props__field">
                  <label className="conv-props__label">Y</label>
                  <input className="conv-props__input" type="number" value={Math.round(selectedNode.y)}
                    onChange={e => setThreads(prev => prev.map(t => ({
                      ...t, nodes: (t.nodes || []).map(n => n.id === selectedNode.id ? { ...n, y: Number(e.target.value) } : n)
                    })))}
                    onBlur={() => handleUpdateNode(selectedNode.id, { y: selectedNode.y })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 0.5, display: 'flex', gap: 0.3 }}>
                <button className="conv-btn conv-btn--danger conv-btn--sm" onClick={() => handleDeleteNode(selectedNode.id)}>
                  <Trash2 size={12} /> Delete
                </button>
                {selectedThread?.type === 'interactive' && (
                  <button className="conv-btn conv-btn--sm" onClick={() => handleAddChoice(selectedNode.id)}>
                    <Plus size={12} /> Add Choice
                  </button>
                )}
              </div>
            </div>
          )}

          {selection.type === 'choice' && selectedChoice && (
            <div className="conv-props__section">
              <div className="conv-props__section-title">Choice Properties</div>
              <div className="conv-props__field">
                <label className="conv-props__label">Text</label>
                <textarea
                  className="conv-props__textarea"
                  value={selectedChoice.text}
                  onChange={e => handleUpdateChoice(selectedChoice.id, { text: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Target Node</label>
                <select
                  className="conv-props__select"
                  value={selectedChoice.targetNodeId || ''}
                  onChange={e => handleUpdateChoice(selectedChoice.id, { targetNodeId: e.target.value || null })}
                >
                  <option value="">End conversation</option>
                  {allNodes.map(n => (
                    <option key={n.id} value={n.id}>{n.speakerPath}: {n.speech?.substring(0, 40) || '(empty)'}</option>
                  ))}
                </select>
              </div>
              <div className="conv-props__field">
                <label className="conv-props__label">Alignment</label>
                <select
                  className="conv-props__select"
                  value={selectedChoice.alignment || ''}
                  onChange={e => handleUpdateChoice(selectedChoice.id, { alignment: e.target.value || null })}
                >
                  <option value="">None</option>
                  <option value="good">Good</option>
                  <option value="neutral">Neutral</option>
                  <option value="evil">Evil</option>
                </select>
              </div>

              {/* Choice Outcomes */}
              <div className="conv-props__field">
                <label className="conv-props__label">Alignment Shift</label>
                <input
                  className="conv-props__input"
                  type="number"
                  value={selectedChoice.outcomes?.alignmentShift || 0}
                  onChange={e => handleUpdateChoice(selectedChoice.id, {
                    outcomes: { ...selectedChoice.outcomes, alignmentShift: Number(e.target.value) }
                  })}
                />
              </div>

              {/* Applied Tools listing (only shown when tools are attached) */}
              {(() => {
                const outs = selectedChoice.outcomes || { statChanges: [], itemsGranted: [], perksUnlocked: [], alignmentShift: 0 };
                const conds = selectedChoice.conditions || [];
                const hasTools = (outs.statChanges?.length > 0) || (outs.itemsGranted?.length > 0) || (outs.perksUnlocked?.length > 0) || (outs.alignmentShift || 0) !== 0 || conds.length > 0;
                if (!hasTools) return null;

                return (
                  <div className="conv-props__field">
                    <label className="conv-props__label">Applied Tools</label>

                    {/* Stat Changes */}
                    {(outs.statChanges || []).map((s: any, i: number) => (
                      <div key={`stat-${i}`} className="conv-choice-tool-row">
                        <span className="conv-choice-tool-row__icon" style={{ color: '#22c55e' }}>
                          <TrendingUp size={12} />
                        </span>
                        <span className="conv-choice-tool-row__label">Stat Boost</span>
                        <span className="conv-choice-tool-row__value">{s.statId} +{s.amount}</span>
                        <button
                          className="conv-choice-tool-row__remove"
                          onClick={() => handleUpdateChoice(selectedChoice.id, {
                            outcomes: { ...outs, statChanges: (outs.statChanges || []).filter((_: any, idx: number) => idx !== i) }
                          })}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Item Grants */}
                    {(outs.itemsGranted || []).map((it: any, i: number) => (
                      <div key={`item-${i}`} className="conv-choice-tool-row">
                        <span className="conv-choice-tool-row__icon" style={{ color: '#60a5fa' }}>
                          <Gift size={12} />
                        </span>
                        <span className="conv-choice-tool-row__label">Item Grant</span>
                        <span className="conv-choice-tool-row__value">{it.itemId} x{it.quantity}</span>
                        <button
                          className="conv-choice-tool-row__remove"
                          onClick={() => handleUpdateChoice(selectedChoice.id, {
                            outcomes: { ...outs, itemsGranted: (outs.itemsGranted || []).filter((_: any, idx: number) => idx !== i) }
                          })}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Perk Unlocks */}
                    {(outs.perksUnlocked || []).map((p: string, i: number) => (
                      <div key={`perk-${i}`} className="conv-choice-tool-row">
                        <span className="conv-choice-tool-row__icon" style={{ color: '#a78bfa' }}>
                          <Award size={12} />
                        </span>
                        <span className="conv-choice-tool-row__label">Perk Unlock</span>
                        <span className="conv-choice-tool-row__value">{p}</span>
                        <button
                          className="conv-choice-tool-row__remove"
                          onClick={() => handleUpdateChoice(selectedChoice.id, {
                            outcomes: { ...outs, perksUnlocked: (outs.perksUnlocked || []).filter((_: string, idx: number) => idx !== i) }
                          })}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Alignment Shift */}
                    {(outs.alignmentShift || 0) !== 0 && (
                      <div className="conv-choice-tool-row">
                        <span className="conv-choice-tool-row__icon" style={{ color: '#ec4899' }}>
                          <AlertTriangle size={12} />
                        </span>
                        <span className="conv-choice-tool-row__label">Alignment Shift</span>
                        <span className="conv-choice-tool-row__value">{outs.alignmentShift > 0 ? '+' : ''}{outs.alignmentShift}</span>
                        <button
                          className="conv-choice-tool-row__remove"
                          onClick={() => handleUpdateChoice(selectedChoice.id, {
                            outcomes: { ...outs, alignmentShift: 0 }
                          })}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {/* Conditions */}
                    {conds.map((cond: ChoiceCondition, i: number) => {
                      const typeLabels: Record<ConditionType, string> = { quest: 'Quest Stage', stat: 'Stat Check', item: 'Item Check', flag: 'Flag Check' };
                      const displayValue = cond.type === 'stat' || cond.type === 'quest'
                        ? `${cond.fieldId} >= ${cond.minValue}`
                        : `${cond.fieldId}`;
                      return (
                        <div key={`cond-${i}`} className="conv-choice-tool-row">
                          <span className="conv-choice-tool-row__icon" style={{ color: '#f97316' }}>
                            <Shield size={12} />
                          </span>
                          <span className="conv-choice-tool-row__label">{typeLabels[cond.type]}</span>
                          <span className="conv-choice-tool-row__value">{displayValue}</span>
                          <button
                            className="conv-choice-tool-row__remove"
                            onClick={() => handleUpdateChoice(selectedChoice.id, {
                              conditions: conds.filter((_: ChoiceCondition, idx: number) => idx !== i)
                            })}
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Condition Editor */}
              {(() => {
                const safeConds = Array.isArray(selectedChoice?.conditions) ? selectedChoice.conditions : [];
                return (
                  <div className="conv-props__field" style={{ marginTop: '0.5rem' }}>
                    <label className="conv-props__label">Conditions ({safeConds.length})</label>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      Choice hidden unless all conditions are met
                    </div>
                    {safeConds.map((cond: ChoiceCondition, i: number) => {
                      const typeLabels: Record<ConditionType, string> = { quest: 'Quest Stage', stat: 'Stat Check', item: 'Item Check', flag: 'Flag Check' };
                      return (
                        <div key={i} className="conv-props__field" style={{ background: 'rgba(249,115,22,0.08)', borderRadius: '4px', padding: '0.3rem 0.5rem', marginBottom: '0.25rem', border: '1px solid rgba(249,115,22,0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                            <Shield size={10} style={{ color: '#f97316' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#f97316' }}>{typeLabels[cond.type]}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {cond.type === 'stat' || cond.type === 'quest' ? `${cond.fieldId} >= ${cond.minValue}` : `${cond.fieldId}`}
                            </span>
                            <button className="conv-choice-tool-row__remove" onClick={() => handleUpdateChoice(selectedChoice.id, { conditions: safeConds.filter((_: ChoiceCondition, idx: number) => idx !== i) })}><X size={10} /></button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select className="conv-props__select" style={{ fontSize: '0.65rem', flex: 1 }} value={cond.type} onChange={e => {
                              const newType = e.target.value as ConditionType;
                              const updated: ChoiceCondition = { ...cond, type: newType, fieldId: '' };
                              if (newType === 'quest' || newType === 'stat') updated.minValue = 0;
                              else delete updated.minValue;
                              handleUpdateChoice(selectedChoice.id, { conditions: safeConds.map((_: ChoiceCondition, idx: number) => idx === i ? updated : _) });
                            }}>
                              <option value="quest">Quest Stage</option>
                              <option value="stat">Stat Check</option>
                              <option value="item">Item Check</option>
                              <option value="flag">Flag Check</option>
                            </select>
                            <input className="conv-props__input" style={{ fontSize: '0.65rem', flex: 1 }} placeholder={cond.type === 'flag' ? 'flag name' : 'field id'} value={cond.fieldId} onChange={e => handleUpdateChoice(selectedChoice.id, { conditions: safeConds.map((_: ChoiceCondition, idx: number) => idx === i ? { ...cond, fieldId: e.target.value } : _) })} />
                            {(cond.type === 'quest' || cond.type === 'stat') && (
                              <input className="conv-props__input" type="number" style={{ fontSize: '0.65rem', width: '50px' }} placeholder="min" value={cond.minValue ?? ''} onChange={e => handleUpdateChoice(selectedChoice.id, { conditions: safeConds.map((_: ChoiceCondition, idx: number) => idx === i ? { ...cond, minValue: Number(e.target.value) } : _) })} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button className="conv-btn conv-btn--sm" style={{ marginTop: '0.25rem', width: '100%' }} onClick={() => {
                      const newCond: ChoiceCondition = { id: crypto.randomUUID(), type: 'quest', fieldId: '', minValue: 1 };
                      handleUpdateChoice(selectedChoice.id, { conditions: [...safeConds, newCond] });
                    }}>
                      <Plus size={10} /> Add Condition
                    </button>
                  </div>
                );
              })()}

              <div style={{ marginTop: 0.5 }}>
                <button className="conv-btn conv-btn--danger conv-btn--sm" onClick={() => handleDeleteChoice(selectedChoice.id)}>
                  <Trash2 size={12} /> Delete Choice
                </button>
              </div>
            </div>
          )}

          {/* No selection */}
          {selection.type === 'none' && !selectedParticipant && (
            <div className="conv-props__section">
              <div className="conv-empty" style={{ padding: '1rem 0' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Select a participant to begin editing conversations.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="conv-designer__status">
        <span>{participants.length} participants · {threads.length} threads · {totalNodes} nodes · {totalChoices} choices</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
