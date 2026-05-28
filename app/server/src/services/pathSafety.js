import path from 'path';

function hasControlChars(value) {
  return /[\x00-\x1f]/.test(value);
}

function normalizeRelativePath(input = '') {
  const value = String(input ?? '').replace(/\\/g, '/').trim();

  if (hasControlChars(value)) {
    throw new Error('Invalid path: contains control characters');
  }
  if (value === '') {
    return '';
  }
  if (path.posix.isAbsolute(value)) {
    throw new Error('Invalid path: absolute paths are not allowed');
  }

  const normalized = path.posix.normalize(value);
  if (normalized === '.' || normalized === '') {
    return '';
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error('Invalid path: path traversal detected');
  }

  return normalized;
}

function assertInsideRoot(root, candidatePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);

  if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new Error('Invalid path: path traversal detected');
  }

  return resolvedCandidate;
}

function safeJoin(root, ...parts) {
  const resolvedRoot = path.resolve(root);
  const cleanParts = [];

  for (const part of parts) {
    const normalized = normalizeRelativePath(part);
    if (normalized) {
      cleanParts.push(...normalized.split('/').filter(Boolean));
    }
  }

  return assertInsideRoot(resolvedRoot, path.join(resolvedRoot, ...cleanParts));
}

function safeLeafName(input, label = 'name') {
  const value = String(input ?? '').replace(/\\/g, '/').trim();

  if (!value) {
    throw new Error(`Invalid ${label}: value is required`);
  }
  if (hasControlChars(value)) {
    throw new Error(`Invalid ${label}: contains control characters`);
  }
  if (value.includes('/')) {
    throw new Error(`Invalid ${label}: path separators are not allowed`);
  }
  if (value === '.' || value === '..') {
    throw new Error(`Invalid ${label}: reserved path name`);
  }

  return value;
}

function toPosixRelative(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join('/');
}

export {
  assertInsideRoot,
  normalizeRelativePath,
  safeJoin,
  safeLeafName,
  toPosixRelative,
};
