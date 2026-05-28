import { renderHook, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock API before importing the hook
vi.mock('../services/api', () => ({
  ensureDialogueFile: vi.fn(),
  getDialogue: vi.fn(),
  saveDialogue: vi.fn(),
}));

import * as api from '../services/api';
import { useDialogue } from './useDialogue';

const mockEnsureDialogueFile = api.ensureDialogueFile as ReturnType<typeof vi.fn>;
const mockGetDialogue = api.getDialogue as ReturnType<typeof vi.fn>;
const mockSaveDialogue = api.saveDialogue as ReturnType<typeof vi.fn>;

const testScene = {
  id: 'scene_1',
  name: 'Test Scene',
  era: 'Modern Era',
  locationName: 'City',
  date: '2024-06-15',
};

const sampleHtml = `<!-- Build: Yes -->
<!-- Template: Dialogue -->
<h2>Scene: Test Scene</h2>
<p><strong>Era:</strong> Modern Era | <strong>Location:</strong> City</p>
<hr>
<h3>[Alice]</h3>
<p>Hello, how are you?</p>
<p><em>She waves politely</em></p>
<h3>[Bob]</h3>
<p>I'm doing great!</p>`;

function resetApiMocks() {
  mockEnsureDialogueFile.mockReset();
  mockGetDialogue.mockReset();
  mockSaveDialogue.mockReset();
}

describe('useDialogue', () => {
  beforeEach(() => {
    resetApiMocks();
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty lines and participants', () => {
      const { result } = renderHook(() => useDialogue());
      expect(result.current.lines).toEqual([]);
      expect(result.current.participants).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.saving).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('loadDialogue', () => {
    it('loads dialogue and parses HTML into lines', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [
          { name: 'Alice', path: 'NPCs/Alice.html', type: 'npc' },
          { name: 'Bob', path: 'NPCs/Bob.html', type: 'npc' },
        ],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.lines).toHaveLength(2);
      expect(result.current.lines[0].speakerName).toBe('Alice');
      expect(result.current.lines[0].speech).toBe('Hello, how are you?');
      expect(result.current.lines[0].action).toBe('She waves politely');
      expect(result.current.lines[1].speakerName).toBe('Bob');
      expect(result.current.participants).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it('handles empty dialogue (no <hr> tag)', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: '<h2>Scene: Test Scene</h2><p>No dialogue yet</p>',
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.lines).toEqual([]);
      expect(result.current.participants).toEqual([]);
    });

    it('handles API error gracefully', async () => {
      mockEnsureDialogueFile.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
      expect(result.current.lines).toEqual([]);
    });

    it('returns loading false after successful load', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: '<hr>',
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      // Loading should be false after the operation completes
      expect(result.current.loading).toBe(false);
      expect(result.current.lines).toEqual([]);
    });
  });

  describe('saveDialogue', () => {
    it('saves dialogue and dispatches files-changed event', async () => {
      mockSaveDialogue.mockResolvedValue({ path: 'Dialogue/Test Scene.html' });

      const { result } = renderHook(() => useDialogue());

      act(() => {
        result.current.addLine();
      });

      await act(async () => {
        await result.current.saveDialogue(testScene);
      });

      expect(result.current.saving).toBe(false);
      expect(mockSaveDialogue).toHaveBeenCalledWith(testScene.id, expect.stringContaining('<hr>'));
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('handles save error', async () => {
      mockSaveDialogue.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.saveDialogue(testScene);
      });

      expect(result.current.error).toBe('Save failed');
      expect(result.current.saving).toBe(false);
    });
  });

  describe('addLine', () => {
    it('adds a new line with default speaker from first participant', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: '<hr>',
        path: 'Dialogue/Test Scene.html',
        participants: [{ name: 'Alice', path: 'NPCs/Alice.html', type: 'npc' }],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      act(() => {
        result.current.addLine();
      });

      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0].speakerName).toBe('Alice');
      expect(result.current.lines[0].speech).toBe('');
      expect(result.current.lines[0].action).toBe('');
      expect(result.current.lines[0].order).toBe(0);
    });

    it('adds line with correct order after existing lines', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [{ name: 'Alice', path: 'NPCs/Alice.html', type: 'npc' }],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.lines).toHaveLength(2);

      act(() => {
        result.current.addLine();
      });

      expect(result.current.lines).toHaveLength(3);
      expect(result.current.lines[2].order).toBe(2);
    });
  });

  describe('updateLine', () => {
    it('updates a specific line', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const lineId = result.current.lines[0].id;

      act(() => {
        result.current.updateLine(lineId, { speech: 'Updated speech', action: 'Updated action' });
      });

      expect(result.current.lines[0].speech).toBe('Updated speech');
      expect(result.current.lines[0].action).toBe('Updated action');
      expect(result.current.lines[0].speakerName).toBe('Alice');
    });

    it('does nothing for non-existent line id', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const before = [...result.current.lines];

      act(() => {
        result.current.updateLine('non_existent_id', { speech: 'Nope' });
      });

      expect(result.current.lines).toEqual(before);
    });
  });

  describe('removeLine', () => {
    it('removes a specific line', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.lines).toHaveLength(2);
      const lineId = result.current.lines[0].id;

      act(() => {
        result.current.removeLine(lineId);
      });

      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0].speakerName).toBe('Bob');
    });
  });

  describe('moveLineUp / moveLineDown', () => {
    it('moves line up', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const bobId = result.current.lines[1].id;

      act(() => {
        result.current.moveLineUp(bobId);
      });

      expect(result.current.lines[0].speakerName).toBe('Bob');
      expect(result.current.lines[1].speakerName).toBe('Alice');
    });

    it('does not move first line up', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const before = [...result.current.lines];
      const aliceId = result.current.lines[0].id;

      act(() => {
        result.current.moveLineUp(aliceId);
      });

      expect(result.current.lines).toEqual(before);
    });

    it('moves line down', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const aliceId = result.current.lines[0].id;

      act(() => {
        result.current.moveLineDown(aliceId);
      });

      expect(result.current.lines[0].speakerName).toBe('Bob');
      expect(result.current.lines[1].speakerName).toBe('Alice');
    });

    it('does not move last line down', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      const before = [...result.current.lines];
      const bobId = result.current.lines[1].id;

      act(() => {
        result.current.moveLineDown(bobId);
      });

      expect(result.current.lines).toEqual(before);
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      mockEnsureDialogueFile.mockResolvedValue({ path: 'Dialogue/Test Scene.html', existed: true });
      mockGetDialogue.mockResolvedValue({
        html: sampleHtml,
        path: 'Dialogue/Test Scene.html',
        participants: [{ name: 'Alice', path: 'NPCs/Alice.html', type: 'npc' }],
      });

      const { result } = renderHook(() => useDialogue());

      await act(async () => {
        await result.current.loadDialogue(testScene);
      });

      expect(result.current.lines).toHaveLength(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.lines).toEqual([]);
      expect(result.current.participants).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('parseDialogueHtml / linesToHtml round-trip', () => {
    it('round-trip: parse then convert preserves data', () => {
      const { result } = renderHook(() => useDialogue());

      const parsed = result.current.parseDialogueHtml(sampleHtml);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].speakerName).toBe('Alice');
      expect(parsed[0].speech).toBe('Hello, how are you?');
      expect(parsed[0].action).toBe('She waves politely');
      expect(parsed[1].speakerName).toBe('Bob');
      expect(parsed[1].speech).toBe("I'm doing great!");
      expect(parsed[1].action).toBe('');

      const html = result.current.linesToHtml(testScene, parsed);
      expect(html).toContain('[Alice]');
      expect(html).toContain('Hello, how are you?');
      expect(html).toContain('<em>She waves politely</em>');
      expect(html).toContain('[Bob]');
      expect(html).toContain("I'm doing great!");

      const reparsed = result.current.parseDialogueHtml(html);
      expect(reparsed).toHaveLength(2);
      expect(reparsed[0].speakerName).toBe('Alice');
      expect(reparsed[0].speech).toBe('Hello, how are you?');
      expect(reparsed[0].action).toBe('She waves politely');
    });

    it('parseDialogueHtml returns empty for HTML without <hr>', () => {
      const { result } = renderHook(() => useDialogue());

      const parsed = result.current.parseDialogueHtml('<h2>No separator</h2><h3>[Alice]</h3><p>Hi</p>');
      expect(parsed).toEqual([]);
    });

    it('linesToHtml includes scene header', () => {
      const { result } = renderHook(() => useDialogue());

      const html = result.current.linesToHtml(testScene, []);
      expect(html).toContain('<!-- Build: Yes -->');
      expect(html).toContain('<!-- Template: Dialogue -->');
      expect(html).toContain('Scene: Test Scene');
      expect(html).toContain('Modern Era');
      expect(html).toContain('City');
      expect(html).toContain('<hr>');
    });
  });
});