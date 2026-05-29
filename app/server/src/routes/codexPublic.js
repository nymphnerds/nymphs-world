import express from 'express';
import { getCodexLoginUrl } from '../services/codexService.js';

const router = express.Router();

router.get('/login/:loginId/redirect', (req, res) => {
  try {
    const loginUrl = getCodexLoginUrl(req.params.loginId);
    if (!loginUrl) {
      return res.status(404).send('Codex sign-in session not found.');
    }
    res.redirect(302, loginUrl);
  } catch (error) {
    res.status(error.statusCode || 500).send(error.message);
  }
});

export default router;
