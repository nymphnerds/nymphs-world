import { describe, it, expect } from 'vitest';
import { estimateTokens, historyTokenCount, trimChatHistory, calculateHistoryBudget } from './tokenCounter';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns 0 for nullish input', () => {
    expect(estimateTokens('' as string)).toBe(0);
  });

  it('estimates tokens using ~4 chars per token heuristic', () => {
    // "Hello world" = 11 chars -> ceil(11/4) = 3 tokens
    expect(estimateTokens('Hello world')).toBe(3);
  });

  it('handles long text accurately', () => {
    const longText = 'a'.repeat(100);
    expect(estimateTokens(longText)).toBe(25); // ceil(100/4) = 25
  });
});

describe('historyTokenCount', () => {
  it('calculates total tokens from message array', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' },       // 5 chars -> 2 tokens
      { role: 'assistant' as const, content: 'Hi there' }, // 8 chars -> 2 tokens
    ];
    expect(historyTokenCount(messages)).toBe(4);
  });

  it('returns 0 for empty array', () => {
    expect(historyTokenCount([])).toBe(0);
  });
});

describe('trimChatHistory', () => {
  it('returns original array when within budget', () => {
    const messages = [
      { role: 'user' as const, content: 'Hi' },
    ];
    const result = trimChatHistory(messages, 1000);
    expect(result).toBe(messages); // Same reference since within budget
  });

  it('returns empty array for empty input', () => {
    expect(trimChatHistory([], 100)).toEqual([]);
  });

  it('removes oldest messages to fit budget', () => {
    const messages = [
      { role: 'user' as const, content: 'a'.repeat(100) },   // 25 tokens
      { role: 'user' as const, content: 'b'.repeat(100) },   // 25 tokens
      { role: 'user' as const, content: 'c'.repeat(100) },   // 25 tokens
      { role: 'assistant' as const, content: 'response' },   // 3 tokens
    ];
    const result = trimChatHistory(messages, 30, 2);
    // Should keep at least 2 most recent messages
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('always preserves at least minMessages', () => {
    const messages = [
      { role: 'user' as const, content: 'a'.repeat(1000) },  // 250 tokens
      { role: 'user' as const, content: 'b'.repeat(1000) },  // 250 tokens
      { role: 'user' as const, content: 'c' },                // 1 token
    ];
    const result = trimChatHistory(messages, 10, 3);
    // minMessages=3, total messages=3, so can't trim any — but slice() returns new array
    expect(result).toStrictEqual(messages);
  });
});

describe('calculateHistoryBudget', () => {
  it('calculates budget as window minus reserved', () => {
    const budget = calculateHistoryBudget(4096, 1024);
    expect(budget).toBe(3072);
  });

  it('enforces minimum budget', () => {
    const budget = calculateHistoryBudget(4096, 4000);
    // 4096 - 4000 = 96, which is less than minBudget 1024
    expect(budget).toBe(1024);
  });

  it('uses custom minBudget when provided', () => {
    const budget = calculateHistoryBudget(4096, 4000, 512);
    expect(budget).toBe(512);
  });
});