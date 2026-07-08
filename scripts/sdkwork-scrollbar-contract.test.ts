import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-clawstudio-shell exposes a theme-aware global scrollbar system', () => {
  const stylesSource = read('packages/sdkwork-clawstudio-shell/src/styles/index.css');

  assert.match(stylesSource, /@source\s+"\.\.\/\.\.\/\.\.\/";/);
  assert.doesNotMatch(stylesSource, /@source\s+"\.\.\/\.\.\/\.\.\/\.\.\/";/);
  assert.match(stylesSource, /--scrollbar-size:/);
  assert.match(stylesSource, /--scrollbar-track:/);
  assert.match(stylesSource, /--scrollbar-thumb:/);
  assert.match(stylesSource, /--scrollbar-thumb-hover:/);
  assert.match(stylesSource, /color-mix\(/);
  assert.match(stylesSource, /\.dark\s*\{/);
});

runTest('sdkwork-clawstudio-shell styles visible scroll containers consistently while preserving opt-out utilities', () => {
  const stylesSource = read('packages/sdkwork-clawstudio-shell/src/styles/index.css');

  assert.match(stylesSource, /html,\s*body/);
  assert.match(stylesSource, /scrollbar-width:\s*thin/);
  assert.match(stylesSource, /scrollbar-color:\s*var\(--scrollbar-thumb\)\s+var\(--scrollbar-track\)/);
  assert.match(stylesSource, /::\-webkit-scrollbar-thumb/);
  assert.match(stylesSource, /\.custom-scrollbar/);
  assert.match(stylesSource, /\.scrollbar-hide/);
  assert.match(stylesSource, /display:\s*none/);
});
