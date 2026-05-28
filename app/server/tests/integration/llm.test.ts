/**
 * LLM Chat Integration Tests
 *
 * Tests POST /api/llm/chat end-to-end with auth.
 * Mocks llmService to avoid real HTTP calls to the LLM backend.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';
// Hoist the mock spy so it's accessible inside the vi.mock factory
const { mockSendChatMessage } = vi.hoisted(() => ({
  mockSendChatMessage: vi.fn(),
}));

vi.mock('../../src/services/llmService.js', () => ({
  sendChatMessage: mockSendChatMessage,
  fetchModels: vi.fn(),
  testConnection: vi.fn(),
  sendCompletion: vi.fn(),
  generateDocument: vi.fn(),
  transcribeImage: vi.fn(),
}));

describe('POST /api/llm/chat', () => {
  let agent: any;
  let token: string;
  const username = 'integ_llm_user';

  beforeAll(async () => {
    vi.clearAllMocks();
    // Default: LLM returns a simple assistant response
    mockSendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Hello from LLM!',
    });

    const authed = await getAuthedApp(username);
    agent = authed.agent;
    token = authed.token;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without authentication', async () => {
    const unauth = getTestApp();
    const res = await unauth.post('/api/llm/chat').send({ message: 'Hello' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 400 when message is missing', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message is required');
  });

  it('returns LLM response with auth', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Tell me a story', history: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.response.role).toBe('assistant');
    expect(res.body.response.content).toBe('Hello from LLM!');
  });

  it('forwards history + document content + system prompt to llmService', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'What about the hero?',
        history: [{ role: 'user', content: 'Tell me about the world' }],
        documentContent: '<h2>MyWorld</h2><p>A fantasy realm.</p>',
        systemPrompt: 'You are a worldbuilding assistant.',
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    // Verify llmService.sendChatMessage was called
    expect(mockSendChatMessage).toHaveBeenCalled();
    const callArgs = mockSendChatMessage.mock.calls[mockSendChatMessage.mock.calls.length - 1];
    // First arg: messages (history + current user message)
    const messages = callArgs[0];
    expect(messages).toHaveLength(2); // 1 history + 1 current
    expect(messages[0].content).toBe('Tell me about the world');
    expect(messages[1].content).toBe('What about the hero?');
    // Second arg: documentContent
    expect(callArgs[1]).toBe('<h2>MyWorld</h2><p>A fantasy realm.</p>');
    // Third arg: systemPrompt
    expect(callArgs[2]).toBe('You are a worldbuilding assistant.');
  });

  it('forwards tool permissions when provided', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Read the file',
        history: [],
        permissions: {
          allowRead: true,
          allowWrite: false,
          allowFiles: true,
        },
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    // 4th arg to sendChatMessage is permissions
    const callArgs = mockSendChatMessage.mock.calls[mockSendChatMessage.mock.calls.length - 1];
    expect(callArgs[3]).toBeDefined();
    expect(callArgs[3].allowRead).toBe(true);
    expect(callArgs[3].allowWrite).toBe(false);
  });

  it('does not forward permissions when not provided', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', history: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    const callArgs = mockSendChatMessage.mock.calls[mockSendChatMessage.mock.calls.length - 1];
    expect(callArgs[3]).toBeUndefined();
  });

  it('returns 502 when llmService throws', async () => {
    mockSendChatMessage.mockRejectedValueOnce(new Error('LLM server unreachable'));

    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
  });

  it('includes tool activity in response when tools are used', async () => {
    mockSendChatMessage.mockResolvedValueOnce({
      role: 'assistant',
      content: 'The file contains important lore.',
      toolActivity: [
        { tool: 'read', label: 'Read: test.html', status: 'complete' },
      ],
    });

    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'What does test.html say?',
        history: [],
        permissions: { allowRead: true, allowFiles: true },
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.response.content).toBe('The file contains important lore.');
    expect(res.body.response.toolActivity).toBeDefined();
    expect(res.body.response.toolActivity.length).toBe(1);
    expect(res.body.response.toolActivity[0].tool).toBe('read');
    expect(res.body.response.toolActivity[0].status).toBe('complete');
  });

  it('receives username from auth middleware', async () => {
    const res = await agent
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hi' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    // 6th arg to sendChatMessage is username
    const lastCall = mockSendChatMessage.mock.calls[mockSendChatMessage.mock.calls.length - 1];
    expect(lastCall[5]).toBe(username);
  });
});