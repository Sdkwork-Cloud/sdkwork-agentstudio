import path from 'node:path';

export function normalizeReleaseRelativePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/');
}

export function assertSafeReleaseRelativePath(relativePath, {
  contextLabel,
  artifactPathLabel = 'artifact path',
}) {
  if (!relativePath) {
    throw new Error(`${contextLabel} path must not be empty.`);
  }

  if (
    relativePath.includes('\0')
    || relativePath.includes(':')
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split('/').includes('..')
  ) {
    throw new Error(`${contextLabel} contains an unsafe ${artifactPathLabel}: ${relativePath}`);
  }

  if (path.posix.normalize(relativePath) !== relativePath) {
    throw new Error(`${contextLabel} contains a non-canonical ${artifactPathLabel}: ${relativePath}`);
  }
}
