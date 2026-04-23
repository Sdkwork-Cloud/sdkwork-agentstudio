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

const packageJson = readJson('package.json');

runTest('foundation runner executes the browser persistence policy unit coverage', () => {
  const foundationRunner = read('scripts/run-sdkwork-foundation-check.mjs');

  assert.match(
    foundationRunner,
    /packages\/sdkwork-claw-infrastructure\/src\/platform\/browserPersistencePolicy\.test\.ts/,
  );
});

runTest('automation gate freezes the browser persistence policy contract', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/browser-persistence-policy-contract\.test\.mjs/,
  );
});
