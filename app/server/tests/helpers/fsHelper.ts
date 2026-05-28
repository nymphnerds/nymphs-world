import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Creates a temporary workspace directory structure for testing.
 * Returns the root path. Caller is responsible for cleanup.
 */
export function createTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-test-'));
  return root;
}

/**
 * Recursively deletes a directory.
 */
export function cleanupTempWorkspace(rootPath: string): void {
  if (fs.existsSync(rootPath)) {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
}

/**
 * Creates a file within a workspace with the given content.
 * Auto-creates parent directories.
 */
export function createTestFile(workspaceRoot: string, relativePath: string, content: string): void {
  const fullPath = path.join(workspaceRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

/**
 * Creates a nested directory structure with sample files for testing.
 * Returns the workspace root.
 *
 * Example structure:
 *   root/
 *   ├── docs/
 *   │   ├── guide.html
 *   │   └── notes.html
 *   ├── lore/
 *   │   └── world.html
 *   └── README.html
 */
export function createSampleWorkspace(): string {
  const root = createTempWorkspace();

  createTestFile(root, 'README.html', '<h1>Project</h1>');
  createTestFile(root, 'docs/guide.html', '<h1>Guide</h1><p>Content here</p>');
  createTestFile(root, 'docs/notes.html', '<h1>Notes</h1><p>Some notes</p>');
  createTestFile(root, 'lore/world.html', '<h1>World</h1><p>World lore</p>');

  return root;
}