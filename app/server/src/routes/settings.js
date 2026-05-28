import express from 'express';
import config from '../config.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { getCodexStatus, readCodexAccount } from '../services/codexService.js';

const router = express.Router();

// GET /api/settings/defaults - Return server-side default settings (no auth required)
router.get('/defaults', (req, res) => {
  // Return a copy of defaults without exposing sensitive server config
  const { defaultUserSettings: defaults } = config;
  res.json({ settings: defaults });
});

// GET /api/settings - Get current user's LLM settings (auth required)
router.get('/', authMiddleware, (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const settings = config.loadUserSettings(username);
  res.json({ settings });
});

// POST /api/settings/user - Save current user's LLM settings (auth required)
// Must be registered before POST / to avoid route collision
router.post('/user', authMiddleware, (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { providerId, serverType, baseUrl, apiKey, codex, modelName, maxTokens, contextWindow, temperature, topP, topK, frequencyPenalty, presencePenalty, stopSequences, seed, systemPrompt, toolPermissions, zImage } = req.body.settings || req.body;
  const settings = config.saveUserSettings(username, { providerId, serverType, baseUrl, apiKey, codex, modelName, maxTokens, contextWindow, temperature, topP, topK, frequencyPenalty, presencePenalty, stopSequences, seed, systemPrompt, toolPermissions, zImage });
  res.json({ settings });
});

// POST /api/settings/test - Test LLM connection (auth required)
// Must be registered before POST / to avoid route collision
router.post('/test', authMiddleware, async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // Use provided settings or load from user's saved settings
    const settings = req.body.settings || (req.body.baseUrl || req.body.providerId ? req.body : config.loadUserSettings(username));
    if (settings.providerId === 'codex') {
      const status = await getCodexStatus();
      if (!status.available || !status.loggedIn || !status.appServerDaemon.available) {
        return res.json({
          success: false,
          message: status.warnings?.[0] || status.loginLabel || 'Codex Sign In is not ready yet.',
          details: status,
        });
      }

      const probe = await readCodexAccount();
      const modelIds = probe.models.map((model) => model.id).filter(Boolean);
      const defaultModel = probe.models.find((model) => model.isDefault)?.id || modelIds[0] || null;
      return res.json({
        success: Boolean(probe.account && modelIds.length > 0),
        message: probe.account
          ? `Codex ready${defaultModel ? ` (${defaultModel})` : ''}`
          : 'Codex is available, but no ChatGPT/Codex account is active.',
        models: modelIds,
        details: { status, probe },
      });
    }

    const { serverType, baseUrl, apiKey, modelName, maxTokens, temperature, topP, topK, frequencyPenalty, presencePenalty, stopSequences, seed } = settings;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Determine API endpoint based on server type
    let apiBase = baseUrl.replace(/\/+$/, '');
    const isOllama = serverType === 'ollama';
    
    let response;
    if (isOllama) {
      // Ollama uses /api/tags for listing models
      response = await fetch(`${apiBase}/api/tags`, { headers });
    } else {
      // OpenAI-compatible (LM Studio, etc.) uses /models
      response = await fetch(`${apiBase}/models`, { headers });
    }

    if (response.ok) {
      const data = await response.json();
      const models = isOllama 
        ? data.data?.map(m => m.name) || []
        : data.data?.map(m => m.id) || [];
      
      res.json({ 
        success: true, 
        message: 'Connection successful',
        models,
      });
    } else {
      res.json({ 
        success: false, 
        message: `Connection failed: ${response.status} ${response.statusText}`,
      });
    }
  } catch (err) {
    res.json({ 
      success: false, 
      message: `Connection failed: ${err.message}`,
    });
  }
});

export default router;
