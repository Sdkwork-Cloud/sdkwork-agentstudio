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

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
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

runTest('workspace lint compiles both web and desktop hosts before parity and automation gates', () => {
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm --filter @sdkwork\/claw-web lint/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm --filter @sdkwork\/claw-desktop lint/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:arch/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:parity/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:automation/);
});

runTest('automation gate freezes browser secret and persistence boundary contracts', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/client-secret-boundary-contract\.test\.mjs/,
  );
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/browser-persistence-policy-contract\.test\.mjs/,
  );
});

runTest('OpenClaw quality gate keeps fact-source tests in parity runners', () => {
  const foundationRunner = read('scripts/run-sdkwork-foundation-check.mjs');
  const instancesRunner = read('scripts/run-sdkwork-instances-check.mjs');
  const agentRunner = read('scripts/run-sdkwork-agent-check.mjs');
  const channelsRunner = read('scripts/run-sdkwork-channels-check.mjs');

  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-foundation/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-agent/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-channels/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-instances/);
  assert.match(
    packageJson.scripts['check:sdkwork-hosts'],
    /sdkwork-run-node scripts\/desktop-window-chrome-contract\.test\.mjs/,
    'check:sdkwork-hosts must execute the desktop tray and window chrome contract',
  );

  assert.match(
    packageJson.scripts['check:sdkwork-foundation'],
    /sdkwork-run-node scripts\/run-sdkwork-foundation-check\.mjs/,
    'check:sdkwork-foundation must execute the shared foundation runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-agent'],
    /sdkwork-run-node scripts\/run-sdkwork-agent-check\.mjs/,
    'check:sdkwork-agent must execute the shared agent runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-channels'],
    /sdkwork-run-node scripts\/run-sdkwork-channels-check\.mjs/,
    'check:sdkwork-channels must execute the shared channels runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /sdkwork-run-node scripts\/run-sdkwork-instances-check\.mjs/,
    'check:sdkwork-instances must execute the shared instances runner',
  );

  assert.match(
    foundationRunner,
    /packages\/sdkwork-claw-infrastructure\/src\/platform\/webStudio\.test\.ts/,
    'foundation runner must execute webStudio fact-source coverage',
  );
  assert.match(
    agentRunner,
    /packages\/sdkwork-claw-agent\/src\/services\/agentInstallService\.test\.ts/,
    'agent runner must execute agentInstallService fact-source coverage',
  );
  assert.match(
    channelsRunner,
    /packages\/sdkwork-claw-channels\/src\/services\/channelService\.test\.ts/,
    'channels runner must execute channelService fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawConfigSchemaSupport\.test\.ts/,
    'instances runner must execute config schema fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawManagementCapabilities\.test\.ts/,
    'instances runner must execute management capabilities fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawProviderWorkspacePresentation\.test\.ts/,
    'instances runner must execute provider workspace fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/instanceOnboardingService\.test\.ts/,
    'instances runner must execute OpenClaw onboarding association coverage',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /sdkwork-run-node --experimental-strip-types scripts\/sdkwork-instances-contract\.test\.ts/,
    'check:sdkwork-instances must keep Instance Detail contract coverage in the formal gate',
  );
});

runTest('OpenClaw quality gate centralizes canonical built-in instance id literals inside targeted desktop and release tests', () => {
  const targetedFiles = [
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts',
    'scripts/release/smoke-desktop-startup-evidence.test.mjs',
  ];

  for (const relPath of targetedFiles) {
    const source = read(relPath);
    assert.match(
      source,
      /const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';/,
      `${relPath} must declare a local BUILT_IN_INSTANCE_ID constant for canonical built-in identity reuse`,
    );
    assert.equal(
      countMatches(source, /managed-openclaw-primary/g),
      1,
      `${relPath} should keep the canonical managed-openclaw-primary literal in exactly one local constant declaration`,
    );
  }
});
