import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { getUserAssetsDir } from '../services/authService.js';

// Check Z-Image server health — simple HTTP check (lifecycle management removed in v6.3.5)
async function checkHealth(baseUrl) {
  return new Promise((resolve) => {
    const url = new URL('/health', baseUrl);
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'healthy' || res.statusCode === 200);
        } catch {
          resolve(res.statusCode === 200);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const zImage = config.zImage || {};
const DEFAULT_BASE_URL = zImage.baseUrl || 'http://localhost:8090';
const TIMEOUT_MS = zImage.timeoutMs || 120000;

// Resolve the Z-Image base URL: prefer per-user settings, fall back to server default
function resolveZImageUrl(userSettings) {
  const userUrl = (userSettings && userSettings.zImage && userSettings.zImage.baseUrl) || '';
  return userUrl || DEFAULT_BASE_URL;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

function signedAssetUrl(filename, username, token) {
  if (!token) return null;
  return `/api/images/proxy?path=${encodeURIComponent(filename)}&token=${encodeURIComponent(token)}&user=${encodeURIComponent(username)}`;
}

function isLocalBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function zImageScriptEnv(baseUrl) {
  const env = { ...process.env, Z_IMAGE_SERVER_URL: baseUrl };
  try {
    const url = new URL(baseUrl);
    env.Z_IMAGE_HOST = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
    env.Z_IMAGE_PORT = url.port || (url.protocol === 'https:' ? '443' : '80');
  } catch {
    // Keep the default script environment if the URL cannot be parsed.
  }
  return env;
}

function runModuleScript(scriptPath, baseUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      reject(new Error(`Z-Image module script was not found: ${scriptPath || 'not configured'}`));
      return;
    }

    execFile(scriptPath, {
      env: zImageScriptEnv(baseUrl),
      timeout: timeoutMs,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        const details = stderr || stdout || error.message;
        reject(new Error(details.trim()));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function httpPost(baseUrl, urlPath, body, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const jsonData = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    req.write(jsonData);
    req.end();
  });
}

function httpGet(baseUrl, urlPath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function copyGeneratedImage(outputPath, username, token) {
  // Copy the generated image from Z-Image outputs to user's assets/images/
  const assetsDir = getUserAssetsDir(username);

  // Ensure assets/images directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Generate a unique filename based on timestamp
  const ext = path.extname(outputPath) || '.png';
  const timestamp = Date.now();
  const basename = path.basename(outputPath, ext).replace(/[^a-zA-Z0-9._-]/g, '_') || 'generated';
  const destName = `${basename}_${timestamp}${ext}`;
  const destPath = path.join(assetsDir, destName);

  // Copy the file
  fs.copyFileSync(outputPath, destPath);

  return {
    filename: destName,
    url: signedAssetUrl(destName, username, token),
    localPath: destPath,
  };
}

// POST /api/llm/generate-image
router.post('/generate-image', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { mode, prompt, negative_prompt, width, height, steps, guidance_scale, seed, image, strength } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Load user settings to resolve Z-Image URL
    const userSettings = config.loadUserSettings(username);
    const baseUrl = resolveZImageUrl(userSettings);

    // Check if server is running
    const healthy = await checkHealth(baseUrl);
    if (!healthy) {
      return res.status(503).json({ error: 'Z-Image server is not running. Please start your Z-Image server and configure its URL in Settings → Images.' });
    }

    // Build request payload for Z-Image
    const payload = {
      mode: mode || 'txt2img',
      prompt,
      width: width || 1024,
      height: height || 1024,
    };

    if (negative_prompt) payload.negative_prompt = negative_prompt;
    if (steps) payload.steps = steps;
    if (guidance_scale !== undefined) payload.guidance_scale = guidance_scale;
    if (seed !== null && seed !== undefined) payload.seed = seed;
    if (mode === 'img2img') {
      if (!image) {
        return res.status(400).json({ error: 'Init image required for img2img mode' });
      }
      payload.image = image;
      if (strength) payload.strength = strength;
    }

    // Send generation request to Z-Image
    const result = await httpPost(baseUrl, '/generate', payload, TIMEOUT_MS);

    if (result.statusCode >= 400) {
      return res.status(result.statusCode).json({ error: result.data?.detail || 'Image generation failed' });
    }

    // Copy the generated image to user's assets
    const outputImagePath = result.data?.output_path;
    let imageUrl = null;
    let metadata = {};

    if (outputImagePath && fs.existsSync(outputImagePath)) {
      try {
        const copyResult = copyGeneratedImage(outputImagePath, username, getBearerToken(req));
        imageUrl = copyResult.url;
        metadata = {
          copyPath: copyResult.localPath,
          filename: copyResult.filename,
        };
      } catch (copyErr) {
        console.error('[imageGeneration] Failed to copy image:', copyErr.message);
        // Still return the Z-Image output path
        imageUrl = outputImagePath;
      }
    }

    res.json({
      status: result.data?.status || 'ok',
      url: imageUrl,
      outputPath: outputImagePath,
      modelId: result.data?.model_id,
      metadata,
    });
  } catch (error) {
    console.error('[imageGeneration] Error:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// POST /api/llm/image-generation/start
router.post('/image-generation/start', async (req, res) => {
  try {
    const username = req.user?.username;
    const userSettings = username ? config.loadUserSettings(username) : {};
    const baseUrl = resolveZImageUrl(userSettings);

    if (!isLocalBaseUrl(baseUrl)) {
      return res.status(409).json({
        success: false,
        error: 'Only local Z-Image module URLs can be started from Nymphs World. Start remote or custom image servers externally.',
      });
    }

    if (await checkHealth(baseUrl)) {
      return res.json({ success: true, message: 'Z-Image server is already running.' });
    }

    await runModuleScript(config.zImage.startScript, baseUrl, config.zImage.startTimeoutMs + 15000);

    if (!(await checkHealth(baseUrl))) {
      return res.status(503).json({
        success: false,
        error: 'Z-Image start script completed, but the server did not pass its health check.',
      });
    }

    res.json({ success: true, message: 'Z-Image server started.' });
  } catch (error) {
    console.error('[imageGeneration] Start error:', error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

// POST /api/llm/image-generation/stop
router.post('/image-generation/stop', async (req, res) => {
  try {
    const username = req.user?.username;
    const userSettings = username ? config.loadUserSettings(username) : {};
    const baseUrl = resolveZImageUrl(userSettings);

    if (!isLocalBaseUrl(baseUrl)) {
      return res.status(409).json({
        success: false,
        error: 'Only local Z-Image module URLs can be stopped from Nymphs World. Stop remote or custom image servers externally.',
      });
    }

    await runModuleScript(config.zImage.stopScript, baseUrl, 15000);
    res.json({ success: true, message: 'Z-Image server stopped.' });
  } catch (error) {
    console.error('[imageGeneration] Stop error:', error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

// GET /api/llm/image-generation/status
router.get('/image-generation/status', async (req, res) => {
  try {
    const username = req.user?.username;
    const userSettings = username ? config.loadUserSettings(username) : {};
    const baseUrl = resolveZImageUrl(userSettings);

    const healthy = await checkHealth(baseUrl);
    if (!healthy) {
      return res.json({ available: false, running: false });
    }

    const result = await httpGet(baseUrl, '/server_info');
    if (result.statusCode >= 400) {
      return res.json({ available: true, running: true, error: 'Failed to fetch server info' });
    }

    res.json({
      available: true,
      running: true,
      backend: result.data?.backend,
      version: result.data?.version,
      modelId: result.data?.configured_model_id,
      loadedModelId: result.data?.loaded_model_id,
      device: result.data?.device,
      supportedModes: result.data?.supported_modes,
      outputDir: result.data?.output_dir,
      extra: result.data?.extra,
    });
  } catch (error) {
    res.json({ available: false, running: false, error: error.message });
  }
});

// GET /api/llm/image-generation/progress
router.get('/image-generation/progress', async (req, res) => {
  try {
    const username = req.user?.username;
    const userSettings = username ? config.loadUserSettings(username) : {};
    const baseUrl = resolveZImageUrl(userSettings);

    const healthy = await checkHealth(baseUrl);
    if (!healthy) {
      return res.json({ running: false, status: 'idle', stage: 'idle', progressPercent: 0 });
    }

    const result = await httpGet(baseUrl, '/active_task');
    if (result.statusCode >= 400) {
      return res.json({ running: false, status: 'idle', stage: 'idle', progressPercent: 0 });
    }

    res.json({
      running: true,
      status: result.data?.status || 'idle',
      stage: result.data?.stage || 'idle',
      detail: result.data?.detail,
      modelId: result.data?.model_id,
      progressCurrent: result.data?.progress_current || 0,
      progressTotal: result.data?.progress_total || 1,
      progressPercent: result.data?.progress_percent || 0,
      lastOutputPath: result.data?.last_output_path,
    });
  } catch (error) {
    res.json({ running: false, status: 'error', stage: 'error', progressPercent: 0, error: error.message });
  }
});

// POST /api/llm/image-generation/test - Test Z-Image server connection
router.post('/image-generation/test', async (req, res) => {
  try {
    const username = req.user?.username;
    const userSettings = username ? config.loadUserSettings(username) : {};
    const testUrl = req.body.baseUrl || resolveZImageUrl(userSettings);

    const healthy = await checkHealth(testUrl);
    if (!healthy) {
      return res.json({ success: false, message: 'Z-Image server is not reachable at ' + testUrl });
    }

    // Try to fetch server info for more detail
    try {
      const result = await httpGet(testUrl, '/server_info');
      if (result.statusCode < 400) {
        return res.json({
          success: true,
          message: 'Connected',
          loadedModelId: result.data?.loaded_model_id,
          backend: result.data?.backend,
          device: result.data?.device,
        });
      }
    } catch {}

    return res.json({ success: true, message: 'Server reachable but could not fetch details' });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Connection failed' });
  }
});

export default router;
