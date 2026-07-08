import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

runTest('sdkwork-clawstudio-account parity checks use the shared Node TypeScript runner for workspace-loaded account services', () => {
  const workspacePackageJson = read('package.json');
  const accountCheckRunner = read('scripts/run-sdkwork-account-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');

  assert.match(
    workspacePackageJson,
    /"check:sdkwork-account"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-account-check\.mjs"/,
  );
  assert.match(accountCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(accountCheckRunner, /accountService\.test\.ts/);
  assert.match(accountCheckRunner, /sdkwork-account-contract\.test\.ts/);
  assert.match(nodeTypeScriptRunner, /ts-extension-loader\.mjs/);
});

runTest('sdkwork-clawstudio-account is implemented locally instead of re-exporting claw-studio-account', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-clawstudio-account/package.json');
  const indexSource = read('packages/sdkwork-clawstudio-account/src/index.ts');
  const accountServiceSource = read('packages/sdkwork-clawstudio-account/src/services/accountService.ts');
  const coreAccountServiceSource = read('packages/sdkwork-clawstudio-core/src/services/accountService.ts');

  assert.ok(exists('packages/sdkwork-clawstudio-account/src/Account.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-account/src/services/accountService.ts'));
  assert.ok(exists('packages/sdkwork-clawstudio-core/src/services/accountService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/clawstudio-studio-account']);
  assert.ok(pkg.dependencies?.['@sdkwork/clawstudio-core']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-account/);
  assert.match(indexSource, /Account/);

  const accountSource = read('packages/sdkwork-clawstudio-account/src/Account.tsx');
  assert.match(accountSource, /useTranslation/);
  assert.match(accountSource, /t\('account\.title'\)/);
  assert.match(accountSource, /wallet/i);
  assert.match(accountServiceSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(accountServiceSource, /@sdkwork\/claw-core\/services\//);
  assert.doesNotMatch(accountServiceSource, /getAppSdkClientWithSession/);
  assert.doesNotMatch(accountServiceSource, /unwrapAppSdkResponse/);
  assert.match(coreAccountServiceSource, /getClawStudioAppClientWithSession/);
  assert.match(coreAccountServiceSource, /unwrapAppSdkResponse/);
  assert.doesNotMatch(accountServiceSource, /@sdkwork\/claw-infrastructure/);
});
