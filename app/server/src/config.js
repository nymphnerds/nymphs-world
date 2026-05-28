import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for user settings JSON files
const userSettingsDir =
  process.env.NYMPHS_WORLD_USER_SETTINGS_DIR ||
  process.env.WORBI_USER_SETTINGS_DIR ||
  path.join(__dirname, '../../data/user-settings');

// Global server config
const serverConfig = {
  port: process.env.PORT || process.env.NYMPHS_WORLD_PORT || 8083,
  host: process.env.HOST || process.env.NYMPHS_WORLD_HOST || '127.0.0.1',
};

const defaultSystemPrompt = 'You are a helpful AI assistant for a game worldbuilder tool. The user is working on a document with the following content. Use this context to assist with writing, worldbuilding, lore, character development, and quest design.';

// Default user settings template
const defaultUserSettings = {
  providerId: '',          // Provider ID from catalog (e.g., 'lmstudio', 'ollama', 'openai', 'custom-local')
  serverType: '',          // Legacy field — kept for compatibility ('ollama' triggers native API path)
  baseUrl: '',             // Full base URL for the LLM API
  apiKey: '',              // API key (empty for local providers)
  modelName: '',           // Selected model name
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
  // Tool permissions
  toolPermissions: {
    webSearch: true,
    // File tools (granular, master toggle + per-category)
    allowFiles: true,        // master toggle for all file tools
    allowRead: true,         // gates: read, list
    allowWrite: true,        // gates: write, edit, copy, move, mkdir
    allowDelete: false,      // gates: delete
    allowRename: false,      // gates: rename
    allowSearch: true,       // gates: search
    maxSearchResults: 5,
  },
  // Z-Image (Nymphs2D2) server settings
  zImage: {
    baseUrl: '',             // User's Z-Image server URL (e.g., http://localhost:8090)
  },
};

function ensureSettingsDir() {
  if (!fs.existsSync(userSettingsDir)) {
    fs.mkdirSync(userSettingsDir, { recursive: true });
  }
}

function getUserSettingsFile(username) {
  return path.join(userSettingsDir, `${username}-settings.json`);
}

function loadUserSettings(username) {
  try {
    const filePath = getUserSettingsFile(username);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Merge with defaults to ensure all fields exist
      return { ...defaultUserSettings, ...data };
    }
  } catch (err) {
    console.error(`Failed to load settings for ${username}:`, err.message);
  }
  return { ...defaultUserSettings };
}

function saveUserSettings(username, settings) {
  try {
    ensureSettingsDir();
    const merged = { ...defaultUserSettings, ...settings };
    const filePath = getUserSettingsFile(username);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error(`Failed to save settings for ${username}:`, err.message);
    return { ...defaultUserSettings, ...settings };
  }
}

// Ensure settings directory exists on startup
ensureSettingsDir();

// Z-Image (Nymphs2D2) configuration
const zImageSettings = {
  baseUrl: process.env.Z_IMAGE_BASE_URL || 'http://localhost:8090',
  timeoutMs: parseInt(process.env.Z_IMAGE_TIMEOUT_MS || '120000'),
  startTimeoutMs: parseInt(process.env.Z_IMAGE_START_TIMEOUT_MS || '60000'),
  startScript: process.env.Z_IMAGE_START_SCRIPT || path.join(process.env.HOME || '', 'NymphsModules/zimage/scripts/zimage_start.sh'),
  stopScript: process.env.Z_IMAGE_STOP_SCRIPT || path.join(process.env.HOME || '', 'NymphsModules/zimage/scripts/zimage_stop.sh'),
  scriptsDir: process.env.Z_IMAGE_SCRIPTS_DIR || '',
  outputDir: process.env.Z_IMAGE_OUTPUT_DIR || '',
  minVramMb: parseInt(process.env.Z_IMAGE_MIN_VRAM_MB || '8192'), // Minimum free VRAM in MB for generation
};

const config = {
  port: serverConfig.port,
  host: serverConfig.host,
  zImage: zImageSettings,
  defaultUserSettings,
  loadUserSettings,
  saveUserSettings,
};

export default config;
