import express from 'express';
import {
  cancelCodexLogin,
  getCodexLoginStatus,
  getCodexStatus,
  openCodexLoginSession,
  openExternalUrl,
  readCodexAccount,
  startCodexLogin,
} from '../services/codexService.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  const status = await getCodexStatus();
  res.json(status);
});

router.get('/probe', async (req, res) => {
  try {
    const result = await readCodexAccount();
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

router.post('/login/start', async (req, res) => {
  const method = req.body?.method || 'browser';
  const shouldOpenExternal = Boolean(req.body?.openExternal);
  try {
    const result = await startCodexLogin(method);
    let externalOpen = null;
    if (shouldOpenExternal) {
      const loginUrl = result.authUrl || result.verificationUrl;
      if (loginUrl) {
        try {
          externalOpen = await openExternalUrl(loginUrl);
        } catch (error) {
          externalOpen = { opened: false, error: error.message };
        }
      }
    }
    res.json({ ...result, externalOpen });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details || null,
    });
  }
});

router.get('/login/:loginId', async (req, res) => {
  const result = getCodexLoginStatus(req.params.loginId);
  if (!result) {
    return res.status(404).json({ error: 'Codex sign-in session not found.' });
  }
  res.json(result);
});

router.post('/login/:loginId/open', async (req, res) => {
  try {
    const result = await openCodexLoginSession(req.params.loginId);
    if (!result) {
      return res.status(404).json({ error: 'Codex sign-in session not found.' });
    }
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/login/:loginId/cancel', async (req, res) => {
  const result = await cancelCodexLogin(req.params.loginId);
  if (!result) {
    return res.status(404).json({ error: 'Codex sign-in session not found.' });
  }
  res.json(result);
});

export default router;
