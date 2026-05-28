import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { initializeUserDirs } from './fileService.js';
import {
  ensureActiveProjectForUser,
  getActiveProjectGeneratedImagesDir,
  getActiveProjectRoot,
} from './projectService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_PATH_OVERRIDE =
  process.env.NYMPHS_WORLD_USERS_JSON ||
  process.env.WORBI_USERS_JSON; // Allow tests to override path
const USERS_ROOT_OVERRIDE =
  process.env.NYMPHS_WORLD_USERS_ROOT ||
  process.env.WORBI_USERS_ROOT;
const usersPath = USERS_PATH_OVERRIDE || path.join(__dirname, '..', 'data', 'users.json');
const usersRoot = USERS_ROOT_OVERRIDE || path.join(__dirname, '..', 'data', 'users');

// JWT secret - in production, use env var
const JWT_SECRET =
  process.env.NYMPHS_WORLD_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'wbu-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d';

// Load users database
function loadUsers() {
  try {
    if (fs.existsSync(usersPath)) {
      return JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load users:', err.message);
  }
  return {};
}

// Save users database (atomic write to prevent corruption during concurrent access)
function saveUsers(users) {
  try {
    const dir = path.dirname(usersPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = usersPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tmpPath, usersPath);
  } catch (err) {
    console.error('Failed to save users:', err.message);
  }
}

// Ensure user workspace directory exists
function ensureUserDir(username) {
  const userDir = path.join(usersRoot, username);
  [userDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const project = ensureActiveProjectForUser(username);
  
  return {
    userDir,
    workspaceDir: project.rootPath,
    assetsDir: project.generatedImagesRoot,
    project
  };
}

// Login or create user
function loginOrCreate(username) {
  if (!username || username.trim() === '') {
    throw new Error('Username is required');
  }
  
  const cleanUsername = username.trim().toLowerCase();
  
  if (cleanUsername.length < 2 || cleanUsername.length > 30) {
    throw new Error('Username must be 2-30 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
  }
  
  const users = loadUsers();
  const isNewUser = !users[cleanUsername];
  
  // Create user entry and directories
  const dirs = ensureUserDir(cleanUsername);
  
  // Initialize workspace dirs only (no profile folders — user chooses profile on first login)
  initializeUserDirs(cleanUsername, null);
  
  users[cleanUsername] = {
    username: cleanUsername,
    createdAt: users[cleanUsername]?.createdAt || new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  saveUsers(users);
  
  // Generate JWT token
  const token = jwt.sign(
    { username: cleanUsername },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
  
  return {
    token,
    user: {
      username: cleanUsername,
      isNewUser,
      createdAt: users[cleanUsername].createdAt,
      lastLogin: users[cleanUsername].lastLogin
    },
    dirs
  };
}

// Verify JWT token
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      valid: true,
      username: decoded.username
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message
    };
  }
}

// Get user workspace path
function getUserWorkspaceDir(username) {
  return getActiveProjectRoot(username);
}

// Get user settings path
function getUserSettingsPath(username) {
  return path.join(usersRoot, username, 'settings.json');
}

// Get user assets dir
function getUserAssetsDir(username) {
  return getActiveProjectGeneratedImagesDir(username);
}

export {
  loginOrCreate,
  verifyToken,
  loadUsers,
  saveUsers,
  getUserWorkspaceDir,
  getUserSettingsPath,
  getUserAssetsDir,
  JWT_SECRET,
  usersRoot
};
