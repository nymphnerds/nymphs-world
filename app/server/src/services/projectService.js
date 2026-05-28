import fs from 'fs';
import os from 'os';
import path from 'path';

const dataRoot =
  process.env.NYMPHS_WORLD_DATA_ROOT ||
  process.env.WORBI_DATA_ROOT ||
  path.join(os.homedir(), 'NymphsData', 'nymphs-world');

const projectsRoot =
  process.env.NYMPHS_WORLD_PROJECTS_ROOT ||
  process.env.WORBI_PROJECTS_ROOT ||
  path.join(dataRoot, 'projects');

const usersRoot =
  process.env.NYMPHS_WORLD_USERS_ROOT ||
  process.env.WORBI_USERS_ROOT ||
  path.join(dataRoot, 'users');

const PROJECT_MANIFEST_FILE = 'nymphs-world.json';
const ACTIVE_PROJECT_FILE = 'active-project.json';

const PROJECT_DIRS = [
  'MainStory',
  'Quests',
  'PlayerCharacters',
  'NPCs',
  'Locations',
  'Factions',
  'Items',
  'Scenes',
  'Lore',
  'Maps',
  'Biomes',
  'Data',
  'Assets/references',
  'Assets/generated/images',
  'Assets/generated/models',
  'Assets/maps',
  'Assets/audio',
  'Production/briefs',
  'Production/jobs',
  'Production/exports',
  '_system/templates',
  '.nymphs-world',
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeProjectId(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  if (!slug) {
    throw new Error('Project id is required');
  }
  return slug;
}

function defaultProjectTitle(username) {
  const clean = String(username || 'user').trim() || 'user';
  return `${clean} World`;
}

function defaultProjectId(username) {
  return sanitizeProjectId(`${username || 'user'}-world`);
}

function getUserDir(username) {
  const clean = sanitizeProjectId(username);
  return path.join(usersRoot, clean);
}

function getActiveProjectStatePath(username) {
  return path.join(getUserDir(username), ACTIVE_PROJECT_FILE);
}

function getProjectRoot(projectId) {
  return path.join(projectsRoot, sanitizeProjectId(projectId));
}

function getManifestPath(projectId) {
  return path.join(getProjectRoot(projectId), PROJECT_MANIFEST_FILE);
}

function buildManifest(projectId, title) {
  const id = sanitizeProjectId(projectId);
  return {
    schema: 'nymphs-world.project.v1',
    id,
    title: title || id,
    format: 'worbi-html-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    features: {
      brain: true,
      media: true,
      maps: true,
      biomes: true,
    },
  };
}

function loadProjectManifest(projectId) {
  const manifestPath = getManifestPath(projectId);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveProjectManifest(projectId, manifest) {
  const manifestPath = getManifestPath(projectId);
  ensureDir(path.dirname(manifestPath));
  const merged = {
    ...manifest,
    schema: manifest.schema || 'nymphs-world.project.v1',
    id: sanitizeProjectId(manifest.id || projectId),
    format: manifest.format || 'worbi-html-v1',
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function ensureProjectStructure(projectId, title = null) {
  const id = sanitizeProjectId(projectId);
  const rootPath = getProjectRoot(id);
  ensureDir(rootPath);

  for (const dir of PROJECT_DIRS) {
    ensureDir(path.join(rootPath, dir));
  }

  let manifest = loadProjectManifest(id);
  if (!manifest) {
    manifest = saveProjectManifest(id, buildManifest(id, title || id));
  }

  return {
    ...manifest,
    rootPath,
    assetsRoot: path.join(rootPath, 'Assets'),
    generatedImagesRoot: path.join(rootPath, 'Assets', 'generated', 'images'),
  };
}

function loadActiveProjectId(username) {
  const activePath = getActiveProjectStatePath(username);
  if (!fs.existsSync(activePath)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(activePath, 'utf-8'));
    return state.activeProjectId ? sanitizeProjectId(state.activeProjectId) : null;
  } catch {
    return null;
  }
}

function saveActiveProjectId(username, projectId) {
  const activePath = getActiveProjectStatePath(username);
  ensureDir(path.dirname(activePath));
  const state = {
    activeProjectId: sanitizeProjectId(projectId),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(activePath, JSON.stringify(state, null, 2), 'utf-8');
  return state.activeProjectId;
}

function hasVisibleProjectContent(projectRoot) {
  const contentRoots = [
    'MainStory',
    'Quests',
    'PlayerCharacters',
    'NPCs',
    'Locations',
    'Factions',
    'Items',
    'Scenes',
    'Lore',
    'Maps',
    'Biomes',
  ];

  for (const rel of contentRoots) {
    const dir = path.join(projectRoot, rel);
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir).filter(name => !name.startsWith('.'));
    if (entries.length > 0) return true;
  }

  return false;
}

function copyMissingChildren(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  ensureDir(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (fs.existsSync(targetPath)) {
      continue;
    }

    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      dereference: false,
      errorOnExist: false,
      force: false,
    });
  }
}

function migrateLegacyUserWorkspace(username, project) {
  const userDir = getUserDir(username);
  const legacyWorkspace = path.join(userDir, 'workspace');
  const legacyImages = path.join(userDir, 'assets', 'images');

  if (fs.existsSync(legacyWorkspace) && !hasVisibleProjectContent(project.rootPath)) {
    copyMissingChildren(legacyWorkspace, project.rootPath);
  }

  if (fs.existsSync(legacyImages)) {
    copyMissingChildren(legacyImages, project.generatedImagesRoot);
  }
}

function createProject(username, options = {}) {
  const title = String(options.title || '').trim() || defaultProjectTitle(username);
  const id = sanitizeProjectId(options.id || title);
  const project = ensureProjectStructure(id, title);
  saveActiveProjectId(username, id);
  return project;
}

function ensureActiveProjectForUser(username) {
  ensureDir(projectsRoot);
  ensureDir(getUserDir(username));

  const activeProjectId = loadActiveProjectId(username) || defaultProjectId(username);
  let project = ensureProjectStructure(activeProjectId, defaultProjectTitle(username));
  saveActiveProjectId(username, project.id);
  migrateLegacyUserWorkspace(username, project);
  project = ensureProjectStructure(project.id, project.title);
  return project;
}

function getActiveProject(username) {
  return ensureActiveProjectForUser(username);
}

function setActiveProject(username, projectId) {
  const id = sanitizeProjectId(projectId);
  const manifest = loadProjectManifest(id);
  if (!manifest) {
    throw new Error(`Project not found: ${id}`);
  }
  saveActiveProjectId(username, id);
  return ensureProjectStructure(id, manifest.title || id);
}

function listProjects() {
  ensureDir(projectsRoot);
  const projects = [];

  for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const manifest = loadProjectManifest(entry.name);
    if (manifest) {
      projects.push({
        ...manifest,
        rootPath: getProjectRoot(entry.name),
      });
    }
  }

  projects.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
  return projects;
}

function getActiveProjectRoot(username) {
  return getActiveProject(username).rootPath;
}

function getActiveProjectGeneratedImagesDir(username) {
  return getActiveProject(username).generatedImagesRoot;
}

export {
  PROJECT_DIRS,
  PROJECT_MANIFEST_FILE,
  projectsRoot,
  sanitizeProjectId,
  defaultProjectId,
  ensureProjectStructure,
  ensureActiveProjectForUser,
  getActiveProject,
  setActiveProject,
  createProject,
  listProjects,
  getProjectRoot,
  getActiveProjectRoot,
  getActiveProjectGeneratedImagesDir,
};
