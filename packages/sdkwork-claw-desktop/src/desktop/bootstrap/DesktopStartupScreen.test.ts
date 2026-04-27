import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(
  path.join(import.meta.dirname, 'DesktopStartupScreen.tsx'),
  'utf8',
);

test('desktop startup screen keeps launch chrome within the desktop UI shape system', () => {
  assert.doesNotMatch(source, /rounded-\[[^\]]+\]/);
  assert.doesNotMatch(source, /rounded-(?:xl|2xl|3xl|full)\b/);
  assert.doesNotMatch(source, /tracking-\[[^\]]+\]/);
});

test('desktop startup screen uses the shared icon system for window and startup controls', () => {
  assert.match(source, /from 'lucide-react'/);
  assert.doesNotMatch(source, /<svg[\s>]/);
});
