import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('release path helper normalizes and rejects unsafe release-relative paths', async () => {
  const pathsPath = path.join(rootDir, 'scripts', 'release', 'release-paths.mjs');
  const releasePaths = await import(pathToFileURL(pathsPath).href);

  assert.equal(
    releasePaths.normalizeReleaseRelativePath('web\\claw-studio-web-assets.tar.gz'),
    'web/claw-studio-web-assets.tar.gz',
  );

  assert.doesNotThrow(() => releasePaths.assertSafeReleaseRelativePath(
    'web/claw-studio-web-assets.tar.gz',
    { contextLabel: 'Release manifest' },
  ));

  assert.throws(
    () => releasePaths.assertSafeReleaseRelativePath(
      'C:/absolute/windows/path.tar.gz',
      { contextLabel: 'Release manifest' },
    ),
    /unsafe artifact path/,
  );
  assert.throws(
    () => releasePaths.assertSafeReleaseRelativePath(
      '../escape.tar.gz',
      { contextLabel: 'Release manifest' },
    ),
    /unsafe artifact path/,
  );
  assert.throws(
    () => releasePaths.assertSafeReleaseRelativePath(
      './web/claw-studio-web-assets.tar.gz',
      { contextLabel: 'Release manifest' },
    ),
    /non-canonical artifact path/,
  );
});
