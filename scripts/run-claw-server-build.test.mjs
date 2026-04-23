import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function toExpectedWslPath(pathValue) {
  const normalizedPath = path.resolve(pathValue);
  const driveLetterMatch = normalizedPath.match(/^([A-Za-z]):[\\/](.*)$/);
  if (!driveLetterMatch) {
    return normalizedPath.replaceAll('\\', '/');
  }

  const [, driveLetter, remainder = ''] = driveLetterMatch;
  return `/mnt/${driveLetter.toLowerCase()}/${remainder.replaceAll('\\', '/')}`;
}

test('server build helper creates a default release cargo plan', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    env: {},
    hostPlatform: 'linux',
  });

  assert.deepEqual(plan, {
    command: 'cargo',
    args: ['build', '--manifest-path', 'src-host/Cargo.toml', '--release'],
    cwd: path.join(rootDir, 'packages', 'sdkwork-claw-server'),
    env: {},
  });
});

test('server build helper forwards an explicit rust target triple', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    targetTriple: 'aarch64-unknown-linux-gnu',
    env: {},
    hostPlatform: 'linux',
  });

  assert.deepEqual(plan, {
    command: 'cargo',
    args: [
      'build',
      '--manifest-path',
      'src-host/Cargo.toml',
      '--release',
      '--target',
      'aarch64-unknown-linux-gnu',
    ],
    cwd: path.join(rootDir, 'packages', 'sdkwork-claw-server'),
    env: {
      SDKWORK_SERVER_TARGET: 'aarch64-unknown-linux-gnu',
      SDKWORK_SERVER_TARGET_PLATFORM: 'linux',
      SDKWORK_SERVER_TARGET_ARCH: 'arm64',
    },
  });
});

test('server build helper routes Windows-hosted Linux targets through WSL when a distro is available', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    targetTriple: 'x86_64-unknown-linux-gnu',
    env: {},
    hostPlatform: 'win32',
    wslDistributions: ['docker-desktop', 'Ubuntu-22.04'],
  });

  assert.equal(plan.command, 'wsl.exe');
  assert.deepEqual(plan.args.slice(0, 5), [
    '--distribution',
    'Ubuntu-22.04',
    '--',
    'bash',
    '-lc',
  ]);
  assert.equal(plan.cwd, path.join(rootDir, 'packages', 'sdkwork-claw-server'));
  assert.deepEqual(plan.env, {});
  assert.equal(plan.runner, 'wsl');
  assert.equal(plan.wslDistribution, 'Ubuntu-22.04');
  assert.match(
    plan.args[5],
    /cargo build --manifest-path src-host\/Cargo\.toml --release --target x86_64-unknown-linux-gnu/,
  );
  assert.match(
    plan.args[5],
    new RegExp(`cd '${toExpectedWslPath(path.join(rootDir, 'packages', 'sdkwork-claw-server'))}'`),
  );
  assert.match(plan.args[5], /export SDKWORK_SERVER_TARGET='x86_64-unknown-linux-gnu'/);
});

test('server build helper prefers a WSL distro that already exposes cargo when multiple Linux distros are installed', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    targetTriple: 'x86_64-unknown-linux-gnu',
    env: {},
    hostPlatform: 'win32',
    wslDistributions: ['Ubuntu-24.04', 'Ubuntu-22.04'],
    distributionSupportsCargo(distribution) {
      return distribution === 'Ubuntu-22.04';
    },
  });

  assert.equal(plan.command, 'wsl.exe');
  assert.equal(plan.wslDistribution, 'Ubuntu-22.04');
});

test('server build helper rejects a missing --target value instead of silently falling back', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.parseArgs, 'function');
  assert.throws(
    () => helper.parseArgs(['--target']),
    /Missing value for --target/,
  );
});

test('server build helper uses the shared Rust toolchain path for native cargo builds', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.runServerBuild, 'function');

  let ensureCalls = 0;
  let wrapCalls = 0;
  let spawnInvocation = null;

  const plan = helper.runServerBuild({
    env: {
      PATH: 'base-path',
      SDKWORK_TEST_ENV: '1',
    },
    hostPlatform: 'linux',
    ensureRustToolchain() {
      ensureCalls += 1;
    },
    withRustToolchainPathFn(env) {
      wrapCalls += 1;
      assert.equal(env.PATH, 'base-path');
      assert.equal(env.SDKWORK_TEST_ENV, '1');
      return {
        ...env,
        PATH: 'rust-toolchain-path',
      };
    },
    spawnSyncImpl(command, args, options) {
      spawnInvocation = { command, args, options };
      return {
        status: 0,
      };
    },
  });

  assert.equal(plan.command, 'cargo');
  assert.equal(ensureCalls, 1);
  assert.equal(wrapCalls, 1);
  assert.deepEqual(spawnInvocation, {
    command: 'cargo',
    args: ['build', '--manifest-path', 'src-host/Cargo.toml', '--release'],
    options: {
      cwd: path.join(rootDir, 'packages', 'sdkwork-claw-server'),
      env: {
        PATH: 'rust-toolchain-path',
        SDKWORK_TEST_ENV: '1',
      },
      stdio: 'inherit',
    },
  });
});

test('server build helper keeps WSL builds independent from the local Rust toolchain wrapper', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.runServerBuild, 'function');

  let spawnInvocation = null;

  const plan = helper.runServerBuild({
    targetTriple: 'x86_64-unknown-linux-gnu',
    env: {
      PATH: 'base-path',
      SDKWORK_TEST_ENV: '1',
    },
    hostPlatform: 'win32',
    wslDistributions: ['Ubuntu-22.04'],
    ensureRustToolchain() {
      throw new Error('native rust toolchain guard must not run for WSL builds');
    },
    withRustToolchainPathFn() {
      throw new Error('native rust toolchain path wrapper must not run for WSL builds');
    },
    spawnSyncImpl(command, args, options) {
      spawnInvocation = { command, args, options };
      return {
        status: 0,
      };
    },
  });

  assert.equal(plan.command, 'wsl.exe');
  assert.equal(plan.runner, 'wsl');
  assert.equal(plan.wslDistribution, 'Ubuntu-22.04');
  assert.equal(spawnInvocation?.command, 'wsl.exe');
  assert.equal(spawnInvocation?.options.cwd, path.join(rootDir, 'packages', 'sdkwork-claw-server'));
  assert.equal(spawnInvocation?.options.stdio, 'inherit');
  assert.equal(spawnInvocation?.options.env.PATH, 'base-path');
  assert.equal(spawnInvocation?.options.env.SDKWORK_TEST_ENV, '1');
});

test('server build helper removes stale legacy binaries after a successful native build', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.runServerBuild, 'function');

  const removedPaths = [];

  helper.runServerBuild({
    env: {
      PATH: 'base-path',
    },
    hostPlatform: 'win32',
    ensureRustToolchain() {},
    withRustToolchainPathFn(env) {
      return env;
    },
    fileSystem: {
      rmSync(targetPath, options) {
        removedPaths.push({
          targetPath,
          options,
        });
      },
    },
    spawnSyncImpl() {
      return {
        status: 0,
      };
    },
  });

  const expectedReleaseDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-server',
    'src-host',
    'target',
    'release',
  );

  assert.deepEqual(
    removedPaths,
    [
      {
        targetPath: path.join(expectedReleaseDir, 'sdkwork-claw-server.exe'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedReleaseDir, 'sdkwork-claw-server'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedReleaseDir, 'sdkwork-claw-server.d'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedReleaseDir, 'sdkwork_claw_server.pdb'),
        options: { force: true },
      },
    ],
  );
});

test('server build helper removes stale legacy binaries from both targeted and shared release directories for explicit target builds', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.runServerBuild, 'function');

  const removedPaths = [];

  helper.runServerBuild({
    targetTriple: 'x86_64-pc-windows-msvc',
    env: {
      PATH: 'base-path',
    },
    hostPlatform: 'win32',
    ensureRustToolchain() {},
    withRustToolchainPathFn(env) {
      return env;
    },
    fileSystem: {
      rmSync(targetPath, options) {
        removedPaths.push({
          targetPath,
          options,
        });
      },
    },
    spawnSyncImpl() {
      return {
        status: 0,
      };
    },
  });

  const expectedRootReleaseDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-server',
    'src-host',
    'target',
    'release',
  );
  const expectedTargetReleaseDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-server',
    'src-host',
    'target',
    'x86_64-pc-windows-msvc',
    'release',
  );

  assert.deepEqual(
    removedPaths,
    [
      {
        targetPath: path.join(expectedTargetReleaseDir, 'sdkwork-claw-server.exe'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedTargetReleaseDir, 'sdkwork-claw-server'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedTargetReleaseDir, 'sdkwork-claw-server.d'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedTargetReleaseDir, 'sdkwork_claw_server.pdb'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedRootReleaseDir, 'sdkwork-claw-server.exe'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedRootReleaseDir, 'sdkwork-claw-server'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedRootReleaseDir, 'sdkwork-claw-server.d'),
        options: { force: true },
      },
      {
        targetPath: path.join(expectedRootReleaseDir, 'sdkwork_claw_server.pdb'),
        options: { force: true },
      },
    ],
  );
});
