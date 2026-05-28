import { useState, useCallback, useEffect } from 'react';
import {
  sendChat, fetchModels, getSettings, testConnection, saveUserSettings,
  type ChatMessage, type LLMSettings,
  type ToolPermissions,
} from '../services/api';
import { estimateTokens, trimChatHistory, calculateHistoryBudget } from '../utils/tokenCounter';

/**
 * Lightweight health check — tries fetching models from the configured URL
 * to determine if the LLM server is reachable.
 */
async function checkLlmHealth(settings: LLMSettings): Promise<boolean> {
  try {
    if (!settings.baseUrl) return false;

    const token = localStorage.getItem('wbu_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const modelsRes = await fetch(
      `/api/llm/models?baseUrl=${encodeURIComponent(settings.baseUrl)}&apiKey=${encodeURIComponent(settings.apiKey)}&serverType=${encodeURIComponent(settings.serverType)}`,
      { headers }
    );
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      return modelsData.models && modelsData.models.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

const defaultSystemPrompt = `You are a helpful AI assistant for a game worldbuilder tool. The user is working on a document with the following content. Use this context to assist with writing, worldbuilding, lore, character development, and quest design.`;

const defaultSettings: LLMSettings = {
  providerId: '',
  serverType: '',
  baseUrl: '',
  apiKey: '',
  modelName: '',
  maxTokens: 4096,
  contextWindow: 8192,
  temperature: 0.7,
  topP: 1.0,
  topK: 50,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: '',
  seed: 0,
  systemPrompt: defaultSystemPrompt,
};

const defaultToolPermissions: ToolPermissions = {
  webSearch: true,
  allowRead: true,
  allowWrite: true,
  allowDelete: false,
  allowRename: false,
  allowSearch: false,
  maxSearchResults: 5,
  // Feature permissions
  allowGraph: false,
  allowTags: false,
  allowLocations: false,
  allowFiles: true,
  allowImageGen: false,
  allowReminders: false,
};

type ConnectionStatus = 'untested' | 'testing' | 'connected' | 'reachable-no-models' | 'failed';

export function useLLM() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<LLMSettings>(defaultSettings);
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [toolPermissions, setToolPermissions] = useState<ToolPermissions>(defaultToolPermissions);
  const [toolsEnabled, setToolsEnabled] = useState(true);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested');

  // Track if messages were trimmed on the last send
  const [messagesTrimmed, setMessagesTrimmed] = useState(false);

  // Load settings and perform health check
  const refreshLlmHealth = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      if (s.toolPermissions) {
        setToolPermissions(s.toolPermissions);
      }
      const healthy = await checkLlmHealth(s);
      setLlmConnected(healthy);
      setConnectionStatus(healthy ? 'connected' : 'failed');
    } catch {
      setLlmConnected(false);
      setConnectionStatus('failed');
    }
  }, []);

  // Load settings on mount and perform initial health check
  useEffect(() => {
    refreshLlmHealth();
  }, [refreshLlmHealth]);

  const sendMessage = useCallback(async (message: string, documentContent: string) => {
    setLoading(true);
    setError(null);
    try {
      const userMsg: ChatMessage = { role: 'user', content: message };
      const updatedHistory = [...chatHistory, userMsg];

      // Auto-trim chat history to stay within context window
      const contextWindow = settings.contextWindow || 8192;
      const systemPromptTokens = estimateTokens(settings.systemPrompt || '');
      const documentTokens = estimateTokens(documentContent || '');
      const messageTokens = estimateTokens(message);
      const reservedTokens = systemPromptTokens + documentTokens + messageTokens;
      const historyBudget = calculateHistoryBudget(contextWindow, reservedTokens);

      const historyToSend = trimChatHistory(updatedHistory, historyBudget, 3);

      // Notify user if messages were trimmed
      if (historyToSend.length < updatedHistory.length) {
        setMessagesTrimmed(true);
      }

      // Only send permissions if tools are enabled
      const permissions = toolsEnabled ? toolPermissions : undefined;
      const response = await sendChat(message, historyToSend, documentContent, settings.systemPrompt, permissions);
      setLlmConnected(true);
      setConnectionStatus('connected');

      // If response includes tool activity, add tool messages to history
      if (response.toolActivity && response.toolActivity.length > 0) {
        const toolMessages: ChatMessage[] = response.toolActivity.map(ta => ({
          role: 'assistant' as const,
          content: `[${ta.label}] ${ta.status === 'complete' ? '✅ Done' : ta.status === 'error' ? `❌ ${ta.error}` : ''}`,
        }));
        setChatHistory([...updatedHistory, ...toolMessages, response]);
      } else {
        setChatHistory([...updatedHistory, response]);
      }
      return response;
    } catch (err: any) {
      setError(err.message);
      setLlmConnected(false);
      setConnectionStatus('failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chatHistory, toolsEnabled, toolPermissions, settings.systemPrompt, settings.contextWindow]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    setMessagesTrimmed(false);
  }, []);

  const dismissTrimNotification = useCallback(() => {
    setMessagesTrimmed(false);
  }, []);

  const updateSettings = useCallback((partial: Partial<LLMSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveUserSettingsFn = useCallback(async (settingsToSave?: LLMSettings) => {
    setLoading(true);
    setError(null);
    try {
      const result = await saveUserSettings(settingsToSave || settings);
      setSettings(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const testConn = useCallback(async () => {
    setTesting(true);
    setError(null);
    setConnectionStatus('testing');
    try {
      const result = await testConnection(settings);
      if (result.success) {
        setLlmConnected(true);
        setConnectionStatus('connected');
      } else {
        setError(result.message);
        setLlmConnected(false);
        setConnectionStatus('failed');
      }
    } catch (err: any) {
      setError(err.message);
      setLlmConnected(false);
      setConnectionStatus('failed');
    } finally {
      setTesting(false);
    }
  }, [settings]);

  const loadModels = useCallback(async (customBaseUrl?: string, customApiKey?: string, customServerType?: string) => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = customBaseUrl || settings.baseUrl;
      const apiKey = customApiKey || settings.apiKey;
      const serverType = customServerType || settings.serverType;
      const list = await fetchModels(baseUrl || undefined, apiKey || undefined, serverType || undefined);
      setModels(list);
      // If no model is selected but models are available, select the first one
      if (list.length > 0 && !settings.modelName) {
        setSettings((prev) => ({ ...prev, modelName: list[0] }));
      }
    } catch (err: any) {
      setError(err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [settings.baseUrl, settings.apiKey, settings.serverType, settings.modelName]);

  const updateToolPermissions = useCallback((partial: Partial<ToolPermissions>) => {
    setToolPermissions((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveToolPermissions = useCallback(async (perms: ToolPermissions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await saveUserSettings({ ...settings, toolPermissions: perms });
      setToolPermissions(perms);
      setSettings(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Derived: AI is considered offline when connection is explicitly false or unknown (null = untested, treat as offline for UI)
  const aiOffline = llmConnected !== true;

  return {
    chatHistory,
    loading,
    error,
    llmConnected,
    aiOffline,
    sendMessage,
    clearChat,
    settings,
    models,
    testing,
    updateSettings,
    saveUserSettings: saveUserSettingsFn,
    testConn,
    loadModels,
    refreshLlmHealth,
    // Tool permissions
    toolPermissions,
    toolsEnabled,
    setToolsEnabled,
    updateToolPermissions,
    saveToolPermissions,
    connectionStatus,
    messagesTrimmed,
    dismissTrimNotification,
  };
}
