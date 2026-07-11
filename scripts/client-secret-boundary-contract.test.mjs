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
const webViteConfig = read('packages/sdkwork-agentstudio-pc-web/vite.config.ts');
const desktopViteConfig = read('packages/sdkwork-agentstudio-pc-desktop/vite.config.ts');
const webViteEnv = read('packages/sdkwork-agentstudio-pc-web/src/vite-env.d.ts');
const desktopViteEnv = read('packages/sdkwork-agentstudio-pc-desktop/src/vite-env.d.ts');
const rootEnvExample = read('.env.example');
const rootEnvDevelopment = read('.env.development');
const rootEnvTest = read('.env.test');
const rootEnvProduction = read('.env.production');
const webEnvExample = read('packages/sdkwork-agentstudio-pc-web/.env.example');
const desktopEnvExample = read('packages/sdkwork-agentstudio-pc-desktop/.env.example');

runTest('host vite configs no longer expose browser-side root token injection', () => {
  assert.doesNotMatch(webViteConfig, /VITE_ACCESS_TOKEN/);
  assert.doesNotMatch(desktopViteConfig, /VITE_ACCESS_TOKEN/);
});

runTest('host vite env typings no longer advertise VITE_ACCESS_TOKEN', () => {
  assert.doesNotMatch(webViteEnv, /VITE_ACCESS_TOKEN/);
  assert.doesNotMatch(desktopViteEnv, /VITE_ACCESS_TOKEN/);
});

runTest('tracked env examples stay secret-free for browser and desktop hosts', () => {
  assert.doesNotMatch(rootEnvExample, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(rootEnvDevelopment, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(rootEnvTest, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(rootEnvProduction, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(webEnvExample, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(desktopEnvExample, /VITE_ACCESS_TOKEN=/);
});

runTest('automation gate freezes the client secret boundary contract', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/client-secret-boundary-contract\.test\.mjs/,
  );
});
