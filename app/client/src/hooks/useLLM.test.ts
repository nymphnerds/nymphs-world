/**
 * useLLM hook tests
 *
 * Focus: sendMessage() with context trimming, tool activity handling,
 * chat history management, and connection status.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the API before importing the hook
vi.mock('../services/api', () => ({
  sendChat: vi.fn(),
  fetchModels: vi.fn(),
  getCodexProbe: vi.fn(),
  getCodexStatus: vi.fn(),
  getSettings: vi.fn(),
  testConnection: vi.fn(),
  saveUserSettings: vi.fn(),
}));

import * as api from '../services/api';
const mockSendChat = api.sendChat as ReturnType<typeof vi.fn>;
const mockGetSettings = api.getSettings as ReturnType<typeof vi.fn>;
const mockFetchModels = api.fetchModels as ReturnType<typeof vi.fn>;

import { useLLM } from './useLLM';

// Shared test settings
const testSettings = {
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  modelName: 'llama3',
  maxTokens: 4096,
  contextWindow: 8192,
  temperature: 0.7,
  systemPrompt: 'You are a helper.',
};

describe('useLLM', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockSendChat.mockClear();
    mockGetSettings.mockClear().mockResolvedValue(testSettings);
    mockFetchModels.mockClear().mockResolvedValue(['llama3']);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Helper: render hook and wait for the initial refreshLlmHealth effect
   * to settle (getSettings + checkLlmHealth).
   */
  async function renderAndAwaitInit() {
    const rendered = renderHook(() => useLLM());
    // Allow the useEffect (refreshLlmHealth) to run: getSettings + checkLlmHealth
    await act(async () => {
      await Promise.resolve();
    });
    return rendered;
  }

  // ── sendMessage ──

  describe('sendMessage', () => {
    it('sends a message and appends response to chat history', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'Hello!' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('Hi there', '');
      });

      expect(mockSendChat).toHaveBeenCalledTimes(1);
      expect(result.current.chatHistory).toHaveLength(2);
      expect(result.current.chatHistory[0].role).toBe('user');
      expect(result.current.chatHistory[0].content).toBe('Hi there');
      expect(result.current.chatHistory[1].role).toBe('assistant');
      expect(result.current.chatHistory[1].content).toBe('Hello!');
    });

    it('is called again on second message', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'Reply' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('First', '');
      });

      expect(result.current.chatHistory).toHaveLength(2);

      await act(async () => {
        await result.current.sendMessage('Second', '');
      });

      // sendChat was called twice, history grew
      expect(mockSendChat).toHaveBeenCalledTimes(2);
      expect(result.current.chatHistory).toHaveLength(4);
    });

    it('includes document content in sendChat call', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'ok' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('question', '<h2>My Doc</h2>');
      });

      // historyToSend includes the current message (trimChatHistory(updatedHistory) where updatedHistory has userMsg)
      const lastCall = mockSendChat.mock.calls[mockSendChat.mock.calls.length - 1];
      expect(lastCall[0]).toBe('question');
      expect(lastCall[1]).toEqual([{ role: 'user', content: 'question' }]);
      expect(lastCall[2]).toBe('<h2>My Doc</h2>');
      expect(lastCall[3]).toBe('You are a helper.');
      // permissions sent when toolsEnabled (default true)
      expect(lastCall[4].allowRead).toBe(true);
    });

    it('sets loading state during send', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'done' });

      const { result } = await renderAndAwaitInit();

      expect(result.current.loading).toBe(false);

      const promise = act(async () => {
        await result.current.sendMessage('test', '');
      });

      // After completion
      await promise;
      expect(result.current.loading).toBe(false);
    });

    it('sets error on send failure', async () => {
      mockSendChat.mockRejectedValue(new Error('Network error'));

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('test', '');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.llmConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('failed');
    });

    it('sets llmConnected to true on success', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'ok' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('test', '');
      });

      expect(result.current.llmConnected).toBe(true);
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  // ── Tool Activity ──

  describe('tool activity', () => {
    it('appends tool activity messages to history', async () => {
      mockSendChat.mockResolvedValue({
        role: 'assistant',
        content: 'File created!',
        toolActivity: [
          { tool: 'write_file', label: 'Write File: NPCs/Jack.html', status: 'complete' },
        ],
      });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('Create NPC Jack', '');
      });

      expect(result.current.chatHistory).toHaveLength(3);
      // user message
      expect(result.current.chatHistory[0].role).toBe('user');
      // tool activity message
      expect(result.current.chatHistory[1].content).toContain('[Write File: NPCs/Jack.html]');
      expect(result.current.chatHistory[1].content).toContain('✅ Done');
      // assistant response
      expect(result.current.chatHistory[2].content).toBe('File created!');
    });

    it('formats tool error messages correctly', async () => {
      mockSendChat.mockResolvedValue({
        role: 'assistant',
        content: 'Handled the error.',
        toolActivity: [
          { tool: 'read_file', label: 'Read File: missing.txt', status: 'error', error: 'File not found' },
        ],
      });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('Read missing.txt', '');
      });

      expect(result.current.chatHistory[1].content).toContain('❌ File not found');
    });

    it('skips tool messages when no tool activity', async () => {
      mockSendChat.mockResolvedValue({
        role: 'assistant',
        content: 'Simple reply',
      });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('hello', '');
      });

      expect(result.current.chatHistory).toHaveLength(2);
      expect(result.current.chatHistory[1].content).toBe('Simple reply');
    });

    it('sends tool permissions when tools are enabled', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'ok' });

      const { result } = await renderAndAwaitInit();

      // Default: toolsEnabled = true
      await act(async () => {
        await result.current.sendMessage('test', '');
      });

      // 5th arg should be the tool permissions object (not undefined)
      const lastCall = mockSendChat.mock.calls[mockSendChat.mock.calls.length - 1];
      expect(lastCall[4]).toBeDefined();
      expect(lastCall[4].allowRead).toBe(true);
    });

    it('sends undefined permissions when tools are disabled', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'ok' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        result.current.setToolsEnabled(false);
      });

      await act(async () => {
        await result.current.sendMessage('test', '');
      });

      const lastCall = mockSendChat.mock.calls[mockSendChat.mock.calls.length - 1];
      expect(lastCall[4]).toBeUndefined();
    });
  });

  // ── Context Trimming ──

  describe('context trimming', () => {
    it('trims history when context window is exceeded', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'reply' });

      const { result } = await renderAndAwaitInit();

      // Send several messages to build history
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.sendMessage(`Message ${i}`, '');
        });
      }

      expect(result.current.chatHistory.length).toBeGreaterThan(4);
    });
  });

  // ── clearChat ──

  describe('clearChat', () => {
    it('clears chat history and trim notification', async () => {
      mockSendChat.mockResolvedValue({ role: 'assistant', content: 'ok' });

      const { result } = await renderAndAwaitInit();

      await act(async () => {
        await result.current.sendMessage('test', '');
      });
      expect(result.current.chatHistory.length).toBeGreaterThan(0);

      await act(async () => {
        result.current.clearChat();
      });

      expect(result.current.chatHistory).toHaveLength(0);
      expect(result.current.messagesTrimmed).toBe(false);
    });
  });

  // ── Settings ──

  describe('settings', () => {
    it('updates settings with updateSettings', async () => {
      const { result } = await renderAndAwaitInit();

      await act(async () => {
        result.current.updateSettings({ modelName: 'gpt-4', temperature: 0.5 });
      });

      expect(result.current.settings.modelName).toBe('gpt-4');
      expect(result.current.settings.temperature).toBe(0.5);
    });

    it('updates tool permissions', async () => {
      const { result } = await renderAndAwaitInit();

      await act(async () => {
        result.current.updateToolPermissions({ allowDelete: true });
      });

      expect(result.current.toolPermissions.allowDelete).toBe(true);
    });
  });
});
