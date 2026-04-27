import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

test('desktop release build helper rejects missing CLI option values instead of silently falling back', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.parseArgs, 'function');
  assert.throws(
    () => helper.parseArgs(['--profile']),
    /Missing value for --profile/,
  );
  assert.throws(
    () => helper.parseArgs(['--target']),
    /Missing value for --target/,
  );
  assert.throws(
    () => helper.parseArgs(['--phase']),
    /Missing value for --phase/,
  );
  assert.throws(
    () => helper.parseArgs(['--vite-mode']),
    /Missing value for --vite-mode/,
  );
  assert.throws(
    () => helper.parseArgs(['--bundles']),
    /Missing value for --bundles/,
  );
  assert.throws(
    () => helper.parseArgs(['--package-profile']),
    /Missing value for --package-profile/,
  );
});

test('desktop release build cli wraps the entrypoint with a top-level error handler', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  );
});

test('desktop release build helper creates the correct OpenClaw preflight for bundle and all phases', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.buildDesktopReleaseBuildPreflightPlan, 'function');
  assert.equal(
    helper.buildDesktopReleaseBuildPreflightPlan({ phase: 'sync' }),
    null,
  );

  const bundlePreflight = helper.buildDesktopReleaseBuildPreflightPlan({
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  assert.equal(bundlePreflight.command, process.execPath);
  assert.deepEqual(
    bundlePreflight.args,
    ['scripts/verify-desktop-openclaw-release-assets.mjs'],
  );
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');

  const allPreflight = helper.buildDesktopReleaseBuildPreflightPlan({
    phase: 'all',
    platform: 'darwin',
    hostArch: 'arm64',
  });
  assert.equal(allPreflight.command, process.execPath);
  assert.deepEqual(
    allPreflight.args,
    ['scripts/prepare-openclaw-runtime.mjs'],
    'phase=all must prepare and verify the bundled OpenClaw runtime before delegating into tauri:build',
  );
  assert.equal(allPreflight.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'macos');
  assert.equal(allPreflight.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');

  assert.equal(
    helper.buildDesktopReleaseBuildPreflightPlan({
      phase: 'bundle',
      packageProfileId: 'hermes-only',
    }),
    null,
    'run-desktop-release-build must skip the OpenClaw release-asset preflight when the selected package profile excludes OpenClaw',
  );

  const dualKernelPreflight = helper.buildDesktopReleaseBuildPreflightPlan({
    phase: 'bundle',
    packageProfileId: 'dual-kernel',
  });
  assert.deepEqual(
    dualKernelPreflight.args,
    ['scripts/verify-desktop-openclaw-release-assets.mjs'],
    'run-desktop-release-build must keep the OpenClaw release-asset preflight for package profiles that still include OpenClaw',
  );
});

test('desktop release build helper assigns Windows builds to the shared short cargo target directory', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  const plan = helper.createDesktopReleaseBuildPlan({
    phase: 'bundle',
    platform: 'win32',
    hostArch: 'x64',
    env: {},
    targetTriple: 'x86_64-pc-windows-msvc',
  });

  assert.match(
    plan.env.CARGO_TARGET_DIR.replaceAll('\\', '/'),
    /^D:\/\.sdkwork-claw\/cargo-target\/[0-9a-f]{10}\/desktop$/,
  );
});

test('desktop release build all-phase plan forwards bundle customization flags into the desktop package script', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createDesktopReleaseBuildPlan, 'function');

  const plan = helper.createDesktopReleaseBuildPlan({
    phase: 'all',
    profileId: 'claw-studio',
    packageProfileId: 'dual-kernel',
    viteMode: 'test',
    bundleTargets: ['nsis', 'msi'],
    targetTriple: 'aarch64-pc-windows-msvc',
    platform: 'win32',
    hostArch: 'x64',
    env: {},
  });

  assert.equal(plan.command, process.execPath);
  assert.deepEqual(
    plan.args,
    [
      path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
      '--filter',
      '@sdkwork/claw-desktop',
      'run',
      'tauri:build',
      '--',
      '--profile',
      'claw-studio',
      '--package-profile',
      'dual-kernel',
      '--vite-mode',
      'test',
      '--bundles',
      'nsis,msi',
      '--target',
      'aarch64-pc-windows-msvc',
    ],
    'run-desktop-release-build must forward profile, vite mode, bundle target list, and target triple when phase=all delegates into the desktop package build script',
  );
  assert.equal(
    plan.env.SDKWORK_KERNEL_PACKAGE_PROFILE_ID,
    'dual-kernel',
    'run-desktop-release-build must expose the resolved kernel package profile to nested desktop package scripts through environment state',
  );
  assert.equal(plan.shell, false);
});

test('desktop release build sync-phase plan forwards explicit package profile selection into bundled sync', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  const plan = helper.createDesktopReleaseBuildPlan({
    phase: 'sync',
    profileId: 'claw-studio',
    packageProfileId: 'hermes-only',
    releaseMode: true,
    platform: 'linux',
    hostArch: 'x64',
  });

  assert.equal(plan.command, process.execPath);
  assert.match(plan.args.join(' '), /sync-bundled-components\.mjs/);
  assert.deepEqual(
    plan.args.slice(-2),
    ['--package-profile', 'hermes-only'],
    'run-desktop-release-build must pass explicit kernel package profile selection into sync-bundled-components for direct sync phases',
  );
  assert.equal(plan.env.SDKWORK_KERNEL_PACKAGE_PROFILE_ID, 'hermes-only');
});

test('desktop release build helper resolves Windows pnpm invocations through node plus pnpm.cjs', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.resolveSpawnCommand, 'function');
  assert.equal(helper.resolveSpawnCommand('pnpm', 'win32'), 'pnpm.cmd');
  assert.equal(helper.resolveSpawnCommand('pnpm', 'linux'), 'pnpm');
  assert.equal(typeof helper.resolvePnpmExecutionPlan, 'function');

  const windowsPnpmPlan = helper.resolvePnpmExecutionPlan({
    platform: 'win32',
    env: {},
    nodeExecutable: process.execPath,
  });

  assert.equal(windowsPnpmPlan.command, process.execPath);
  assert.deepEqual(windowsPnpmPlan.argsPrefix, [
    path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
  ]);
  assert.equal(windowsPnpmPlan.shell, false);

  const windowsPlan = helper.createDesktopReleaseBuildPlan({
    phase: 'all',
    platform: 'win32',
    hostArch: 'x64',
    env: {},
  });

  assert.equal(windowsPlan.command, process.execPath);
  assert.deepEqual(
    windowsPlan.args.slice(0, 1),
    [path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')],
  );
  assert.equal(windowsPlan.shell, false);
});

test('desktop release build cli runs the OpenClaw release-asset preflight before spawning the bundle command', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /const preflightPlan = buildDesktopReleaseBuildPreflightPlan\(/,
    'run-desktop-release-build must derive a preflight plan before invoking bundle-capable commands',
  );
  assert.match(
    source,
    /spawnSync\(\s*preflightPlan\.command,\s*preflightPlan\.args,/s,
    'run-desktop-release-build must execute the OpenClaw release-asset preflight synchronously before spawning the build command',
  );
  assert.match(
    source,
    /shell:\s*plan\.shell/u,
    'run-desktop-release-build must use the resolved plan shell setting instead of reintroducing a Windows-only cmd shell wrapper at spawn time',
  );
  assert.match(
    source,
    /windowsHide:\s*true/u,
    'run-desktop-release-build must hide delegated Windows child processes so release automation does not flash terminal windows',
  );
});
