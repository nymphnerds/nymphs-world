import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFile } from 'child_process';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

import { getCodexStatus, startCodexLogin } from '../../../src/services/codexService.js';

const mockExecFile = vi.mocked(execFile);

function mockCodexResponse(stdout: string, stderr = '', error: any = null) {
  mockExecFile.mockImplementationOnce(((_bin: string, _args: string[], _opts: any, cb: any) => {
    cb(error, stdout, stderr);
  }) as any);
}

describe('codexService', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
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
});
