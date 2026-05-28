---
name: worbi-tests
description: WORBI test suite guide — Vitest multi-project setup, test patterns, mock strategies, helper usage, and best practices for server and client tests
---

# WORBI Skill — Test Suite Guide

Use this skill when **writing, running, debugging, or maintaining tests** in the WORBI project.

---

## 1. Test Stack Overview

| Layer | Tool | Environment |
|-------|------|-------------|
| Test Runner | Vitest (multi-project) | Root `vitest.config.ts` orchestrates server + client |
| Server Unit | Vitest | `node` environment |
| Server Integration | Vitest + Supertest | HTTP-level Express route testing |
| Client Unit | Vitest | `jsdom` environment |
| Client Components | Vitest + React Testing Library | User-centric component API |
| Coverage | `@vitest/coverage-v8` | Built-in V8 coverage |

**Total:** ~488 tests across 8 phases, organized in `docs/handoff/priority-high/PHASE_*.md`.

---

## 2. Running Tests

All commands run from the **workspace root** (`WORBI/`):

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `vitest run` | Run all tests (server + client) |
| `npm run test:server` | `vitest run --project server` | Server tests only |
| `npm run test:client` | `vitest run --project client` | Client tests only |
| `npm run test:coverage` | `vitest run --coverage` | All tests + unified coverage report |
| `npm run test:watch` | `vitest` | Watch mode (dev) |

**Multi-project architecture:** Root `vitest.config.ts` uses `projects: ['server/vitest.config.ts', 'client/vitest.config.ts']`. Running without `--project` executes both.

---

## 3. Test File Conventions

### Location Rules

| Test Type | Location Pattern | Example |
|-----------|-----------------|---------|
| Server unit | `server/tests/unit/**/` | `server/tests/unit/services/fileService.test.ts` |
| Server integration | `server/tests/integration/` | `server/tests/integration/auth.test.ts` |
| Client hooks | `client/src/hooks/` (beside source) | `client/src/hooks/useAuth.test.ts` |
| Client components | `client/src/components/` (beside source) | `client/src/components/StatusBar.test.tsx` |
| Test helpers | `server/tests/helpers/`, `client/tests/helpers/` | `authHelper.ts`, `mockTiptap.ts` |
| Test setup | `server/tests/setup.ts`, `client/tests/setup.ts` | Env vars, global mocks |

### File Naming
- Test files: `*.test.ts` or `*.test.tsx`
- TypeScript extensions required (even for testing JS server code)

### ESM Import Rule (CRITICAL)
Server source files are `.js` (ESM). Test files are `.ts`. When importing server `.js` files from `.ts` tests, **always include the `.js` extension**:

```ts
// CORRECT
import app from '../../src/index.js';
import * as fileService from '../../../src/services/fileService.js';

// WRONG — will fail to resolve
import app from '../../src/index';
import * as fileService from '../../../src/services/fileService';
```

---

## 4. Server Test Patterns

### 4.1 Unit Tests

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies BEFORE importing the module under test
vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: () => '/tmp/mock-workspace',
  getUserAssetsDir: () => '/tmp/mock-assets',
}));

import * as fileService from '../../../src/services/fileService.js';

describe('serviceName', () => {
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-test-'));
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does something correct', () => {
    // test body
  });
});
```

**Key patterns:**
- Mock dependencies with `vi.mock()` BEFORE the import statement
- Use temp directories for filesystem operations (clean up in `afterEach`)
- Mock `authService` when testing `fileService` to control workspace paths
- Mock `os.homedir()` when testing services that read from `~/.wbu/`

### 4.2 Integration Tests (Supertest)

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

describe('Endpoint Tests', () => {
  const app = getTestApp();

  it('returns 401 without auth', async () => {
    const res = await app.get('/api/protected');
    expect(res.status).toBe(401);
  });

  it('returns 200 with auth', async () => {
    const { token } = await getAuthedApp('testuser');
    const res = await app.get('/api/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

**Auth patterns:**
- `getTestApp()` — returns supertest agent (no auth)
- `getAuthedApp(username)` — logs in and returns `{ agent, token }`
- WORBI uses **passwordless username-only auth** — no passwords, no register endpoint
- `POST /api/auth/login` creates user if they don't exist

### 4.3 Service-Specific Mock Patterns

| Service | What to Mock | How |
|---------|-------------|-----|
| `fileService` | authService (workspace dirs) | `vi.mock('authService.js', ...)` |
| `tagService` | Database file path | Override data dir in temp workspace |
| `toolService` | axios (web_search HTTP) | `vi.spyOn(axios, 'get').mockResolvedValue(...)` |
| `llmService` | axios + config | `vi.mock('config.js')` + `vi.mocked()` for axios |
| `reminderService` | Date.now() | `vi.spyOn(global, 'Date', 'getter').mockImplementation(...)` |
| `locationService` | os.homedir() | `vi.spyOn(os, 'homedir').mockReturnValue(tempDir)` |
| `llmLifecycle` | child_process.spawn | `vi.spyOn(cp, 'spawn').mockReturnValue(mockProcess)` |
| `llmDetector` | **None** — real fetch (no local servers in test env) | Validates `notDetected` code path |
| `imageGenLifecycle` | child_process.spawn | Same pattern as llmLifecycle |
| `providerCatalog` | None (pure data) | No mocks needed |
| `templateService` | Filesystem | Temp workspace + `createTestFile()` |

---

## 5. Client Test Patterns

### 5.1 Hook Tests

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock API BEFORE importing the hook
vi.mock('../services/api', async () => {
  return {
    login: vi.fn(),
    getMe: vi.fn(),
  };
});

import * as api from '../services/api';
const mockLogin = api.login as ReturnType<typeof vi.fn>;
const mockGetMe = api.getMe as ReturnType<typeof vi.fn>;
import useAuth from './useAuth';

beforeEach(() => {
  mockLogin.mockReset();
  mockGetMe.mockReset();
  mockGetMe.mockResolvedValue({ user: { username: 'default' } });
  localStorage.clear();
});

describe('useAuth', () => {
  it('should start unauthenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should login and set token', async () => {
    mockLogin.mockResolvedValue({ token: 'new-token', user: { username: 'user' } });
    mockGetMe.mockResolvedValue({ user: { username: 'user' } });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('user');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('wbu_token')).toBe('new-token');
  });
});
```

**Key patterns:**
- `vi.mock('../services/api', async () => ({ ... }))` with `vi.fn()` stubs
- Cast mocked exports: `const mockFn = api.fn as ReturnType<typeof vi.fn>`
- Use `mockResolvedValueOnce()` per test to avoid test interference
- `await act(async () => { ... })` for async state changes
- `waitFor()` for async effects
- Clear `localStorage` in `beforeEach`/`afterEach`
- Avoid `vi.useFakeTimers()` — use real timers with `waitFor` instead

### 5.2 Component Tests

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  it('renders without crashing', () => {
    render(<StatusBar currentPath={null} wordCount={0} llmConnected={true} error={null} />);
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
  });
});
```

**Lucide-react icon mocking:**
```ts
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const names = ['Home', 'Search', 'Settings', 'LogOut'];
  for (const n of names) {
    icons[n] = vi.fn((props: any) => <svg data-testid={n} {...props} />);
  }
  return icons;
});
```

**TipTap mocking (for DocumentEditor tests):**
```ts
vi.mock('@tiptap/react', () => {
  const mockChain = { run: vi.fn(), focus: vi.fn(), insertContent: vi.fn().mockReturnThis() };
  const mockCanChain = { undo: vi.fn().mockReturnValue(false), redo: vi.fn().mockReturnValue(false) };
  const mockCommands = {
    focus: vi.fn(), insertContent: vi.fn(), setContent: vi.fn(), clearContent: vi.fn(),
    toggleBold: vi.fn(), toggleItalic: vi.fn(), toggleUnderline: vi.fn(),
    toggleBulletList: vi.fn(), toggleOrderedList: vi.fn(), toggleHeading: vi.fn(),
    createParagraphNear: vi.fn(), undo: vi.fn(), redo: vi.fn(),
  };
  const mockEditor = {
    chain: vi.fn().mockReturnValue(mockChain),
    focus: vi.fn(), setContent: vi.fn(), getHTML: vi.fn(), getText: vi.fn(),
    isActive: vi.fn(), isFocused: vi.fn(), can: vi.fn().mockReturnValue(mockCanChain),
    commands: mockCommands, state: { doc: {}, selection: {} },
    view: { dispatch: vi.fn(), props: {} }, on: vi.fn(), off: vi.fn(), destroy: vi.fn(),
  };
  const EditorContent = vi.fn(({ editor }: { editor: any }) => null);
  const BubbleMenu = vi.fn(() => null);
  const FloatingMenu = vi.fn(() => null);
  return { useEditor: vi.fn().mockReturnValue(mockEditor), EditorContent, BubbleMenu, FloatingMenu };
});
```

**Important:** TipTap mock must be at module scope BEFORE any import that transitively imports `@tiptap/react`.

**Container-based querying** (when screen queries fail due to duplicate elements):
```ts
const { container } = render(<Component />);
const buttons = container.querySelectorAll('.tag-filter-btn');
const target = Array.from(buttons).find(b => b.textContent === 'lore')!;
target.click();
```

---

## 6. Test Helper Reference

### Server Helpers

| Helper | Location | Usage |
|--------|----------|-------|
| `getTestApp()` | `testApp.ts` | Returns supertest agent (no auth) |
| `getAuthedApp(username)` | `testApp.ts` | Returns `{ agent, token }` for authenticated tests |
| `generateTestToken(username)` | `authHelper.ts` | Valid JWT token |
| `generateExpiredToken(username)` | `authHelper.ts` | Expired JWT (0s expiry) |
| `generateTamperedToken(username)` | `authHelper.ts` | Invalid signature JWT |
| `createTempWorkspace()` | `fsHelper.ts` | Creates temp dir, returns path |
| `cleanupTempWorkspace(path)` | `fsHelper.ts` | Recursively deletes temp dir |
| `createTestFile(root, relPath, content)` | `fsHelper.ts` | Creates file with auto-parent-dirs |
| `createSampleWorkspace()` | `fsHelper.ts` | Creates nested dir with sample .html files |

### Client Helpers

| Helper | Location | Usage |
|--------|----------|-------|
| `mockTiptapReact()` | `mockTiptap.ts` | Full `@tiptap/react` mock factory |
| `mockUseEditor(custom?)` | `mockTiptap.ts` | Direct `useEditor` hook mock |

---

## 7. Critical Gotchas

### 7.1 Auth Gotchas

| Gotcha | Detail |
|--------|--------|
| **Passwordless auth** | No passwords, no bcrypt, no register endpoint. `POST /api/auth/login` creates user if new |
| **verifyToken() returns object** | Returns `{ valid: boolean, username?: string }` — does NOT throw on invalid tokens |
| **Middleware checks valid field** | `authMiddleware` checks `verifyToken().valid`, not exceptions |
| **JWT secret shared** | `authHelper.ts` and `authMiddleware` import from same `config.js` |

### 7.2 Path Safety Gotchas

| Gotcha | Detail |
|--------|--------|
| **path.join (not path.resolve)** | `getSafePath()` uses `path.join()` — absolute paths like `/etc/passwd` become workspace subdirs |
| **null/undefined coercion** | `getSafePath()` uses `relPath \|\| ''` — null/undefined become workspace root, not errors |
| **Backslashes on Linux** | `path.normalize` does NOT convert `\` to `/` on Linux — `..\\..\\` stays literal |
| **Traversal check catches ..** | Real security: the `..` sequence check, not absolute path detection |

### 7.3 Test Environment Gotchas

| Gotcha | Detail |
|--------|--------|
| **NODE_ENV=test** | `server/src/index.js` guards `app.listen()` with `NODE_ENV !== 'test'` check |
| **ESM .js extensions** | All imports of server `.js` files from `.ts` tests must include `.js` extension |
| **Database format** | Server uses newline-separated JSON (not JSON arrays) in `.txt` database files |
| **scrollIntoView in jsdom** | `HTMLElement.prototype.scrollIntoView` not available — mock with `vi.fn()` |
| **TipTap mock scope** | Must use `vi.mock()` at module top, BEFORE any import that transitively loads TipTap |

### 7.4 Known Bugs

| Bug | Status |
|-----|--------|
| Client testPath getter bug — `@testing-library/jest-dom@6.9.1` + `vitest@1.6.1` compatibility issue | Pre-existing, affects client tests |
| 12 toolService.test.ts failures — file operation tests (list_directory, write_file, etc.) | Pre-existing, unrelated to infra |
| Node 18 engine warnings — vitest + deps require Node 20+ | Works but shows warnings |

---

## 8. Coverage Rules

### Current Baseline
| Metric | Threshold |
|--------|-----------|
| Lines | 33% |
| Branches | 0% (not gated) |
| Functions | 47% |
| Statements | 33% |

### Excluded Files
- `client/src/main.tsx` — Entry point only
- `client/src/App.tsx` — Orchestrator (~1,376 lines), tested via individual hooks/components

### Critical Paths (Require 100% Coverage)
- `getSafePath()`, `getImageFullPath()`, `getSafeWorkspaceFilePath()` — Path traversal
- `loginOrCreate()`, `verifyToken()` — Auth
- `authMiddleware` — Route protection
- `deleteItem()`, `renameItem()`, `copyItem()`, `moveItem()` — File operations
- `executeTool()` dispatch — AI tool execution

### Ratcheting Thresholds
Edit `vitest.config.ts` → `coverage.thresholds`. Recommended: +5% per major release until 70% reached.

---

## 9. Phase Reference

Quick index of phase documents in `docs/handoff/priority-high/`:

| Phase | File | Coverage | Tests |
|-------|------|----------|-------|
| 0 | `PHASE_0_TEST_INFRASTRUCTURE.md` | Infra setup (configs, helpers) | 0 (foundation) |
| 1 | `PHASE_1_SECURITY_TESTS.md` | Path traversal, auth, middleware | 57 |
| 2 | `PHASE_2_CORE_SERVICES.md` | file, tag, tool, llm, reminder, location | 246 |
| 3 | `PHASE_3_LIFECYCLE_CONFIG_SERVICES.md` | Lifecycle, detector, provider, template | 99 |
| 4 | `PHASE_4_CLIENT_HOOKS.md` | useAuth, useFiles, useTags, etc. | 72 |
| 5 | `PHASE_5_FEATURE_MODULES.md` | Editor, InfoPanel, Reminders, Tags, Timeline | 31 |
| 6 | `PHASE_6_COMPONENT_SMOKE_TESTS.md` | Component smoke tests | 153 |
| 7 | `PHASE_7_TIPAP_AND_UTILS.md` | WikiLink, storyFileDetector, templateDetector | ~18 |
| 8 | `PHASE_8_COVERAGE_AND_CI.md` | Coverage thresholds, CI pipeline | Config only |

---

## 10. Adding New Tests

### For a New Server Service

1. Create temp workspace in `beforeEach`, cleanup in `afterEach`
2. Mock dependencies with `vi.mock()` BEFORE importing the service
3. Test happy path, error path, edge cases
4. Use helpers from `server/tests/helpers/`
5. Place in `server/tests/unit/services/<name>.test.ts`

### For a New Client Hook

1. Mock `../services/api` with `vi.fn()` stubs
2. Use `renderHook()` + `act()` for async operations
3. Test initial state, state transitions, error states
4. Clear `localStorage` in setup/teardown
5. Place in `client/src/hooks/<name>.test.ts`

### For a New Client Component

1. Mock dependencies (lucide-react, TipTap, heavy sub-components)
2. Render with minimal props
3. Assert key elements exist in DOM
4. Test interactions with `fireEvent` or `userEvent`
5. Place in `client/src/components/<Name>.test.tsx`

### For a New API Endpoint (Integration)

1. Use `getTestApp()` for unauthenticated tests
2. Use `getAuthedApp(username)` for authenticated tests
3. Test 401 without auth, 200 with auth, 400 on bad input
4. Place in `server/tests/integration/<domain>.test.ts`

### After Writing Tests

1. Run `npm run test:server` or `npm run test:client` to verify
2. Run `npm run test:coverage` to check coverage impact
3. Update relevant phase doc if it's a new phase
4. Do NOT update CHANGELOG until all tests pass and user confirms

---

## 11. Related Skills

| Skill | When to Also Use |
|-------|-----------------|
| `worbi-conventions` | Adding new features that need tests |
| `worbi-project` | Understanding project structure |
| `worbi-architecture` | Understanding data flow for integration tests |
| `worbi-api` | Testing API endpoints |
| `worbi-app-refactor` | Testing feature hooks after App.tsx refactor |