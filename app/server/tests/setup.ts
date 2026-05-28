import { vi, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Set test environment
process.env.NODE_ENV = 'test';

// Isolate test users.json from production data
// This prevents integration tests from corrupting or overwriting real user accounts.
const TEST_DATA_DIR = path.join(os.tmpdir(), 'worbi-test-data');
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.WORBI_USERS_JSON = path.join(TEST_DATA_DIR, 'users.json');

// After all tests complete, clean up the isolated test data directory
afterAll(() => {
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('Failed to clean up test data directory:', err);
  }
});

// Mock global fetch
globalThis.fetch = vi.fn() as any;

// Override config.port to 0 (random port) in tests to avoid port conflicts
// This is handled per-test by mocking, not globally

// Mock console methods to reduce test output noise (optional - comment out for debugging)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
