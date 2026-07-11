import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStoredZipArchive } from '../test-support/archive-fixtures.mjs';
import { readZipArchiveEntries } from './archive-entry-safety.mjs';

test('archive entry safety classifies Unix-mode ZIP directory entries without requiring a trailing slash', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-archive-entry-safety-'));
  const archivePath = path.join(tempRoot, 'unix-directory.zip');

  try {
    mkdirSync(path.dirname(archivePath), { recursive: true });
    writeFileSync(
      archivePath,
      createStoredZipArchive([
        {
          name: 'Agent Studio.app',
          content: '',
          externalAttributes: 0o040755 << 16,
        },
      ]),
    );

    const entries = readZipArchiveEntries(archivePath, {
      context: 'archive entry safety test',
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].normalizedPath, 'Agent Studio.app');
    assert.equal(entries[0].type, 'directory');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
