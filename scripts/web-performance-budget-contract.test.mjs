import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const workspacePackageJson = readJson('package.json');
const webPackageJson = readJson('packages/sdkwork-agentstudio-pc-web/package.json');

runTest('web host build commands enforce the frozen web performance budget after Vite build', () => {
  assert.match(
    webPackageJson.scripts.build ?? '',
    /node \.\.\/\.\.\/scripts\/check-web-performance-budget\.mjs/,
  );
  assert.match(
    webPackageJson.scripts['build:prod'] ?? '',
    /node \.\.\/\.\.\/scripts\/check-web-performance-budget\.mjs/,
  );
});

runTest('workspace automation freezes the web performance budget gate contract', () => {
  assert.match(
    workspacePackageJson.scripts['check:automation'] ?? '',
    /node scripts\/web-performance-budget-contract\.test\.mjs/,
  );
});
