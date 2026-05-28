import type { ChatMessage } from '../services/api';

/**
 * Estimate the number of tokens in a text string.
 * Uses a heuristic of ~4 characters per token, which is a reasonable
 * approximation for English text across most models.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens used by a chat history.
 */
export function historyTokenCount(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content || '');
  }, 0);
}

/**
 * Trim chat history from the oldest messages until it fits within the
 * given token budget. Always preserves at least `minMessages` messages
 * (the most recent ones) so the LLM retains recent context.
 *
 * @param messages - Full chat history (oldest first)
 * @param maxTokens - Maximum token budget for the history
 * @param minMessages - Minimum messages to always keep (default: 3)
 * @returns Trimmed history, or original if already within budget
 */
export function trimChatHistory(
  messages: ChatMessage[],
  maxTokens: number,
  minMessages: number = 3,
): ChatMessage[] {
  if (messages.length === 0) return messages;

  let currentTokens = historyTokenCount(messages);

  if (currentTokens <= maxTokens) {
    return messages;
  }

  // Keep at least minMessages (from the end)
  const minIndex = Math.max(0, messages.length - minMessages);
  let trimIndex = 0;

  // Remove oldest messages one at a time until within budget or hit minimum
  while (currentTokens > maxTokens && trimIndex < minIndex) {
    currentTokens -= estimateTokens(messages[trimIndex].content || '');
    trimIndex++;
  }

  return messages.slice(trimIndex);
}

/**
 * Calculate the token budget for chat history given a context window
 * and reserved content (system prompt + document + new message).
 *
 * @param contextWindow - Total context window size in tokens
 * @param reservedTokens - Tokens reserved for system prompt, document content, and new message
 * @param minBudget - Minimum tokens to always allocate to history (default: 1024)
 * @returns Available tokens for chat history
 */
export function calculateHistoryBudget(
  contextWindow: number,
  reservedTokens: number,
  minBudget: number = 1024,
): number {
  const budget = contextWindow - reservedTokens;
  return Math.max(minBudget, budget);
}