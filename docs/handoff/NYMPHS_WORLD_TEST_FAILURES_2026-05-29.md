# Nymphs World Test Failure Notes - 2026-05-29

This note records unrelated failures seen while verifying the Codex settings
work. The focused Codex and LLM checks passed; the items below need their own
cleanup pass.

## Passing Checks

- `app/client`: `npm run test:typecheck`
- `app/client`: `npm run build`
- `app/server`: `node --check src/services/codexService.js`
- `app/server`: `node --check src/config.js`
- `app/server`: `npm test -- tests/unit/services/codexService.test.ts tests/unit/services/llmService.test.ts`

Focused server result: 2 test files, 29 tests passed.

## Unrelated Unit Failures

`tests/unit/services/llmAgentTools.test.ts` failed in the full server suite.

Observed causes:

- The test mocks are missing current tag/location exports:
  `removeTagFromFile` and `removeLocationFromFile`.
- Some expectations still use the old service signatures. The implementation
  now calls tag/location services with the username first, such as
  `getFilesByTag('testuser', 'MainChar')`.
- `location_list` and `location_create` now require authenticated context, but
  the existing tests still treat them like unauthenticated helper calls.

Follow-up:

- Update the mocked tag/location service surface.
- Update expected calls to include username-aware signatures.
- Decide whether each location tool test should provide authenticated context
  or explicitly assert the auth failure.

## Sandbox-Limited Integration Failures

The broader integration suite hit listener failures in this Codex sandbox:

```text
listen EPERM: operation not permitted 0.0.0.0
```

Affected integration areas included auth, settings, timeline, image generation,
and graph tests through their supertest app startup path.

Follow-up:

- Run these integration tests outside the sandbox or in CI with normal listen
  permissions.
- Consider adding a test mode that binds only where the sandbox allows, or uses
  a no-listen request harness.

## Current Interpretation

These failures do not look related to the Codex provider UI or sign-in changes.
The focused Codex service checks passed, and the remaining failures are either
test-harness drift or sandbox listener restrictions.
