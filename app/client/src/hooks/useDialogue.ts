import { useState, useCallback } from 'react';
import {
  Scene,
  DialogueLine,
  DialogueParticipant,
  ensureDialogueFile,
  getDialogue,
  saveDialogue as saveDialogueAPI,
} from '../services/api';

// Generate a unique ID for a dialogue line
function generateLineId(): string {
  return `line_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
}

// Parse dialogue HTML into structured lines
function parseDialogueHtml(html: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find the <hr> separator — only parse content after it
  const hr = doc.querySelector('hr');
  if (!hr) return lines;

  const parent = hr.parentElement;
  if (!parent) return lines;

  let next = hr.nextElementSibling;
  let currentSpeaker = '';
  let currentSpeech = '';
  let currentAction = '';
  let order = 0;

  function flushLine() {
    if (currentSpeaker && currentSpeech.trim()) {
      lines.push({
        id: generateLineId(),
        speakerName: currentSpeaker,
        speakerPath: '',
        speech: currentSpeech.trim(),
        action: currentAction.trim(),
        order: order++,
        choices: [],
      });
    }
    currentSpeaker = '';
    currentSpeech = '';
    currentAction = '';
  }

  while (next) {
    if (next.tagName === 'H3') {
      // Flush previous line
      flushLine();
      // Extract speaker name from [Name] format
      const text = next.textContent || '';
      const match = text.match(/^\[(.+)\]$/);
      currentSpeaker = match ? match[1] : text;
    } else if (next.tagName === 'P') {
      const em = next.querySelector('em');
      if (em && next.textContent === em.textContent) {
        // Action/stage direction
        currentAction = next.textContent?.replace(/\s/g, ' ').trim() || '';
      } else if (!currentSpeech) {
        // First non-italic paragraph = speech
        currentSpeech = next.textContent || '';
      }
    }
    next = next.nextElementSibling;
  }

  // Flush last line
  flushLine();

  return lines;
}

// Convert dialogue lines back to HTML
function linesToHtml(scene: Scene, lines: DialogueLine[]): string {
  const dateStr = scene.date ? ` | <strong>Date:</strong> ${scene.date}` : '';
  let html = `<!-- Build: Yes -->\n`;
  html += `<!-- Template: Dialogue -->\n`;
  html += `<h2>Scene: ${scene.name}</h2>\n`;
  html += `<p><strong>Era:</strong> ${scene.era}${dateStr} | <strong>Location:</strong> ${scene.locationName}</p>\n`;
  html += `<hr>\n`;

  const sorted = [...lines].sort((a, b) => a.order - b.order);
  for (const line of sorted) {
    if (line.speakerName) {
      html += `<h3>[${line.speakerName}]</h3>\n`;
    }
    if (line.speech) {
      html += `<p>${line.speech}</p>\n`;
    }
    if (line.action) {
      html += `<p><em>${line.action}</em></p>\n`;
    }
  }

  return html;
}

export function useDialogue() {
  const [lines, setLines] = useState<DialogueLine[]>([]);
  const [participants, setParticipants] = useState<DialogueParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDialogue = useCallback(async (scene: Scene) => {
    try {
      setLoading(true);
      setError(null);

      // Ensure file exists
      await ensureDialogueFile(scene.id);

      // Read dialogue
      const response = await getDialogue(scene.id);
      const parsed = parseDialogueHtml(response.html);
      setLines(parsed);
      setParticipants(response.participants || []);
      return { lines: parsed, participants: response.participants || [] };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dialogue');
      setLines([]);
      setParticipants([]);
      return { lines: [], participants: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const saveDialogue = useCallback(async (scene: Scene) => {
    try {
      setSaving(true);
      setError(null);

      const html = linesToHtml(scene, lines);
      await saveDialogueAPI(scene.id, html);

      // Dispatch event to refresh file explorer
      window.dispatchEvent(new CustomEvent('wbu-files-changed'));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dialogue');
      return false;
    } finally {
      setSaving(false);
    }
  }, [lines]);

  const addLine = useCallback(() => {
    const maxOrder = lines.length > 0 ? Math.max(...lines.map(l => l.order)) : -1;
    const newLine: DialogueLine = {
      id: generateLineId(),
      speakerName: participants[0]?.name || '',
      speakerPath: participants[0]?.path || '',
      speech: '',
      action: '',
      order: maxOrder + 1,
      choices: [],
    };
    setLines(prev => [...prev, newLine]);
  }, [lines, participants]);

  const updateLine = useCallback((id: string, updates: Partial<DialogueLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const moveLineUp = useCallback((id: string) => {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const a = copy[idx];
      const b = copy[idx - 1];
      a.order = b.order;
      b.order = idx;
      copy[idx] = b;
      copy[idx - 1] = a;
      return copy;
    });
  }, []);

  const moveLineDown = useCallback((id: string) => {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const a = copy[idx];
      const b = copy[idx + 1];
      a.order = b.order;
      b.order = idx;
      copy[idx] = b;
      copy[idx + 1] = a;
      return copy;
    });
  }, []);

  const reset = useCallback(() => {
    setLines([]);
    setParticipants([]);
    setError(null);
  }, []);

  return {
    lines,
    participants,
    loading,
    saving,
    error,
    loadDialogue,
    saveDialogue,
    addLine,
    updateLine,
    removeLine,
    moveLineUp,
    moveLineDown,
    reset,
    parseDialogueHtml,
    linesToHtml,
  };
}