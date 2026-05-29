const API_BASE = '/api';
const TOKEN_KEY = 'wbu_token';

// Helper: get auth token from localStorage
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Helper: build headers with JWT auth
function authHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper: fetch with auth auto-redirect on 401
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const response = await fetch(url, options);
  if (response.status === 401 && token) {
    // Only redirect if we had a token that just expired/invalidated
    // If there's no token, the user is already on the login screen - don't redirect
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('wbu_user');
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  return response;
}

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  modified?: string;
  tags?: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface RelationshipTarget {
  name: string;
  path: string;
  sharedTags: string[];
}

export interface RelationshipResult {
  file: string;
  implicit: RelationshipTarget[];
  explicit: any[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface User {
  username: string;
  isNewUser?: boolean;
}

export interface ProjectInfo {
  id: string;
  title: string;
  schema?: string;
  format?: string;
  features?: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
  rootPath?: string;
}

export interface ProjectListResponse {
  activeProject: ProjectInfo;
  projects: ProjectInfo[];
}

export interface ToolPermissions {
  webSearch: boolean;

  // File tools (granular, master toggle + per-category)
  allowFiles: boolean;        // master toggle for all file tools
  allowRead: boolean;         // gates: read, list
  allowWrite: boolean;        // gates: write, edit, copy, move, mkdir
  allowDelete: boolean;       // gates: delete
  allowRename: boolean;       // gates: rename
  allowSearch: boolean;       // gates: search

  maxSearchResults: number;

  // Feature permission flags (default: false)
  allowGraph?: boolean;
  allowTags?: boolean;
  allowLocations?: boolean;
  allowImageGen?: boolean;
  allowReminders?: boolean;
}

export interface ToolActivity {
  tool: string;
  status: 'running' | 'complete' | 'error';
  label: string;
  result?: string;
  error?: string;
  args?: Record<string, any>;
}

export interface ChatMessageWithTools extends ChatMessage {
  toolActivity?: ToolActivity[];
}

export interface LLMSettings {
  providerId: string;           // Provider ID from catalog (e.g., 'lmstudio', 'ollama', 'openai', 'custom-local')
  serverType: string;           // Legacy field — 'ollama' triggers native API path
  baseUrl: string;              // Full base URL for the LLM API
  apiKey: string;               // API key (empty for local providers)
  codex?: {
    enabled: boolean;
    loginMethod: 'device-code' | 'browser';
    reasoningEffort?: string;
  };
  modelName: string;
  maxTokens: number;
  contextWindow: number;        // Model context window size in tokens (for auto-trimming chat history)
  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string;
  seed: number;
  systemPrompt: string;
  toolPermissions?: ToolPermissions;
  zImage?: {
    baseUrl: string;
  };
}

export interface CodexStatus {
  available: boolean;
  binary: string;
  cliVersion: string | null;
  loggedIn: boolean;
  authMode: string | null;
  loginLabel: string;
  appServerDaemon: {
    available: boolean;
    message: string;
  };
  warnings: string[];
}

export interface CodexAccount {
  type: string;
  email?: string;
  planType?: string;
}

export interface CodexModelInfo {
  id: string;
  model: string;
  displayName: string;
  isDefault: boolean;
  defaultReasoningEffort: string | null;
  supportedReasoningEfforts: Array<{
    reasoningEffort?: string;
    description?: string;
  }>;
  inputModalities: string[];
}

export interface CodexProbe {
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
  models: CodexModelInfo[];
}

export interface CodexLoginSession {
  loginId: string | null;
  method: 'browser' | 'device-code';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  success: boolean | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  authUrl: string | null;
  verificationUrl: string | null;
  userCode: string | null;
  type: string | null;
  externalOpen?: {
    opened: boolean;
    via?: string;
    error?: string;
  } | null;
}

// Check if a user exists (no auth header needed)
export async function checkUser(username: string): Promise<{ exists: boolean }> {
  const res = await fetch(`${API_BASE}/auth/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Check failed');
  }
  return res.json();
}

// Auth operations (no auth header needed for login)
export async function login(username: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function getMe(): Promise<{ user: User }> {
  const res = await authFetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Project operations
export async function getProjects(): Promise<ProjectListResponse> {
  const res = await authFetch(`${API_BASE}/projects`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getActiveProject(): Promise<{ activeProject: ProjectInfo }> {
  const res = await authFetch(`${API_BASE}/projects/active`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createProject(title: string, id?: string): Promise<{ success: boolean; activeProject: ProjectInfo }> {
  const res = await authFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setActiveProject(id: string): Promise<{ success: boolean; activeProject: ProjectInfo }> {
  const res = await authFetch(`${API_BASE}/projects/active`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// File operations
export async function listFiles(pathParam = ''): Promise<FileItem[]> {
  const res = await authFetch(`${API_BASE}/files?path=${encodeURIComponent(pathParam)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.items;
}

export async function getFileContent(filePath: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/files/content?path=${encodeURIComponent(filePath)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function createFile(filePath: string, content = ''): Promise<void> {
  const res = await authFetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path: filePath, type: 'file', content }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function createFolder(folderPath: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path: folderPath, type: 'folder' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateFile(filePath: string, content: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteItem(itemPath: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files?path=${encodeURIComponent(itemPath)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function renameItem(itemPath: string, name: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/rename`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path: itemPath, name }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function copyFile(filePath: string, destFolder?: string): Promise<{ destPath: string; destName: string }> {
  const res = await authFetch(`${API_BASE}/files/copy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path: filePath, destFolder }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function moveFile(filePath: string, destFolder: string): Promise<{ destPath: string }> {
  const res = await authFetch(`${API_BASE}/files/move`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ path: filePath, destFolder }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadImage(file: File, folderPath?: string): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  if (folderPath) {
    formData.append('folder', folderPath);
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await authFetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadFile(file: File, folderPath?: string): Promise<{ path: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (folderPath) {
    formData.append('folder', folderPath);
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await authFetch(`${API_BASE}/files/upload-file`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Image signing operations

export interface SignedImage {
  path: string;
  url: string;
}

/**
 * Sign a single image file path, returning a proxy URL that can be used
 * in <img> tags without an Authorization header.
 */
export async function signImageUrl(filePath: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/images/sign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ file: filePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.url;
}

/**
 * Sign multiple image file paths in a single batch request.
 * Returns a Map of original path → signed proxy URL.
 * Files that don't exist on the server are silently skipped.
 */
export async function signImageBatch(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const res = await authFetch(`${API_BASE}/images/sign-batch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ files: paths }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return new Map(data.signed.map((s: SignedImage) => [s.path, s.url]));
}

/**
 * Sign a workspace image file path (images stored in workspace, not assets/images).
 * Used when inserting images from the file explorer.
 */
export async function signImageFromWorkspace(filePath: string): Promise<string> {
  const res = await authFetch(`${API_BASE}/images/sign-workspace`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ file: filePath }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.url;
}

// Detect if a URL is a proxy-signed image URL
export function isProxyImageUrl(url: string): boolean {
  return url.startsWith('/api/images/proxy?') || url.startsWith('/api/images/proxy-ws?');
}

// Extract the original file path from a proxy-signed URL
export function getOriginalPathFromProxy(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl, window.location.origin);
    return url.searchParams.get('path');
  } catch {
    return null;
  }
}

// Detect if a URL is a workspace proxy URL
export function isWorkspaceProxyUrl(url: string): boolean {
  return url.startsWith('/api/images/proxy-ws?');
}

// LLM operations

export async function fetchModels(baseUrl?: string, apiKey?: string, serverType?: string): Promise<string[]> {
  let url = `${API_BASE}/llm/models`;
  if (baseUrl) {
    const params = new URLSearchParams();
    params.append('baseUrl', baseUrl);
    if (apiKey) params.append('apiKey', apiKey);
    if (serverType) params.append('serverType', serverType);
    url += `?${params.toString()}`;
  }
  const res = await authFetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.models;
}

export async function getCodexStatus(): Promise<CodexStatus> {
  const res = await authFetch(`${API_BASE}/codex/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCodexProbe(): Promise<CodexProbe> {
  const res = await authFetch(`${API_BASE}/codex/probe`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Codex probe failed');
  }
  return res.json();
}

export async function startCodexLogin(method: 'device-code' | 'browser' = 'browser', openExternal = false): Promise<CodexLoginSession> {
  const res = await authFetch(`${API_BASE}/codex/login/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ method, openExternal }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Codex sign-in failed');
  }
  return res.json();
}

export async function openCodexLoginSession(loginId: string): Promise<{ opened: boolean; via?: string; error?: string }> {
  const res = await authFetch(`${API_BASE}/codex/login/${encodeURIComponent(loginId)}/open`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Codex sign-in page could not be opened');
  }
  return res.json();
}

export async function getCodexLoginStatus(loginId: string): Promise<CodexLoginSession> {
  const res = await authFetch(`${API_BASE}/codex/login/${encodeURIComponent(loginId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Codex sign-in status failed');
  }
  return res.json();
}

export async function sendChat(
  message: string,
  history: ChatMessage[],
  documentContent: string,
  systemPrompt: string,
  permissions?: ToolPermissions
): Promise<ChatMessageWithTools> {
  const res = await authFetch(`${API_BASE}/llm/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, history, documentContent, systemPrompt, permissions }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.response;
}

export interface CompletionResponse {
  completion: string;
  model: string;
}

export async function sendCompletion(
  context: string,
  documentTitle?: string,
  maxTokens?: number
): Promise<CompletionResponse> {
  const res = await authFetch(`${API_BASE}/llm/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ context, documentTitle, maxTokens }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Settings operations
export async function getSettings(): Promise<LLMSettings> {
  const res = await authFetch(`${API_BASE}/settings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.settings;
}

export async function saveSettings(settings: Partial<LLMSettings>): Promise<LLMSettings> {
  const res = await authFetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.settings;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  models?: string[];
  details?: any;
}

export async function testConnection(settings: Partial<LLMSettings>): Promise<TestConnectionResponse> {
  const res = await authFetch(`${API_BASE}/settings/test`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveUserSettings(settings: Partial<LLMSettings>): Promise<LLMSettings> {
  const res = await authFetch(`${API_BASE}/settings/user`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.settings;
}

// Search operations
export interface SearchMatch {
  line: number;
  context: string;
}

export interface SearchResult {
  name: string;
  path: string;
  type: string;
  matches: SearchMatch[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export async function searchFiles(query: string, limit = 50): Promise<SearchResponse> {
  const res = await authFetch(`${API_BASE}/files/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Tag operations =====

export async function getTags(): Promise<Tag[]> {
  const res = await authFetch(`${API_BASE}/files/tags`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.tags;
}

export async function createTag(name: string, color?: string, description?: string): Promise<Tag> {
  const res = await authFetch(`${API_BASE}/files/tags`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, color, description }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.tag;
}

export async function updateTag(id: string, updates: { name?: string; color?: string; description?: string }): Promise<Tag> {
  const res = await authFetch(`${API_BASE}/files/tags/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.tag;
}

export async function deleteTag(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/tags/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getFilesByTag(tagName: string): Promise<FileItem[]> {
  const res = await authFetch(`${API_BASE}/files/by-tag/${encodeURIComponent(tagName)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.files;
}

export async function getFileTags(filePath: string): Promise<string[]> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-tags/${encoded}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.tags;
}

export async function addTagsToFile(filePath: string, tagNames: string[]): Promise<{ added: string[] }> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-tags/${encoded}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tags: tagNames }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeTagFromFile(filePath: string, tagName: string): Promise<void> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-tags/${encoded}/tags/${encodeURIComponent(tagName)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function setFileTags(filePath: string, tagNames: string[]): Promise<{ tags: string[] }> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-tags/${encoded}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ tags: tagNames }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFileRelationships(filePath: string): Promise<RelationshipResult> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/relationships/${encoded}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Location operations =====

export interface Location {
  id: string;
  name: string;
  color: string;
  description: string;
}

export async function getLocations(): Promise<Location[]> {
  const res = await authFetch(`${API_BASE}/files/locations`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.locations;
}

export async function createLocation(name: string, color?: string, description?: string): Promise<Location> {
  const res = await authFetch(`${API_BASE}/files/locations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, color, description }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.location;
}

export async function updateLocation(id: string, updates: { name?: string; color?: string; description?: string }): Promise<Location> {
  const res = await authFetch(`${API_BASE}/files/locations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.location;
}

export async function deleteLocation(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/locations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getFilesByLocation(locationName: string): Promise<FileItem[]> {
  const res = await authFetch(`${API_BASE}/files/by-location/${encodeURIComponent(locationName)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.files;
}

export async function getFileLocations(filePath: string): Promise<string[]> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-locations/${encoded}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.locations;
}

export async function addLocationsToFile(filePath: string, locationNames: string[]): Promise<{ added: string[] }> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-locations/${encoded}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ locations: locationNames }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeLocationFromFile(filePath: string, locationName: string): Promise<void> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-locations/${encoded}/locations/${encodeURIComponent(locationName)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function setFileLocations(filePath: string, locationNames: string[]): Promise<{ locations: string[] }> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await authFetch(`${API_BASE}/files/file-locations/${encoded}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ locations: locationNames }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Profile operations =====

export interface ProfileInfo {
  key: string;
  label: string;
  description: string;
  folders: string[];
}

export interface ProfileResponse {
  profile: string | null;
  profiles: ProfileInfo[];
}

export async function getProfile(): Promise<ProfileResponse> {
  const res = await authFetch(`${API_BASE}/files/profile`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setProfile(profile: string): Promise<{ success: boolean; profile: string; folders: string[] }> {
  const res = await authFetch(`${API_BASE}/files/profile`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Template operations =====

export interface TemplateInfo {
  key: string;
  label: string;
  profile?: string;
  defaultFolder: string;
  suffix: string;
}

export async function getTemplates(profile?: string): Promise<TemplateInfo[]> {
  const params = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  const res = await authFetch(`${API_BASE}/files/templates${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.templates;
}

export async function createFromTemplate(
  template: string,
  name?: string,
  folder?: string
): Promise<{ path: string; content: string }> {
  const res = await authFetch(`${API_BASE}/files/template`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ template, name, folder }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface CompileOptions {
  files?: string[];
  folders?: string[];
  entireWorkspace?: boolean;
  title?: string;
  includeTableOfContents?: boolean;
  includeSectionDividers?: boolean;
  includeFilePaths?: boolean;
  excludeMarginNotes?: boolean;
  orderBy?: 'folder' | 'alphabetical' | 'modified';
}

export async function compileStoryBible(options: CompileOptions): Promise<{
  path: string;
  content: string;
  documentCount: number;
  totalSize: number;
}> {
  const res = await authFetch(`${API_BASE}/files/compile`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Timeline operations =====

export interface TimelineTag {
  name: string;
  color: string;
}

export interface TimelineSceneFile {
  path: string;
  name: string;
  tags: TimelineTag[];
}

export interface TimelineScene {
  id: string;
  name: string;
  era: string;
  date: string;
  dateSortable: number | null;
  locationName: string;
  files: TimelineSceneFile[];
}

export interface TimelineEra {
  name: string;
  scenes: TimelineScene[];
}

export interface TimelineResponse {
  eras: TimelineEra[];
}

export async function getTimeline(eraOrder?: string[]): Promise<TimelineResponse> {
  const params = eraOrder ? `?eraOrder=${encodeURIComponent(JSON.stringify(eraOrder))}` : '';
  const res = await authFetch(`${API_BASE}/files/timeline${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface TimelineMetadata {
  date: string;
  era: string;
}

export async function saveTimelineMetadata(
  filePath: string,
  metadata: Partial<TimelineMetadata>,
): Promise<{ ok: true }> {
  const res = await authFetch(`${API_BASE}/files/timeline/metadata`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ filePath, metadata }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function suggestTimelineDate(era: string): Promise<{ suggestedDate: string }> {
  const res = await authFetch(`${API_BASE}/files/timeline/suggest-date?era=${encodeURIComponent(era)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---- AI Document Generation ----

export type DocumentType = 'character' | 'location' | 'quest' | 'timeline' | 'freeform';

export interface GenerateDocumentResponse {
  html: string;
  model: string;
}

export async function generateDocument(
  prompt: string,
  docType: DocumentType,
  documentContext?: string,
): Promise<GenerateDocumentResponse> {
  const res = await authFetch(`${API_BASE}/llm/generate-document`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prompt, docType, documentContext }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---- Image Transcription (Image to Text) ----

export interface TranscribeImageResponse {
  text: string;
  model: string;
}

export async function transcribeImage(
  imageBase64: string,
  customPrompt?: string,
): Promise<TranscribeImageResponse> {
  const res = await authFetch(`${API_BASE}/llm/transcribe-image`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ image: imageBase64, prompt: customPrompt }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---- Image Generation (Z-Image / Nymphs2D2) ----

export interface GenerateImagePayload {
  mode: 'txt2img' | 'img2img';
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  steps?: number;
  guidance_scale?: number;
  seed?: number | null;
  image?: string;  // base64 data URI for img2img
  strength?: number;
}

export interface GenerateImageResponse {
  status: string;
  url: string | null;
  outputPath: string;
  modelId: string;
  metadata: {
    copyPath?: string;
    filename?: string;
  };
}

export interface ImageGenStatus {
  available: boolean;
  running: boolean;
  backend?: string;
  version?: string;
  modelId?: string;
  loadedModelId?: string;
  device?: string;
  supportedModes?: string[];
  outputDir?: string;
  extra?: Record<string, any>;
  error?: string;
}

export interface ImageGenProgress {
  running: boolean;
  status: string;
  stage: string;
  detail?: string;
  modelId?: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;
  lastOutputPath?: string;
  error?: string;
}

export async function generateImage(
  payload: GenerateImagePayload,
): Promise<GenerateImageResponse> {
  const res = await authFetch(`${API_BASE}/llm/generate-image`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getImageGenerationStatus(): Promise<ImageGenStatus> {
  const res = await authFetch(`${API_BASE}/llm/image-generation/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getImageGenerationProgress(): Promise<ImageGenProgress> {
  const res = await authFetch(`${API_BASE}/llm/image-generation/progress`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ImageGenStartResponse {
  success: true;
  message: string;
}

export interface ImageGenVramWarning {
  ok: false;
  reason: 'insufficient_vram';
  freeVramMb: number;
  requiredVramMb: number;
}

export type ImageGenStartResult = ImageGenStartResponse | ImageGenVramWarning;

export async function startImageGenerationServer(minVramMb?: number): Promise<ImageGenStartResult> {
  const res = await authFetch(`${API_BASE}/llm/image-generation/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ minVramMb }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stopImageGenerationServer(): Promise<{ success: true; message: string }> {
  const res = await authFetch(`${API_BASE}/llm/image-generation/stop`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function testZImageConnection(baseUrl: string): Promise<{ success: boolean; message: string; loadedModelId?: string; backend?: string; device?: string }> {
  const res = await authFetch(`${API_BASE}/llm/image-generation/test`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ baseUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== WikiLink API =====

export interface WikiLinkResolveResult {
  exists: boolean;
  filePath?: string;
  contentPreview?: string;
  suggestedPath?: string;
}

export interface WikiLinkSearchResult {
  name: string;
  path: string;
  folder: string;
}

export interface WikiLinkBacklink {
  filePath: string;
  snippet: string;
  lineApprox?: number;
}

export async function resolveWikiLink(name: string): Promise<WikiLinkResolveResult> {
  const res = await authFetch(`${API_BASE}/files/resolve-wikilink?name=${encodeURIComponent(name)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function searchWikiLinks(query: string, limit = 10): Promise<WikiLinkSearchResult[]> {
  const res = await authFetch(`${API_BASE}/files/wikilink-search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.results || [];
}

export async function getBacklinks(filePath: string): Promise<WikiLinkBacklink[]> {
  const res = await authFetch(`${API_BASE}/files/backlinks?path=${encodeURIComponent(filePath)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.backlinks || [];
}

// ===== Relationship Graph API (Seed-Centric) =====

export interface GraphNode {
  id: string;
  label: string;
  color: string;
  size: number;
  tags: string[];
  tagsMeta?: Array<{ name: string; color: string }>;
  era?: string;
  date?: string;
  isSeed?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  model: string;
  fileCount?: number;
  message?: string;
}

export type RelationshipType = 'character_connection' | 'location_connection' | 'thematic' | 'narrative' | 'tag_based';

export interface SeedGraphPayload {
  seedPath: string;
  relationshipTypes: string[];
  useAI: boolean;
  depth?: 1 | 2;
}

export async function generateGraphFromSeed(
  payload: SeedGraphPayload,
): Promise<GraphData> {
  const res = await authFetch(`${API_BASE}/llm/graph/from-seed`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGraphEras(): Promise<string[]> {
  const res = await authFetch(`${API_BASE}/llm/graph/eras`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.eras || [];
}

// ===== User Recents/Starred API =====

export interface UserRecentFile {
  path: string;
  name: string;
  lastOpened: number;
}

export interface UserStarredFile {
  path: string;
  name: string;
}

export async function getUserRecents(): Promise<UserRecentFile[]> {
  const res = await authFetch(`${API_BASE}/files/user/recents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.recents || [];
}

export async function saveUserRecents(recents: UserRecentFile[]): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/user/recents`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ recents }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getUserStarred(): Promise<UserStarredFile[]> {
  const res = await authFetch(`${API_BASE}/files/user/starred`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.starred || [];
}

export async function saveUserStarred(starred: UserStarredFile[]): Promise<void> {
  const res = await authFetch(`${API_BASE}/files/user/starred`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ starred }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ===== Reminder operations =====

export interface ReminderThread {
  note: string;
  resolvedAt: string;
}

export interface Reminder {
  id: string;
  filePath: string;
  title: string;
  fireAt: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  weeklyDay?: number;
  status: 'pending' | 'fired' | 'completed' | 'converted';
  thread: ReminderThread[];
  createdAt: string;
  username: string;
  convertedFrom?: string;
}

export interface ReminderGroup {
  filePath: string;
  reminders: Reminder[];
}

export async function getReminders(): Promise<Reminder[]> {
  const res = await authFetch(`${API_BASE}/reminders`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.reminders;
}

export async function getRemindersGrouped(): Promise<ReminderGroup[]> {
  const res = await authFetch(`${API_BASE}/reminders/grouped`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.groups;
}

export async function createReminderAPI(data: {
  filePath: string;
  title: string;
  fireAt: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  weeklyDay?: number;
}): Promise<Reminder> {
  const res = await authFetch(`${API_BASE}/reminders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return result.reminder;
}

export async function updateReminderAPI(id: string, updates: Partial<Reminder>): Promise<Reminder> {
  const res = await authFetch(`${API_BASE}/reminders/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return result.reminder;
}

export async function addReminderThreadNote(id: string, note: string): Promise<Reminder> {
  const res = await authFetch(`${API_BASE}/reminders/${id}/thread`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return result.reminder;
}

export async function convertReminder(id: string, newFireAt: string): Promise<Reminder> {
  const res = await authFetch(`${API_BASE}/reminders/${id}/convert`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ newFireAt }),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return result.reminder;
}

export async function deleteReminderAPI(id: string): Promise<{ success: boolean; id: string }> {
  const res = await authFetch(`${API_BASE}/reminders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function checkReminders(): Promise<{ fired: Reminder[]; advanced: Reminder[] }> {
  const res = await authFetch(`${API_BASE}/reminders/check`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Maintenance API ──────────────────────────────────────────────────────────

export interface MaintenanceResponse {
  success: boolean;
  data?: any;
  error?: string;
  stderr?: string;
  timestamp: string;
}

export async function runHealthScan(username?: string): Promise<MaintenanceResponse> {
  const url = username
    ? `${API_BASE}/admin/maintenance/health/user/${username}`
    : `${API_BASE}/admin/maintenance/health`;
  const res = await authFetch(url, { headers: authHeaders(false) });
  return res.json();
}

export async function fixHealth(username?: string): Promise<MaintenanceResponse> {
  const url = username
    ? `${API_BASE}/admin/maintenance/health/user/${username}/fix`
    : `${API_BASE}/admin/maintenance/health/fix`;
  const res = await authFetch(url, { method: 'POST', headers: authHeaders() });
  return res.json();
}

export async function loadReview(): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/admin/maintenance/review`, { headers: authHeaders(false) });
  return res.json();
}

export async function loadAccounts(): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/admin/accounts`, { headers: authHeaders(false) });
  return res.json();
}

export async function showAccount(username: string): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/admin/accounts/${username}`, { headers: authHeaders(false) });
  return res.json();
}

export async function accountAction(
  username: string,
  action: 'add' | 'delete' | 'deactivate' | 'activate' | 'purge'
): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/admin/accounts/${username}/${action}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function bulkDeleteAccounts(pattern: string): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/admin/accounts/bulk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ pattern }),
  });
  return res.json();
}

// ── Self-Service Maintenance API (current user only) ─────────────────────────

export async function selfServiceScan(): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/health`, { headers: authHeaders(false) });
  return res.json();
}

export async function selfServiceFix(): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/health/fix`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function selfServiceReview(): Promise<MaintenanceResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/review`, { headers: authHeaders(false) });
  return res.json();
}

// ── Admin Password API ──────────────────────────────────────────────────────

export interface PasswordStatusResponse {
  success: boolean;
  passwordSet: boolean;
  error?: string;
}

export interface PasswordSetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PasswordVerifyResponse {
  success: boolean;
  valid?: boolean;
  passwordSet?: boolean;
  error?: string;
}

export async function checkAdminPasswordStatus(): Promise<PasswordStatusResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/password/status`, { headers: authHeaders(false) });
  return res.json();
}

export async function setAdminPassword(password: string): Promise<PasswordSetResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/password/set`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  return res.json();
}

export async function verifyAdminPassword(password: string): Promise<PasswordVerifyResponse> {
  const res = await authFetch(`${API_BASE}/maintenance/password/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  return res.json();
}

// ============================================================
// Scenes
// ============================================================

export interface Scene {
  id: string;
  name: string;
  era: string;
  date: string;
  locationName: string;
}

async function sceneFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    // Read the raw text first to diagnose non-JSON responses
    const raw = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
    throw new Error(parsed?.error || `Scene API error ${res.status}: ${raw.slice(0, 200)}`);
  }
  return res;
}

export async function getScenes(): Promise<Scene[]> {
  const res = await sceneFetch(`${API_BASE}/files/scenes`, {
    method: 'GET',
    headers: authHeaders(false),
  });
  const data = await res.json();
  return data.scenes || [];
}

export async function createScene(name: string, era: string, date: string, locationName: string): Promise<Scene> {
  const res = await sceneFetch(`${API_BASE}/files/scenes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, era, date, locationName }),
  });
  const data = await res.json();
  return data.scene;
}

export async function updateScene(id: string, updates: Partial<Pick<Scene, 'name' | 'era' | 'date' | 'locationName'>>): Promise<Scene> {
  const res = await sceneFetch(`${API_BASE}/files/scenes/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  return data.scene;
}

export async function deleteScene(id: string): Promise<void> {
  await sceneFetch(`${API_BASE}/files/scenes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
}

export async function getFileScenes(filePath: string): Promise<string[]> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await sceneFetch(`${API_BASE}/files/scenes/file/${encoded}`, {
    method: 'GET',
    headers: authHeaders(false),
  });
  const data = await res.json();
  return data.scenes || [];
}

export async function addScenesToFile(filePath: string, sceneIds: string[]): Promise<{ added: string[] }> {
  const res = await sceneFetch(`${API_BASE}/files/scenes/assign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ filePath, sceneIds }),
  });
  return res.json();
}

export async function removeSceneFromFile(filePath: string, sceneId: string): Promise<void> {
  const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  await sceneFetch(`${API_BASE}/files/scenes/file/${encoded}/${sceneId}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
}

// ============================================================
// Dialogue
// ============================================================

export type StatName = 'strength' | 'agility' | 'intelligence' | 'charisma' | 'endurance' | 'luck';
export type MoralAlignment = 'good' | 'evil' | 'neutral';

/** A single stat change granted by a dialogue choice */
export interface StatChange {
  stat: StatName;
  amount: number;  // percentage, e.g. 10 = +10%
}

/** An item granted by a dialogue choice */
export interface GrantedItem {
  itemId: string;
  quantity: number;
}

/** Outcomes applied when the player selects a choice */
export interface ChoiceOutcomes {
  statChanges: StatChange[];
  itemsGranted: GrantedItem[];
  perksUnlocked: string[];
  alignmentShift: number;  // +1 Good, -1 Evil, 0 Neutral
}

/** Conditions that must be met for a choice to be visible */
export interface ChoiceConditions {
  minStat?: { stat: StatName; value: number };
  requiredItems?: string[];
  requiredPerks?: string[];
  minAlignment?: number;
  previouslyChosen?: string;  // choice ID that must have been picked first
}

/** A node in the nested choice tree (recursive) */
export interface DialogueChoiceNode {
  id: string;
  text: string;
  alignment?: MoralAlignment;
  outcomes: ChoiceOutcomes;
  conditions?: ChoiceConditions;
  targetLineId?: string;     // leaf: navigate to this line
  children?: DialogueChoiceNode[];  // branch: sub-choices
}

export interface DialogueLine {
  id: string;
  speakerName: string;
  speakerPath: string;
  speech: string;
  action: string;
  order: number;

  // Game engine fields
  alignment?: MoralAlignment;
  choices: DialogueChoiceNode[];
  chapterTag?: string;
  sceneTag?: string;
  outcomes?: string[];
  conditions?: string[];
}

export interface DialogueParticipant {
  name: string;
  path: string;
  type: 'npc' | 'playercharacter';
}

export interface DialogueResponse {
  sceneId: string;
  filePath: string;
  html: string;
  lines: DialogueLine[];
  participants: DialogueParticipant[];
}

export async function ensureDialogueFile(sceneId: string): Promise<{ path: string; existed: boolean }> {
  const res = await authFetch(`${API_BASE}/dialogue/${sceneId}/ensure`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to ensure dialogue file: ${res.status}`);
  return res.json();
}

export async function getDialogue(sceneId: string): Promise<{ html: string; path: string; participants: DialogueParticipant[] }> {
  const res = await authFetch(`${API_BASE}/dialogue/${sceneId}`, {
    method: 'GET',
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(`Failed to load dialogue: ${res.status}`);
  return res.json();
}

export async function saveDialogue(sceneId: string, html: string): Promise<{ path: string }> {
  const res = await authFetch(`${API_BASE}/dialogue/${sceneId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ html }),
  });
  if (!res.ok) throw new Error(`Failed to save dialogue: ${res.status}`);
  return res.json();
}
