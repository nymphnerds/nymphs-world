/**
 * llmService unit tests
 *
 * All HTTP calls are mocked (axios). Tool service is mocked for the tool-loop
 * tests. Config is mocked with sensible defaults.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';

// -- Mocks --

vi.mock('../../../src/config.js', () => ({
  default: {
    llm: {
      baseUrl: 'http://localhost:11434',
      apiKey: '',
      modelName: 'qwen3.6-27b',
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
      frequencyPenalty: 0,
      presencePenalty: 0,
      seed: 0,
    },
  },
}));

vi.mock('../../../src/services/toolService.js', () => ({
  executeTool: vi.fn(),
  getToolDefinitions: vi.fn(() => []),
}));

vi.mock('../../../src/services/codexService.js', () => ({
  fetchCodexModels: vi.fn(),
  sendCodexCreativeTurn: vi.fn(),
}));

import * as toolService from '../../../src/services/toolService.js';
import * as codexService from '../../../src/services/codexService.js';
import * as llmService from '../../../src/services/llmService.js';

// Grab mocked exports as typed mocks
const mockExecuteTool = vi.mocked(toolService.executeTool);
const mockGetToolDefinitions = vi.mocked(toolService.getToolDefinitions);
const mockFetchCodexModels = vi.mocked(codexService.fetchCodexModels);
const mockSendCodexCreativeTurn = vi.mocked(codexService.sendCodexCreativeTurn);

// -- Helpers --

const BASE = 'http://localhost:11434';
const SETTINGS = { baseUrl: BASE, apiKey: 'test-key', modelName: 'llama3', maxTokens: 100, temperature: 0.7 };

// -- Tests --

describe('llmService', () => {
  let axiosPostSpy: any;
  let axiosGetSpy: any;

  beforeEach(() => {
    axiosPostSpy = vi.spyOn(axios, 'post');
    axiosGetSpy = vi.spyOn(axios, 'get');
    mockGetToolDefinitions.mockReturnValue([]);
    mockExecuteTool.mockReset();
    mockFetchCodexModels.mockReset();
    mockSendCodexCreativeTurn.mockReset();
    axiosPostSpy.mockReset();
    axiosGetSpy.mockReset();
  });

  afterEach(() => {
    axiosPostSpy.mockRestore();
    axiosGetSpy.mockRestore();
  });

  // ── fetchModels ──

  describe('fetchModels()', () => {
    it('returns OpenAI-compatible models', async () => {
      axiosGetSpy.mockResolvedValue({ data: { data: [{ id: 'm1' }, { id: 'm2' }] } });
      const models = await llmService.fetchModels({ ...SETTINGS, serverType: 'openai' });
      expect(models).toEqual(['m1', 'm2']);
    });

    it('returns Ollama models', async () => {
      axiosGetSpy.mockResolvedValue({ data: { models: [{ name: 'ollama1' }, { name: 'ollama2' }] } });
      const models = await llmService.fetchModels({ ...SETTINGS, serverType: 'ollama' });
      expect(models).toEqual(['ollama1', 'ollama2']);
    });

    it('throws when no baseUrl configured', async () => {
      await expect(llmService.fetchModels({ baseUrl: '', serverType: 'openai' })).rejects.toThrow(/No base URL/);
    });

    it('throws on HTTP error', async () => {
      axiosGetSpy.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(llmService.fetchModels(SETTINGS)).rejects.toThrow(/Failed to fetch models/);
    });

    it('routes Codex model listing through the Codex app-server adapter', async () => {
      mockFetchCodexModels.mockResolvedValue(['gpt-codex']);
      const models = await llmService.fetchModels({ providerId: 'codex' });
      expect(models).toEqual(['gpt-codex']);
      expect(axiosGetSpy).not.toHaveBeenCalled();
    });
  });

  // ── testConnection ──

  describe('testConnection()', () => {
    it('returns success when models fetched', async () => {
      axiosGetSpy.mockResolvedValue({ data: { data: [{ id: 'm1' }] } });
      const result = await llmService.testConnection({ ...SETTINGS, serverType: 'openai' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it('returns failure on error', async () => {
      axiosGetSpy.mockRejectedValue(new Error('refused'));
      const result = await llmService.testConnection(SETTINGS);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });

  // ── sendChatMessage (no tools) ──

  describe('sendChatMessage() — basic', () => {
    it('returns assistant response', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'Hello!' } }] },
      });
      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Hi' }],
        'my doc', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.role).toBe('assistant');
      expect(resp.content).toBe('Hello!');
    });

    it('routes Codex chat through the Codex creative adapter', async () => {
      mockSendCodexCreativeTurn.mockResolvedValue({
        role: 'assistant',
        content: 'Codex worldbuilding reply',
        provider: 'codex',
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Draft a character bio' }],
        'current lore', 'system prompt', undefined, { providerId: 'codex' }, 'testuser'
      );

      expect(resp.content).toBe('Codex worldbuilding reply');
      expect(mockSendCodexCreativeTurn).toHaveBeenCalledWith(expect.objectContaining({
        documentContent: 'current lore',
        purpose: 'chat',
        username: 'testuser',
      }));
      expect(axiosPostSpy).not.toHaveBeenCalled();
    });

    it('includes document content in system prompt', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'ok' } }] },
      });
      await llmService.sendChatMessage([], 'secret doc', '', undefined, SETTINGS, 'testuser');
      const body = axiosPostSpy.mock.calls[0][1];
      expect(body.messages[0].content).toContain('secret doc');
    });

    it('includes custom system prompt when provided', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'ok' } }] },
      });
      await llmService.sendChatMessage([], '', 'CUSTOM PROMPT', undefined, SETTINGS, 'testuser');
      const body = axiosPostSpy.mock.calls[0][1];
      expect(body.messages[0].content).toContain('CUSTOM PROMPT');
    });

    it('throws when server refuses connection', async () => {
      axiosPostSpy.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        llmService.sendChatMessage([], '', undefined, undefined, SETTINGS, 'testuser')
      ).rejects.toThrow(/ECONNREFUSED|LLM request failed/);
    });
  });

  // ── Tool-Calling Loop ──

  describe('sendChatMessage() — tool loop', () => {
    it('single tool call → tool result → final answer', async () => {
      mockGetToolDefinitions.mockReturnValue([{
        type: 'function',
        function: { name: 'read_file', description: 'read', parameters: {} },
      }]);
      mockExecuteTool.mockResolvedValue('file content');

      axiosPostSpy.mockImplementation(async () => {
        if (axiosPostSpy.mock.calls.length === 1) {
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call1', function: { name: 'read_file', arguments: '{}' } }] } }] },
          };
        }
        return { data: { choices: [{ message: { content: 'Final answer' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Read file' }], '', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.content).toBe('Final answer');
      expect(resp.toolActivity!.length).toBe(1);
      expect(resp.toolActivity![0].tool).toBe('read_file');
      expect(resp.toolActivity![0].status).toBe('complete');
    });

    it('tool error → error returned in tool activity', async () => {
      mockGetToolDefinitions.mockReturnValue([{
        type: 'function',
        function: { name: 'read_file', description: 'read', parameters: {} },
      }]);
      mockExecuteTool.mockRejectedValue(new Error('file not found'));

      axiosPostSpy.mockImplementation(async () => {
        if (axiosPostSpy.mock.calls.length === 1) {
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call1', function: { name: 'read_file', arguments: '{"file_path":"test.txt"}' } }] } }] },
          };
        }
        return { data: { choices: [{ message: { content: 'Handled error' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Read file' }], '', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.content).toBe('Handled error');
      expect(resp.toolActivity![0].status).toBe('error');
      expect((resp.toolActivity![0] as any).error).toBeDefined();
    });

    it('max turns reached → returns limit message', async () => {
      mockGetToolDefinitions.mockReturnValue([{
        type: 'function',
        function: { name: 'read_file', description: 'read', parameters: {} },
      }]);
      mockExecuteTool.mockResolvedValue('loop');

      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { tool_calls: [{ id: 'x', function: { name: 'read_file', arguments: '{"file_path":"test.txt"}' } }] } }] },
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Loop' }], '', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.content).toContain('maximum number of tool calls');
    });

    it('no tools enabled → no tools sent to LLM', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'no tools' } }] },
      });
      await llmService.sendChatMessage([{ role: 'user', content: 'hi' }], '', '', undefined, SETTINGS, 'testuser');
      const body = axiosPostSpy.mock.calls[0][1];
      expect(body.tools).toBeUndefined();
    });

    it('tool activity tracking — correct status transitions', async () => {
      mockGetToolDefinitions.mockReturnValue([{
        type: 'function',
        function: { name: 'web_search', description: 'search', parameters: {} },
      }]);
      mockExecuteTool.mockResolvedValue('results');

      axiosPostSpy.mockImplementation(async () => {
        if (axiosPostSpy.mock.calls.length === 1) {
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'web_search', arguments: '{"query":"test"}' } }] } }] },
          };
        }
        return { data: { choices: [{ message: { content: 'done' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Search' }], '', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.toolActivity![0].tool).toBe('web_search');
      expect(resp.toolActivity![0].status).toBe('complete');
    });

    it('multiple tools in sequence', async () => {
      mockGetToolDefinitions.mockReturnValue([
        { type: 'function', function: { name: 'read_file', description: 'r', parameters: {} } },
        { type: 'function', function: { name: 'web_search', description: 's', parameters: {} } },
      ]);
      mockExecuteTool.mockResolvedValue('result');

      axiosPostSpy.mockImplementation(async () => {
        const n = axiosPostSpy.mock.calls.length;
        if (n === 1) return { data: { choices: [{ message: { tool_calls: [{ id: 'a', function: { name: 'read_file', arguments: '{"file_path":"x.txt"}' } }] } }] } };
        if (n === 2) return { data: { choices: [{ message: { tool_calls: [{ id: 'b', function: { name: 'web_search', arguments: '{"query":"y"}' } }] } }] } };
        return { data: { choices: [{ message: { content: 'both done' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Multi' }], '', '', undefined, SETTINGS, 'testuser'
      );
      expect(resp.content).toBe('both done');
      expect(resp.toolActivity!.length).toBe(2);
    });
  });

  // ── sendCompletion ──

  describe('sendCompletion()', () => {
    it('returns completion text', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'Once upon...' } }] },
      });
      const resp = await llmService.sendCompletion('Once', 'MyStory', 200, SETTINGS);
      expect(resp.completion).toBe('Once upon...');
    });
  });

  // ── generateDocument ──

  describe('generateDocument()', () => {
    it('returns generated HTML', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: '<h2>Hero</h2>' } }] },
      });
      const resp = await llmService.generateDocument('a brave hero', 'character', '', SETTINGS);
      expect(resp.html).toBe('<h2>Hero</h2>');
    });
  });

  // ── LLM File Creation via Tool Loop ──

  describe('sendChatMessage() — LLM file creation via tools', () => {
    beforeEach(() => {
      // Simulate the tool instructions being active — return file tools
      mockGetToolDefinitions.mockReturnValue([
        { type: 'function', function: { name: 'list_directory', description: 'list', parameters: {} } },
        { type: 'function', function: { name: 'write_file', description: 'write', parameters: {} } },
        { type: 'function', function: { name: 'read_file', description: 'read', parameters: {} } },
      ]);
    });

    it('list folder → write .html file → final answer (character creation)', async () => {
      mockExecuteTool.mockImplementation((toolName: string, toolArgs: any) => {
        if (toolName === 'list_directory') {
          return Promise.resolve(`Directory listing for NPCs/:\n  JimmyDog.html`);
        }
        if (toolName === 'write_file') {
          return Promise.resolve(`File created/updated: ${toolArgs.file_path}`);
        }
        return Promise.resolve('');
      });

      axiosPostSpy.mockImplementation(async () => {
        const callIndex = axiosPostSpy.mock.calls.length;
        if (callIndex === 1) {
          // Turn 1: LLM decides to list the NPCs folder
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call_list', function: { name: 'list_directory', arguments: '{"dir_path":"NPCs/"}' } }] } }] },
          };
        }
        if (callIndex === 2) {
          // Turn 2: LLM decides to write the file
          const writeArgs = JSON.stringify({
            file_path: "NPCs/Jack.html",
            content: "<!-- Build: Yes -->\n<!-- Template: Character -->\n<h2>Character</h2>\n<p><strong>Name:</strong> Jack</p>\n<p><strong>Role:</strong> Tavern Keeper</p>"
          });
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call_write', function: { name: 'write_file', arguments: writeArgs } }] } }] },
          };
        }
        // Turn 3: Final answer
        return { data: { choices: [{ message: { content: "I've created Jack.html in the NPCs folder." } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Create a new NPC called Jack' }],
        '', '', undefined, SETTINGS, 'testuser'
      );

      expect(resp.content).toContain('Jack.html');
      expect(resp.toolActivity!.length).toBe(2);
      expect(resp.toolActivity![0].tool).toBe('list_directory');
      expect(resp.toolActivity![0].status).toBe('complete');
      expect(resp.toolActivity![1].tool).toBe('write_file');
      expect(resp.toolActivity![1].status).toBe('complete');

      // Verify mock calls: .html extension, correct folder, template metadata
      const writeCall = mockExecuteTool.mock.calls.find((c) => c[0] === 'write_file');
      expect(writeCall).toBeDefined();
      const writeArgs: any = writeCall![1];
      expect(writeArgs.file_path).toMatch(/\.html$/);
      expect(writeArgs.file_path).toContain('NPCs/');
      expect(writeArgs.content).toContain('<!-- Build: Yes -->');
      expect(writeArgs.content).toContain('<!-- Template: Character -->');
    });

    it('write_file rejects non-html extension → tool returns error', async () => {
      mockExecuteTool.mockImplementation((toolName: string, args: any) => {
        if (toolName === 'write_file') {
          // If the LLM tries to create a .txt file, simulate an error
          if (args.file_path.endsWith('.txt')) {
            return Promise.reject(new Error('Document files must use .html extension'));
          }
          return Promise.resolve(`File created/updated: ${args.file_path}`);
        }
        return Promise.resolve('');
      });

      axiosPostSpy.mockImplementation(async () => {
        const callIndex = axiosPostSpy.mock.calls.length;
        if (callIndex === 1) {
          // LLM incorrectly tries to create a .txt file
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call1', function: { name: 'write_file', arguments: '{"file_path":"NPCs/Jack.txt","content":"plain text"}' } }] } }] },
          };
        }
        // LLM recovers and tries again with .html
        if (callIndex === 2) {
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'call2', function: { name: 'write_file', arguments: '{"file_path":"NPCs/Jack.html","content":"<!-- Build: Yes -->"}' } }] } }] },
          };
        }
        return { data: { choices: [{ message: { content: 'Created with correct extension.' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Create NPC Jack' }],
        '', '', undefined, SETTINGS, 'testuser'
      );

      expect(resp.content).toContain('correct extension');
      expect(resp.toolActivity!.length).toBe(2);
      expect(resp.toolActivity![0].status).toBe('error');
      expect((resp.toolActivity![0] as any).error).toContain('.html');
      expect(resp.toolActivity![1].status).toBe('complete');
    });

    it('location creation — semantic mapping to Locations/ folder', async () => {
      mockExecuteTool.mockImplementation((toolName: string, toolArgs: any) => {
        if (toolName === 'list_directory') {
          return Promise.resolve(`Directory listing for Locations/:\n  (empty)`);
        }
        if (toolName === 'write_file') {
          return Promise.resolve(`File created/updated: ${toolArgs.file_path}`);
        }
        return Promise.resolve('');
      });

      axiosPostSpy.mockImplementation(async () => {
        const callIndex = axiosPostSpy.mock.calls.length;
        if (callIndex === 1) {
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'list_directory', arguments: '{"dir_path":"Locations/"}' } }] } }] },
          };
        }
        if (callIndex === 2) {
          const locArgs = JSON.stringify({
            file_path: "Locations/DragonPeak.html",
            content: "<!-- Build: Yes -->\n<!-- Template: Location -->\n<h2>Location</h2>\n<p><strong>Name:</strong> Dragon Peak</p>"
          });
          return {
            data: { choices: [{ message: { tool_calls: [{ id: 'c2', function: { name: 'write_file', arguments: locArgs } }] } }] },
          };
        }
        return { data: { choices: [{ message: { content: 'Location created!' } }] } };
      });

      const resp = await llmService.sendChatMessage(
        [{ role: 'user', content: 'Create a mountain where dragons live' }],
        '', '', undefined, SETTINGS, 'testuser'
      );

      expect(resp.content).toContain('Location created');
      expect(resp.toolActivity!.length).toBe(2);
      expect(resp.toolActivity![1].tool).toBe('write_file');
      expect(resp.toolActivity![1].status).toBe('complete');

      // Verify mock calls: correct folder, .html extension, location template
      const writeCall = mockExecuteTool.mock.calls.find((c) => c[0] === 'write_file');
      expect(writeCall).toBeDefined();
      const writeArgs: any = writeCall![1];
      expect(writeArgs.file_path).toContain('Locations/');
      expect(writeArgs.file_path).toMatch(/\.html$/);
      expect(writeArgs.content).toContain('<!-- Template: Location -->');
    });
  });

  // ── transcribeImage ──

  describe('transcribeImage()', () => {
    it('returns transcribed text', async () => {
      axiosPostSpy.mockResolvedValue({
        data: { choices: [{ message: { content: 'Transcribed text' } }] },
      });
      const resp = await llmService.transcribeImage('data:image/png;base64,abc', '', SETTINGS);
      expect(resp.text).toBe('Transcribed text');
    });

    it('throws when no image provided', async () => {
      await expect(llmService.transcribeImage('', '', SETTINGS)).rejects.toThrow(/No image/);
    });

    it('throws when no baseUrl configured', async () => {
      // transcribeImage falls back to config when baseUrl is empty, so it will try to connect
      axiosPostSpy.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        llmService.transcribeImage('data:image/png;base64,abc', '', { baseUrl: '' })
      ).rejects.toThrow(/Image transcription failed|ECONNREFUSED/);
    });
  });
});
