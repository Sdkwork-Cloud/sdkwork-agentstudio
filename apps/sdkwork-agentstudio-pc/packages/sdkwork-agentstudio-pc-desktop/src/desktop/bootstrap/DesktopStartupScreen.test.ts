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

test('desktop startup screen reuses the shell app header for window controls', () => {
  assert.match(source, /import \{ AppHeader \} from '@sdkwork\/claw-shell';/);
  assert.doesNotMatch(source, /@sdkwork\/claw-core/);
  assert.match(source, /<AppHeader\s+mode="window-controls"/);
  assert.match(source, /windowControlLabels=\{getStartupWindowControlLabels\(language\)\}/);
  assert.doesNotMatch(source, /StartupWindowControls/);
  assert.doesNotMatch(source, /WindowControlButton/);
  assert.doesNotMatch(source, /minimizeWindow/);
  assert.doesNotMatch(source, /maximizeWindow/);
  assert.doesNotMatch(source, /restoreWindow/);
  assert.doesNotMatch(source, /closeWindow/);
  assert.doesNotMatch(source, /isWindowMaximized/);
  assert.doesNotMatch(source, /subscribeWindowMaximized/);
});
