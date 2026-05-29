import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

import { getCodexStatus, openExternalUrl, startCodexLogin } from '../../../src/services/codexService.js';

const mockExecFile = vi.mocked(execFile);
const mockSpawn = vi.mocked(spawn);

function mockCodexResponse(stdout: string, stderr = '', error: any = null) {
  mockExecFile.mockImplementationOnce(((_bin: string, _args: string[], _opts: any, cb: any) => {
    cb(error, stdout, stderr);
  }) as any);
}

function mockAppServer(assertLoginParams: (params: any) => void) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    killed: false,
    kill: vi.fn(),
    stdin: {
      writable: true,
      write: vi.fn((chunk: string) => {
        const message = JSON.parse(String(chunk));
        if (message.method === 'initialize') {
          stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
          return true;
        }
        if (message.method === 'account/login/start') {
          assertLoginParams(message.params);
          stdout.write(`${JSON.stringify({
            id: message.id,
            result: {
              type: message.params.type,
              loginId: 'login-123',
              authUrl: 'https://chatgpt.com/auth?client_id=test&state=abc',
            },
          })}\n`);
          return true;
        }
        return true;
      }),
    },
  });

  mockSpawn.mockImplementationOnce((() => child) as any);
  return child;
}

describe('codexService', () => {
  const originalWslDistroName = process.env.WSL_DISTRO_NAME;
  const originalWslInterop = process.env.WSL_INTEROP;

  beforeEach(() => {
    mockExecFile.mockReset();
    mockSpawn.mockReset();
    process.env.WSL_DISTRO_NAME = '';
    process.env.WSL_INTEROP = '';
  });

  it('reports ChatGPT login and daemon readiness', async () => {
    mockCodexResponse('codex-cli 1.2.3');
    mockCodexResponse('Logged in using ChatGPT');
    mockCodexResponse('{"cliVersion":"1.2.3","appServerVersion":"1.2.3"}');

    const status = await getCodexStatus();

    expect(status.available).toBe(true);
    expect(status.loggedIn).toBe(true);
    expect(status.authMode).toBe('chatgpt');
    expect(status.appServerDaemon.available).toBe(true);
    expect(status.warnings).toEqual([]);
  });

  it('keeps daemon failures visible without hiding active login', async () => {
    mockCodexResponse('codex-cli 1.2.3');
    mockCodexResponse('Logged in using ChatGPT');
    mockCodexResponse('', 'standalone Codex install not found', { code: 1, message: 'failed' });

    const status = await getCodexStatus();

    expect(status.available).toBe(true);
    expect(status.loggedIn).toBe(true);
    expect(status.appServerDaemon.available).toBe(false);
    expect(status.warnings[0]).toContain('standalone Codex install not found');
  });

  it('rejects login start until app-server is ready', async () => {
    mockCodexResponse('codex-cli 1.2.3');
    mockCodexResponse('Logged in using ChatGPT');
    mockCodexResponse('', 'standalone Codex install not found', { code: 1, message: 'failed' });

    await expect(startCodexLogin('device-code')).rejects.toThrow(/app-server is not available/);
  });

  it('starts browser login with the documented ChatGPT app-server params', async () => {
    mockCodexResponse('codex-cli 1.2.3');
    mockCodexResponse('Not logged in');
    mockCodexResponse('{"cliVersion":"1.2.3","appServerVersion":"1.2.3"}');
    mockAppServer((params) => {
      expect(params).toEqual({ type: 'chatgpt' });
    });

    const login = await startCodexLogin('browser');

    expect(login).toMatchObject({
      loginId: 'login-123',
      method: 'browser',
      status: 'pending',
      authUrl: 'https://chatgpt.com/auth?client_id=test&state=abc',
    });
  });

  it('opens WSL browser login through the Windows URL handler so OAuth query params stay intact', async () => {
    process.env.WSL_DISTRO_NAME = 'NymphsCore_Lite';
    const child = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
    child.unref = vi.fn();
    mockSpawn.mockImplementationOnce(((command: string, args: string[]) => {
      expect(command).toBe('explorer.exe');
      expect(args).toEqual(['https://auth.openai.com/oauth?client_id=test&state=abc']);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    }) as any);

    const result = await openExternalUrl('https://auth.openai.com/oauth?client_id=test&state=abc');

    expect(result).toEqual({ opened: true, via: 'Windows URL handler' });
  });

  it('falls back to PowerShell without routing OAuth URLs through cmd.exe', async () => {
    process.env.WSL_DISTRO_NAME = 'NymphsCore_Lite';
    const failedChild = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
    failedChild.unref = vi.fn();
    const child = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
    child.unref = vi.fn();

    mockSpawn
      .mockImplementationOnce(((command: string) => {
        expect(command).toBe('explorer.exe');
        queueMicrotask(() => failedChild.emit('error', new Error('not available')));
        return failedChild;
      }) as any)
      .mockImplementationOnce(((command: string, args: string[]) => {
        expect(command).toBe('powershell.exe');
        expect(args).toEqual([
          '-NoProfile',
          '-Command',
          '& { param([string] $url) Start-Process -FilePath $url }',
          'https://auth.openai.com/oauth?client_id=test&scope=a%20b&state=abc',
        ]);
        queueMicrotask(() => child.emit('spawn'));
        return child;
      }) as any);

    const result = await openExternalUrl('https://auth.openai.com/oauth?client_id=test&scope=a%20b&state=abc');

    expect(result).toEqual({ opened: true, via: 'PowerShell default browser' });
    expect(mockSpawn).not.toHaveBeenCalledWith('cmd.exe', expect.anything(), expect.anything());
  });

  afterEach(() => {
    if (originalWslDistroName === undefined) {
      delete process.env.WSL_DISTRO_NAME;
    } else {
      process.env.WSL_DISTRO_NAME = originalWslDistroName;
    }
    if (originalWslInterop === undefined) {
      delete process.env.WSL_INTEROP;
    } else {
      process.env.WSL_INTEROP = originalWslInterop;
    }
  });
});
