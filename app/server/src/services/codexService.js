import { execFile, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { mkdirSync } from 'fs';
import { createInterface } from 'readline';

const CODEX_BIN = process.env.NYMPHS_WORLD_CODEX_BIN || process.env.CODEX_BIN || 'codex';
const COMMAND_TIMEOUT_MS = Number.parseInt(process.env.NYMPHS_WORLD_CODEX_TIMEOUT_MS || '8000', 10);
const APP_SERVER_TIMEOUT_MS = Number.parseInt(process.env.NYMPHS_WORLD_CODEX_APP_SERVER_TIMEOUT_MS || '15000', 10);
const TURN_TIMEOUT_MS = Number.parseInt(process.env.NYMPHS_WORLD_CODEX_TURN_TIMEOUT_MS || '120000', 10);
const LOGIN_SESSION_TIMEOUT_MS = Number.parseInt(process.env.NYMPHS_WORLD_CODEX_LOGIN_TIMEOUT_MS || '600000', 10);
const CODEX_WORKSPACE_DIR = process.env.NYMPHS_WORLD_CODEX_SESSION_DIR
  || process.env.NYMPHS_WORLD_META_DIR
  || process.cwd();
const loginSessions = new Map();

class CodexAppServerClient extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = '';
  }

  async start() {
    mkdirSync(CODEX_WORKSPACE_DIR, { recursive: true });
    this.proc = spawn(CODEX_BIN, ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    this.proc.stderr.on('data', (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString()}`.slice(-4000);
    });

    const rl = createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => this.handleLine(line));
    this.proc.on('error', (error) => this.rejectAll(error));
    this.proc.on('exit', (code, signal) => {
      const suffix = this.stderr ? ` ${this.stderr.trim()}` : '';
      this.rejectAll(new Error(`Codex app-server exited (${code ?? signal}).${suffix}`));
    });

    await this.request('initialize', {
      clientInfo: {
        name: 'nymphs_world',
        title: 'Nymphs World',
        version: '0.2.0',
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    }, APP_SERVER_TIMEOUT_MS);
    this.notify('initialized');
  }

  handleLine(line) {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      this.emit('protocolError', error);
      return;
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.write({
        id: message.id,
        error: {
          code: -32601,
          message: `Nymphs World does not implement Codex server request ${message.method}.`,
        },
      });
      return;
    }

    if (message.method) {
      this.emit('notification', message);
    }
  }

  request(method, params = {}, timeoutMs = APP_SERVER_TIMEOUT_MS) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Codex app-server method ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ method, id, params });
    });
  }

  notify(method, params) {
    const message = params === undefined ? { method } : { method, params };
    this.write(message);
  }

  write(message) {
    if (!this.proc?.stdin?.writable) {
      throw new Error('Codex app-server stdin is not writable.');
    }
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  rejectAll(error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
    this.emit('closed', error);
  }

  close() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
    }
  }
}

function runCodex(args, options = {}) {
  return new Promise((resolve) => {
    execFile(CODEX_BIN, args, {
      timeout: options.timeoutMs || COMMAND_TIMEOUT_MS,
      env: process.env,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        signal: error?.signal ?? null,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
        error: error?.message || null,
      });
    });
  });
}

function validateBrowserUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs can be opened.');
  }
  return parsed.toString();
}

function getBrowserLaunchers(url) {
  if (process.platform === 'win32' || process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return [
      {
        command: 'cmd.exe',
        args: ['/c', 'start', '', url],
        label: 'Windows default browser',
      },
      {
        command: 'explorer.exe',
        args: [url],
        label: 'Windows URL handler',
      },
      {
        command: 'powershell.exe',
        args: ['-NoProfile', '-Command', 'Start-Process -FilePath $args[0]', url],
        label: 'PowerShell default browser',
      },
    ];
  }

  if (process.platform === 'darwin') {
    return [{
      command: 'open',
      args: [url],
      label: 'macOS default browser',
    }];
  }

  return [{
    command: 'xdg-open',
    args: [url],
    label: 'system default browser',
  }];
}

async function openExternalUrl(url) {
  const safeUrl = validateBrowserUrl(url);
  const launchers = getBrowserLaunchers(safeUrl);
  let lastError = null;

  for (const launcher of launchers) {
    try {
      return await new Promise((resolve, reject) => {
        const child = spawn(launcher.command, launcher.args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          env: process.env,
        });

        child.once('error', reject);
        child.once('spawn', () => {
          child.unref?.();
          resolve({
            opened: true,
            via: launcher.label,
          });
        });
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No system browser launcher is available.');
}

function normalizeVersion(output) {
  return output.replace(/^codex-cli\s+/i, '').trim();
}

function parseLoginStatus(output) {
  const text = output || '';
  if (/logged in using chatgpt/i.test(text)) {
    return { loggedIn: true, mode: 'chatgpt', label: 'Logged in using ChatGPT' };
  }
  if (/logged in using api/i.test(text) || /api key/i.test(text)) {
    return { loggedIn: true, mode: 'apiKey', label: text };
  }
  return { loggedIn: false, mode: null, label: text || 'Not logged in' };
}

async function withCodexClient(callback) {
  const client = new CodexAppServerClient();
  await client.start();
  try {
    return await callback(client);
  } finally {
    client.close();
  }
}

function normalizeModelList(response) {
  return (response?.data || [])
    .filter((model) => model && !model.hidden)
    .map((model) => ({
      id: model.id || model.model,
      model: model.model || model.id,
      displayName: model.displayName || model.id || model.model,
      isDefault: Boolean(model.isDefault),
      defaultReasoningEffort: model.defaultReasoningEffort || null,
      supportedReasoningEfforts: model.supportedReasoningEfforts || [],
      inputModalities: model.inputModalities || ['text', 'image'],
    }))
    .filter((model) => model.id);
}

function pickCodexModel(models, requestedModel) {
  if (requestedModel) {
    const matched = models.find((model) => model.id === requestedModel || model.model === requestedModel);
    if (matched) return matched.id;
  }
  return models.find((model) => model.isDefault)?.id || models[0]?.id || null;
}

function normalizeLoginMethod(method) {
  if (method === 'browser' || method === 'chatgpt') {
    return { type: 'chatgpt' };
  }
  return { type: 'chatgptDeviceCode' };
}

function serializeLoginSession(session) {
  if (!session) return null;
  return {
    loginId: session.loginId,
    method: session.method,
    status: session.status,
    success: session.success,
    error: session.error,
    startedAt: session.startedAt,
    completedAt: session.completedAt || null,
    authUrl: session.response?.authUrl || null,
    verificationUrl: session.response?.verificationUrl || null,
    userCode: session.response?.userCode || null,
    type: session.response?.type || null,
  };
}

function retainCompletedLoginSession(loginId) {
  const session = loginSessions.get(loginId);
  if (!session) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    loginSessions.delete(loginId);
  }, 300000);
  session.timer.unref?.();
}

function closeLoginSession(session) {
  if (!session) return;
  if (session.client) {
    session.client.close();
  }
}

function buildCodexCreativePrompt({ messages = [], documentContent = '', systemPrompt = '', purpose = 'chat' }) {
  const conversation = messages
    .map((message) => `${message.role || 'user'}: ${message.content || ''}`)
    .join('\n\n');

  return `Nymphs World creative task: ${purpose}

System or task instructions:
${systemPrompt || 'Help with worldbuilding, lore, characters, locations, quests, and production draft assets.'}

Current document context:
${documentContent || '(empty)'}

Conversation:
${conversation || '(none)'}

Return only the useful creative response for the user. Do not run shell commands, inspect files, edit files, search the web, or discuss implementation details unless the user explicitly asked for implementation guidance.`;
}

function extractAgentMessageFromTurn(turn, streamedText) {
  const finalMessage = [...(turn?.items || [])]
    .reverse()
    .find((item) => item?.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim());
  return finalMessage?.text || streamedText || '';
}

async function waitForCodexTurn(client, turnId) {
  return new Promise((resolve, reject) => {
    let streamedText = '';
    const timer = setTimeout(() => {
      client.off('notification', onNotification);
      reject(new Error('Timed out waiting for Codex creative turn.'));
    }, TURN_TIMEOUT_MS);

    const finish = (callback) => {
      clearTimeout(timer);
      client.off('notification', onNotification);
      callback();
    };

    const onNotification = (message) => {
      const params = message.params || {};
      if (message.method === 'item/agentMessage/delta' && params.turnId === turnId) {
        streamedText += params.delta || '';
        return;
      }

      if (message.method === 'error') {
        finish(() => reject(new Error(params.error?.message || 'Codex app-server emitted an error.')));
        return;
      }

      if (message.method === 'turn/completed' && params.turn?.id === turnId) {
        if (params.turn.status === 'completed') {
          finish(() => resolve(extractAgentMessageFromTurn(params.turn, streamedText)));
        } else {
          finish(() => reject(new Error(params.turn.error?.message || `Codex turn ended with status ${params.turn.status}.`)));
        }
      }
    };

    client.on('notification', onNotification);
  });
}

async function getCodexStatus() {
  const version = await runCodex(['--version']);
  if (!version.ok) {
    return {
      available: false,
      binary: CODEX_BIN,
      cliVersion: null,
      loggedIn: false,
      authMode: null,
      loginLabel: 'Codex CLI not available',
      appServerDaemon: {
        available: false,
        message: version.stderr || version.error || 'Codex CLI could not be executed.',
      },
      warnings: [version.stderr || version.error || 'Codex CLI could not be executed.'],
    };
  }

  const login = await runCodex(['login', 'status']);
  const loginStatus = login.ok
    ? parseLoginStatus(login.stdout || login.stderr)
    : { loggedIn: false, mode: null, label: login.stderr || login.error || 'Login status unavailable' };

  const daemonVersion = await runCodex(['app-server', 'daemon', 'version']);
  const daemonAvailable = daemonVersion.ok;
  const daemonMessage = daemonVersion.ok
    ? daemonVersion.stdout
    : daemonVersion.stderr || daemonVersion.error || 'Codex app-server daemon unavailable.';

  const warnings = [];
  if (!loginStatus.loggedIn) {
    warnings.push('Codex is installed but no ChatGPT/Codex login is active.');
  }
  if (!daemonAvailable) {
    warnings.push(daemonMessage);
  }

  return {
    available: true,
    binary: CODEX_BIN,
    cliVersion: normalizeVersion(version.stdout || version.stderr),
    loggedIn: loginStatus.loggedIn,
    authMode: loginStatus.mode,
    loginLabel: loginStatus.label,
    appServerDaemon: {
      available: daemonAvailable,
      message: daemonMessage,
    },
    warnings,
  };
}

async function readCodexAccount() {
  return withCodexClient(async (client) => {
    const account = await client.request('account/read', { refreshToken: false }, APP_SERVER_TIMEOUT_MS);
    const models = await client.request('model/list', { limit: 20, includeHidden: false }, APP_SERVER_TIMEOUT_MS);
    return {
      account: account?.account || null,
      requiresOpenaiAuth: Boolean(account?.requiresOpenaiAuth),
      models: normalizeModelList(models),
    };
  });
}

async function fetchCodexModels(settings = {}) {
  const account = await readCodexAccount();
  if (!account.account) {
    throw new Error('Codex is available, but no ChatGPT/Codex account is active.');
  }
  const modelIds = account.models.map((model) => model.id);
  if (settings?.modelName && modelIds.includes(settings.modelName)) {
    return modelIds;
  }
  return modelIds;
}

async function sendCodexCreativeTurn({
  messages,
  documentContent,
  systemPrompt,
  settings,
  purpose = 'chat',
}) {
  return withCodexClient(async (client) => {
    const account = await client.request('account/read', { refreshToken: false }, APP_SERVER_TIMEOUT_MS);
    if (!account?.account) {
      throw new Error('Codex is available, but no ChatGPT/Codex account is active.');
    }

    const modelsResponse = await client.request('model/list', { limit: 20, includeHidden: false }, APP_SERVER_TIMEOUT_MS);
    const models = normalizeModelList(modelsResponse);
    const model = pickCodexModel(models, settings?.modelName);
    const modelInfo = models.find((entry) => entry.id === model || entry.model === model);
    const supportedEfforts = new Set(
      (modelInfo?.supportedReasoningEfforts || [])
        .map((entry) => entry?.reasoningEffort)
        .filter(Boolean)
    );
    const requestedEffort = settings?.codex?.reasoningEffort || null;
    const reasoningEffort = requestedEffort && (!supportedEfforts.size || supportedEfforts.has(requestedEffort))
      ? requestedEffort
      : modelInfo?.defaultReasoningEffort || null;
    const prompt = buildCodexCreativePrompt({ messages, documentContent, systemPrompt, purpose });

    const thread = await client.request('thread/start', {
      ...(model ? { model } : {}),
      cwd: CODEX_WORKSPACE_DIR,
      runtimeWorkspaceRoots: [CODEX_WORKSPACE_DIR],
      approvalPolicy: 'never',
      sandbox: 'read-only',
      config: {
        web_search: 'disabled',
      },
      serviceName: 'Nymphs World',
      baseInstructions: 'You are a creative worldbuilding assistant embedded in Nymphs World, a WORBI-derived game/world production workspace.',
      developerInstructions: 'Answer creative writing and worldbuilding requests directly. Do not use shell commands, filesystem reads, filesystem writes, web search, code edits, or implementation tools. If the user asks for a file, draft the content in the response instead of editing disk.',
      ephemeral: true,
      sessionStartSource: 'startup',
    }, APP_SERVER_TIMEOUT_MS);

    const threadId = thread?.thread?.id;
    if (!threadId) {
      throw new Error('Codex did not return a thread id.');
    }

    const turn = await client.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      cwd: CODEX_WORKSPACE_DIR,
      runtimeWorkspaceRoots: [CODEX_WORKSPACE_DIR],
      approvalPolicy: 'never',
      approvalsReviewer: 'user',
      sandboxPolicy: { type: 'readOnly', networkAccess: false },
      ...(model ? { model } : {}),
      ...(reasoningEffort ? { effort: reasoningEffort } : {}),
    }, APP_SERVER_TIMEOUT_MS);

    const turnId = turn?.turn?.id;
    if (!turnId) {
      throw new Error('Codex did not return a turn id.');
    }

    const content = await waitForCodexTurn(client, turnId);
    return {
      role: 'assistant',
      content,
      model: thread.model || model || settings?.modelName || 'codex-default',
      provider: 'codex',
    };
  });
}

async function startCodexLogin(method = 'device-code') {
  const status = await getCodexStatus();
  if (!status.available) {
    const err = new Error('Codex CLI is not available.');
    err.statusCode = 503;
    err.details = status;
    throw err;
  }

  if (!status.appServerDaemon.available) {
    const err = new Error('Codex app-server is not available yet. Start or repair the standalone Codex app-server before enabling subscription-backed creative generation.');
    err.statusCode = 501;
    err.details = status;
    throw err;
  }

  const client = new CodexAppServerClient();
  await client.start();
  try {
    const loginParams = normalizeLoginMethod(method);
    const response = await client.request('account/login/start', loginParams, APP_SERVER_TIMEOUT_MS);
    const loginId = response?.loginId;
    if (!loginId) {
      client.close();
      return {
        ...response,
        loginId: null,
        method: loginParams.type === 'chatgpt' ? 'browser' : 'device-code',
        status: 'completed',
        success: true,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        authUrl: response?.authUrl || null,
        verificationUrl: response?.verificationUrl || null,
        userCode: response?.userCode || null,
      };
    }

    const session = {
      loginId,
      method: loginParams.type === 'chatgpt' ? 'browser' : 'device-code',
      response,
      client,
      status: 'pending',
      success: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      timer: null,
    };

    const finish = (success, error = null) => {
      session.status = success ? 'completed' : 'failed';
      session.success = Boolean(success);
      session.error = error || null;
      session.completedAt = new Date().toISOString();
      closeLoginSession(session);
      retainCompletedLoginSession(loginId);
    };

    session.timer = setTimeout(() => {
      finish(false, 'Codex sign-in timed out.');
    }, LOGIN_SESSION_TIMEOUT_MS);
    session.timer.unref?.();

    client.on('notification', (message) => {
      if (message.method !== 'account/login/completed') return;
      const params = message.params || {};
      if (params.loginId && params.loginId !== loginId) return;
      finish(Boolean(params.success), params.error || null);
    });

    client.on('closed', (error) => {
      if (session.status !== 'pending') return;
      finish(false, error?.message || 'Codex app-server closed before sign-in completed.');
    });

    loginSessions.set(loginId, session);
    return serializeLoginSession(session);
  } catch (error) {
    client.close();
    throw error;
  }
}

function getCodexLoginStatus(loginId) {
  return serializeLoginSession(loginSessions.get(loginId));
}

async function openCodexLoginSession(loginId) {
  const session = loginSessions.get(loginId);
  if (!session) return null;
  const loginUrl = session.response?.authUrl || session.response?.verificationUrl;
  if (!loginUrl) {
    const err = new Error('Codex sign-in session does not have a browser URL.');
    err.statusCode = 404;
    throw err;
  }
  return openExternalUrl(loginUrl);
}

async function cancelCodexLogin(loginId) {
  const session = loginSessions.get(loginId);
  if (!session) return null;
  if (session.status === 'pending') {
    try {
      await session.client.request('account/login/cancel', { loginId }, APP_SERVER_TIMEOUT_MS);
    } catch {
      // Best-effort cancel; the session is still closed locally below.
    }
    session.status = 'cancelled';
    session.success = false;
    session.error = 'Cancelled';
    session.completedAt = new Date().toISOString();
  }
  closeLoginSession(session);
  retainCompletedLoginSession(loginId);
  return serializeLoginSession(session);
}

export {
  cancelCodexLogin,
  fetchCodexModels,
  getCodexLoginStatus,
  getCodexStatus,
  openCodexLoginSession,
  openExternalUrl,
  readCodexAccount,
  sendCodexCreativeTurn,
  startCodexLogin,
};
