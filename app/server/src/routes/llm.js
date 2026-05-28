import express from 'express';
import config from '../config.js';
import * as llmService from '../services/llmService.js';
import { getAllProviders, getProviderById } from '../services/providerCatalog.js';

const router = express.Router();

// GET /api/llm/providers — Return the static provider catalog (no auth needed)
router.get('/providers', (req, res) => {
  res.json({ providers: getAllProviders() });
});

// GET /api/llm/models — Fetch models from the user's configured provider
router.get('/models', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    let settings;
    if (req.query.baseUrl) {
      settings = {
        baseUrl: req.query.baseUrl,
        apiKey: req.query.apiKey || '',
        serverType: req.query.serverType || '',
      };
    } else {
      settings = config.loadUserSettings(username);
    }

    const models = await llmService.fetchModels(settings);
    res.json({ models });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// GET /api/llm/system-info — DEPRECATED
router.get('/system-info', async (req, res) => {
  res.json({
    modelName: '',
    serverOnline: false,
    deprecated: true,
    message: 'This endpoint is deprecated.',
  });
});

// POST /api/llm/complete — Creative writing completion (ghost text at cursor)
router.post('/complete', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { context, documentTitle, maxTokens } = req.body;

    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }

    const settings = config.loadUserSettings(username);
    const result = await llmService.sendCompletion(context, documentTitle, maxTokens, settings);

    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// POST /api/llm/generate-document — Generate a structured document from a prompt
router.post('/generate-document', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { prompt, docType, documentContext } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!docType) {
      return res.status(400).json({ error: 'Document type is required' });
    }

    const validTypes = ['character', 'location', 'quest', 'timeline', 'freeform'];
    if (!validTypes.includes(docType)) {
      return res.status(400).json({ error: `Invalid document type. Must be one of: ${validTypes.join(', ')}` });
    }

    const settings = config.loadUserSettings(username);
    const result = await llmService.generateDocument(prompt, docType, documentContext, settings);

    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// POST /api/llm/transcribe-image — Transcribe an image to text using vision LLM
router.post('/transcribe-image', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { image, prompt } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const settings = config.loadUserSettings(username);
    const result = await llmService.transcribeImage(image, prompt, settings);

    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// POST /api/llm/chat — Send chat message using user's saved settings
router.post('/chat', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { message, history, documentContent, systemPrompt, permissions } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const settings = config.loadUserSettings(username);

    const messages = (history || []).concat([{ role: 'user', content: message }]);
    const response = await llmService.sendChatMessage(messages, documentContent, systemPrompt, permissions, settings, username);

    res.json({ response });
  } catch (error) {
    console.error('[llm/chat] ERROR:', error.message);
    res.status(502).json({ error: error.message });
  }
});

export default router;