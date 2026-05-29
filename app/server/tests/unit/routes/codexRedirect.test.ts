import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/codexService.js', () => ({
  cancelCodexLogin: vi.fn(),
  getCodexLoginUrl: vi.fn(),
  getCodexLoginStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  logoutCodex: vi.fn(),
  openCodexLoginSession: vi.fn(),
  openExternalUrl: vi.fn(),
  readCodexAccount: vi.fn(),
  startCodexLogin: vi.fn(),
}));

import { getCodexLoginUrl } from '../../../src/services/codexService.js';
import { redirectCodexLogin } from '../../../src/routes/codex.js';

const mockGetCodexLoginUrl = vi.mocked(getCodexLoginUrl);

describe('codex public redirect routes', () => {
  it('redirects a short local login URL to the exact Codex auth URL', async () => {
    const authUrl = 'https://chatgpt.com/auth?client_id=test&scope=a%20b&state=abc';
    mockGetCodexLoginUrl.mockReturnValueOnce(authUrl);
    const req = { params: { loginId: 'login-123' } };
    const res = {
      set: vi.fn(),
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    redirectCodexLogin(req as any, res as any);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.redirect).toHaveBeenCalledWith(302, authUrl);
    expect(res.status).not.toHaveBeenCalled();
  });
});
