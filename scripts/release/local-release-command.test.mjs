import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('local release helper resolves usable defaults for root release commands', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.resolveLocalReleaseContext, 'function');
  assert.equal(typeof helper.parseArgs, 'function');

  const planContext = helper.resolveLocalReleaseContext({
    mode: 'plan',
    env: {},
    platform: 'win32',
    arch: 'x64',
    resolveGitRepositoryFn() {
      return 'Sdkwork-Cloud/claw-studio';
    },
  });

  assert.equal(planContext.releaseTag, 'release-local');
  assert.equal(planContext.profileId, 'claw-studio');
  assert.equal(planContext.repository, 'Sdkwork-Cloud/claw-studio');

  const serverContext = helper.resolveLocalReleaseContext({
    mode: 'package:server',
    env: {},
    platform: 'win32',
    arch: 'x64',
  });

  assert.equal(serverContext.platform, 'windows');
  assert.equal(serverContext.arch, 'x64');
  assert.equal(serverContext.target, 'x86_64-pc-windows-msvc');
  assert.equal(serverContext.outputDir.replaceAll('\\', '/'), path.join(rootDir, 'artifacts', 'release').replaceAll('\\', '/'));

  const deploymentContext = helper.resolveLocalReleaseContext({
    mode: 'package:container',
    env: {},
    platform: 'win32',
    arch: 'x64',
  });

  assert.equal(deploymentContext.platform, 'linux');
  assert.equal(deploymentContext.arch, 'x64');
  assert.equal(deploymentContext.target, 'x86_64-unknown-linux-gnu');
  assert.equal(deploymentContext.accelerator, 'cpu');
  assert.equal(deploymentContext.imageTag, 'release-local');

  const parsedContainerOptions = helper.parseArgs(['package', 'container']);
  const parsedContainerContext = helper.resolveLocalReleaseContext({
    mode: parsedContainerOptions.mode,
    env: {},
    platform: parsedContainerOptions.platform,
    arch: parsedContainerOptions.arch,
    cliOverrides: parsedContainerOptions,
  });

  assert.equal(parsedContainerContext.arch, 'x64');
  assert.equal(parsedContainerContext.target, 'x86_64-unknown-linux-gnu');

  const parsedSmokeOptions = helper.parseArgs(['smoke', 'desktop']);
  const parsedSmokeContext = helper.resolveLocalReleaseContext({
    mode: parsedSmokeOptions.mode,
    env: {},
    platform: 'darwin',
    arch: 'arm64',
    cliOverrides: parsedSmokeOptions,
  });

  assert.equal(parsedSmokeContext.mode, 'smoke:desktop');
  assert.equal(parsedSmokeContext.platform, 'macos');
  assert.equal(parsedSmokeContext.arch, 'arm64');
  assert.equal(parsedSmokeContext.target, 'aarch64-apple-darwin');

  const parsedDesktopStartupSmokeOptions = helper.parseArgs([
    'smoke',
    'desktop',
    '--startup-evidence-path',
    'D:/synthetic/desktop-startup-evidence.json',
  ]);

  assert.equal(
    parsedDesktopStartupSmokeOptions.startupEvidencePath.replaceAll('\\', '/'),
    'D:/synthetic/desktop-startup-evidence.json',
  );

  const parsedServerSmokeOptions = helper.parseArgs(['smoke', 'server']);
  const parsedServerSmokeContext = helper.resolveLocalReleaseContext({
    mode: parsedServerSmokeOptions.mode,
    env: {},
    platform: 'linux',
    arch: 'x64',
    cliOverrides: parsedServerSmokeOptions,
  });

  assert.equal(parsedServerSmokeContext.mode, 'smoke:server');
  assert.equal(parsedServerSmokeContext.platform, 'linux');
  assert.equal(parsedServerSmokeContext.arch, 'x64');
  assert.equal(parsedServerSmokeContext.target, 'x86_64-unknown-linux-gnu');

  const parsedContainerSmokeOptions = helper.parseArgs(['smoke', 'container']);
  const parsedContainerSmokeContext = helper.resolveLocalReleaseContext({
    mode: parsedContainerSmokeOptions.mode,
    env: {},
    platform: 'win32',
    arch: 'x64',
    cliOverrides: parsedContainerSmokeOptions,
  });

  assert.equal(parsedContainerSmokeContext.mode, 'smoke:container');
  assert.equal(parsedContainerSmokeContext.platform, 'linux');
  assert.equal(parsedContainerSmokeContext.arch, 'x64');
  assert.equal(parsedContainerSmokeContext.target, 'x86_64-unknown-linux-gnu');
  assert.equal(parsedContainerSmokeContext.accelerator, 'cpu');

  const parsedKubernetesSmokeOptions = helper.parseArgs(['smoke', 'kubernetes']);
  const parsedKubernetesSmokeContext = helper.resolveLocalReleaseContext({
    mode: parsedKubernetesSmokeOptions.mode,
    env: {},
    platform: 'darwin',
    arch: 'arm64',
    cliOverrides: parsedKubernetesSmokeOptions,
  });

  assert.equal(parsedKubernetesSmokeContext.mode, 'smoke:kubernetes');
  assert.equal(parsedKubernetesSmokeContext.platform, 'linux');
  assert.equal(parsedKubernetesSmokeContext.arch, 'arm64');
  assert.equal(parsedKubernetesSmokeContext.target, 'aarch64-unknown-linux-gnu');
  assert.equal(parsedKubernetesSmokeContext.accelerator, 'cpu');

  const parsedDesktopPackageOptions = helper.parseArgs([
    'package',
    'desktop',
    '--package-profile',
    'dual-kernel',
  ]);
  assert.equal(parsedDesktopPackageOptions.packageProfileId, 'dual-kernel');

  const envPackageProfileContext = helper.resolveLocalReleaseContext({
    mode: 'package:desktop',
    env: {
      SDKWORK_RELEASE_PACKAGE_PROFILE: 'hermes-only',
    },
    platform: 'win32',
    arch: 'x64',
    resolveGitRepositoryFn() {
      return 'Sdkwork-Cloud/claw-studio';
    },
  });

  assert.equal(envPackageProfileContext.packageProfileId, 'hermes-only');

  const cliPackageProfileContext = helper.resolveLocalReleaseContext({
    mode: 'package:desktop',
    env: {
      SDKWORK_RELEASE_PACKAGE_PROFILE: 'openclaw-only',
      SDKWORK_RELEASE_REPOSITORY: 'Env-Owner/env-repo',
    },
    platform: 'win32',
    arch: 'x64',
    cliOverrides: {
      packageProfileId: 'dual-kernel',
      repository: 'Cli-Owner/cli-repo',
    },
    resolveGitRepositoryFn() {
      return 'Sdkwork-Cloud/claw-studio';
    },
  });

  assert.equal(cliPackageProfileContext.packageProfileId, 'dual-kernel');
  assert.equal(cliPackageProfileContext.repository, 'Cli-Owner/cli-repo');

  const envRepositoryContext = helper.resolveLocalReleaseContext({
    mode: 'package:desktop',
    env: {
      SDKWORK_RELEASE_REPOSITORY: 'Env-Owner/env-repo',
    },
    platform: 'win32',
    arch: 'x64',
    resolveGitRepositoryFn() {
      return 'Sdkwork-Cloud/claw-studio';
    },
  });

  assert.equal(envRepositoryContext.repository, 'Env-Owner/env-repo');
});

test('local release helper always refreshes server prerequisites for local server and container packaging', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.ensureLocalServerBuildPrerequisite, 'function');

  const buildCalls = [];
  const existingBinaries = new Set([
    'D:/synthetic/claw-server.exe',
    'D:/synthetic/claw-server',
  ]);
  const serverResult = helper.ensureLocalServerBuildPrerequisite({
    context: {
      mode: 'package:server',
      target: 'x86_64-pc-windows-msvc',
      platform: 'windows',
    },
    fileExists(targetPath) {
      return existingBinaries.has(targetPath);
    },
    resolveBinaryPath() {
      return 'D:/synthetic/claw-server.exe';
    },
    runServerBuildFn(options) {
      buildCalls.push(options);
    },
  });

  const containerResult = helper.ensureLocalServerBuildPrerequisite({
    context: {
      mode: 'package:container',
      target: 'x86_64-unknown-linux-gnu',
      platform: 'linux',
    },
    fileExists(targetPath) {
      return existingBinaries.has(targetPath);
    },
    resolveBinaryPath() {
      return 'D:/synthetic/claw-server';
    },
    runServerBuildFn(options) {
      buildCalls.push(options);
    },
  });

  assert.deepEqual(buildCalls, [
    { targetTriple: 'x86_64-pc-windows-msvc' },
    { targetTriple: 'x86_64-unknown-linux-gnu' },
  ]);
  assert.deepEqual(serverResult, {
    binaryPath: 'D:/synthetic/claw-server.exe',
    built: true,
  });
  assert.deepEqual(containerResult, {
    binaryPath: 'D:/synthetic/claw-server',
    built: true,
  });
});

test('local release helper rejects server prerequisite builds that do not materialize the canonical binary path', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.ensureLocalServerBuildPrerequisite, 'function');

  let existenceChecks = 0;

  assert.throws(
    () => helper.ensureLocalServerBuildPrerequisite({
      context: {
        mode: 'package:server',
        target: 'x86_64-unknown-linux-gnu',
        platform: 'linux',
      },
      fileExists() {
        existenceChecks += 1;
        return false;
      },
      resolveBinaryPath() {
        return 'D:/synthetic/claw-server';
      },
      runServerBuildFn() {},
    }),
    /Server build completed without producing the canonical binary at D:\/synthetic\/claw-server/i,
  );

  assert.equal(existenceChecks, 1);
});

test('local release helper auto-builds stale desktop prerequisites for local desktop packaging', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.ensureLocalDesktopBuildPrerequisite, 'function');

  const buildCalls = [];
  const result = helper.ensureLocalDesktopBuildPrerequisite({
    context: {
      mode: 'package:desktop',
      profileId: 'claw-studio',
      target: 'x86_64-pc-windows-msvc',
    },
    fileExists() {
      return true;
    },
    resolveDesktopBundleRoot() {
      return 'D:/synthetic/desktop-bundle';
    },
    inspectTauriTargetFn() {
      return {
        stale: true,
      };
    },
    runDesktopBuildFn(options) {
      buildCalls.push(options);
    },
  });

  assert.deepEqual(buildCalls, [
    {
      profileId: 'claw-studio',
      targetTriple: 'x86_64-pc-windows-msvc',
    },
  ]);
  assert.deepEqual(result, {
    bundleRoot: 'D:/synthetic/desktop-bundle',
    built: true,
    staleTarget: true,
  });
});

test('local release helper rejects desktop prerequisite builds that do not materialize the canonical bundle root', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.ensureLocalDesktopBuildPrerequisite, 'function');

  let existenceChecks = 0;

  assert.throws(
    () => helper.ensureLocalDesktopBuildPrerequisite({
      context: {
        mode: 'package:desktop',
        profileId: 'claw-studio',
        target: 'x86_64-pc-windows-msvc',
      },
      fileExists() {
        existenceChecks += 1;
        return false;
      },
      resolveDesktopBundleRoot() {
        return 'D:/synthetic/desktop-bundle';
      },
      inspectTauriTargetFn() {
        return {
          stale: true,
        };
      },
      runDesktopBuildFn() {},
    }),
    /Desktop release build completed without producing the canonical bundle root at D:\/synthetic\/desktop-bundle/i,
  );

  assert.equal(existenceChecks, 2);
});

test('local release helper runs desktop prerequisite builds through the unified desktop release runner', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.runLocalDesktopBuild, 'function');

  const spawnCalls = [];
  helper.runLocalDesktopBuild({
    profileId: 'claw-studio',
    targetTriple: 'x86_64-pc-windows-msvc',
    spawnSyncImpl(command, args, options) {
      spawnCalls.push({
        command,
        args,
        options,
      });
      return {
        status: 0,
      };
    },
  });

  assert.deepEqual(spawnCalls, [
    {
      command: process.execPath,
      args: [
        'scripts/run-desktop-release-build.mjs',
        '--profile',
        'claw-studio',
        '--target',
        'x86_64-pc-windows-msvc',
      ],
      options: {
        cwd: rootDir,
        shell: false,
        stdio: 'inherit',
      },
    },
  ]);
});

test('local release helper dispatches desktop installer and startup smoke through the dedicated smoke command', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const smokeCalls = [];
  const result = await helper.runLocalReleaseCommand({
    mode: 'smoke:desktop',
    env: {},
    platform: 'darwin',
    arch: 'arm64',
    startupEvidencePath: 'D:/synthetic/desktop-startup-evidence.json',
    smokeDesktopInstallersFn(context) {
      smokeCalls.push({
        step: 'installers',
        context,
      });
      return {
        ok: true,
        context,
      };
    },
    smokeDesktopStartupEvidenceFn(context) {
      smokeCalls.push({
        step: 'startup',
        context,
      });
      return {
        ok: true,
        context,
      };
    },
  });

  assert.deepEqual(
    smokeCalls.map((entry) => entry.step),
    ['installers', 'startup'],
  );
  assert.equal(smokeCalls[0].context.mode, 'smoke:desktop');
  assert.equal(smokeCalls[0].context.platform, 'macos');
  assert.equal(smokeCalls[0].context.arch, 'arm64');
  assert.equal(smokeCalls[0].context.target, 'aarch64-apple-darwin');
  assert.equal(
    smokeCalls[1].context.startupEvidencePath.replaceAll('\\', '/'),
    'D:/synthetic/desktop-startup-evidence.json',
  );
  assert.equal(result.mode, 'smoke:desktop');
});

test('local release helper dispatches packaged desktop launch smoke when no external startup evidence path is provided', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const smokeCalls = [];
  const result = await helper.runLocalReleaseCommand({
    mode: 'smoke:desktop',
    env: {},
    platform: 'linux',
    arch: 'x64',
    smokeDesktopInstallersFn(context) {
      smokeCalls.push({
        step: 'installers',
        context,
      });
      return {
        ok: true,
        context,
      };
    },
    smokeDesktopPackagedLaunchFn(context) {
      smokeCalls.push({
        step: 'packaged-launch',
        context,
      });
      return {
        ok: true,
        context,
      };
    },
  });

  assert.deepEqual(
    smokeCalls.map((entry) => entry.step),
    ['installers', 'packaged-launch'],
  );
  assert.equal(smokeCalls[1].context.platform, 'linux');
  assert.equal(smokeCalls[1].context.arch, 'x64');
  assert.equal(smokeCalls[1].context.target, 'x86_64-unknown-linux-gnu');
  assert.equal(result.mode, 'smoke:desktop');
});

test('local release helper dispatches server and deployment smoke through dedicated smoke commands', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const smokeCalls = [];

  const serverResult = await helper.runLocalReleaseCommand({
    mode: 'smoke:server',
    env: {},
    platform: 'linux',
    arch: 'x64',
    smokeServerReleaseAssetsFn(context) {
      smokeCalls.push({
        family: 'server',
        context,
      });
      return {
        ok: true,
        context,
      };
    },
  });

  const containerResult = await helper.runLocalReleaseCommand({
    mode: 'smoke:container',
    env: {},
    platform: 'win32',
    arch: 'x64',
    smokeDeploymentReleaseAssetsFn(context) {
      smokeCalls.push({
        family: context.mode,
        context,
      });
      return {
        ok: true,
        context,
      };
    },
  });

  const kubernetesResult = await helper.runLocalReleaseCommand({
    mode: 'smoke:kubernetes',
    env: {},
    platform: 'darwin',
    arch: 'arm64',
    smokeDeploymentReleaseAssetsFn(context) {
      smokeCalls.push({
        family: context.mode,
        context,
      });
      return {
        ok: true,
        context,
      };
    },
  });

  assert.equal(smokeCalls.length, 3);
  assert.equal(smokeCalls[0].family, 'server');
  assert.equal(smokeCalls[0].context.mode, 'smoke:server');
  assert.equal(smokeCalls[0].context.target, 'x86_64-unknown-linux-gnu');
  assert.equal(smokeCalls[1].family, 'smoke:container');
  assert.equal(smokeCalls[1].context.platform, 'linux');
  assert.equal(smokeCalls[1].context.accelerator, 'cpu');
  assert.equal(smokeCalls[2].family, 'smoke:kubernetes');
  assert.equal(smokeCalls[2].context.platform, 'linux');
  assert.equal(smokeCalls[2].context.arch, 'arm64');
  assert.equal(serverResult.mode, 'smoke:server');
  assert.equal(containerResult.mode, 'smoke:container');
  assert.equal(kubernetesResult.mode, 'smoke:kubernetes');
});

test('local release helper automatically runs desktop smoke after packaging desktop release assets', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const callOrder = [];
  await helper.runLocalReleaseCommand({
    mode: 'package:desktop',
    env: {},
    platform: 'linux',
    arch: 'x64',
    packageProfileId: 'dual-kernel',
    releaseAssetsDir: 'D:/synthetic/release-assets',
    ensureLocalDesktopBuildPrerequisiteFn({ context }) {
      callOrder.push({
        step: 'desktop-prereq',
        context,
      });
      return {
        bundleRoot: 'D:/synthetic/desktop-bundle',
        built: false,
        staleTarget: false,
      };
    },
    packageDesktopAssetsFn(context) {
      callOrder.push({
        step: 'package',
        context,
      });
    },
    smokeDesktopInstallersFn: async (context) => {
      callOrder.push({
        step: 'installers',
        context,
      });
      return {
        ok: true,
      };
    },
    smokeDesktopPackagedLaunchFn: async (context) => {
      callOrder.push({
        step: 'packaged-launch',
        context,
      });
      return {
        ok: true,
      };
    },
  });

  assert.deepEqual(
    callOrder.map((entry) => entry.step),
    ['desktop-prereq', 'package', 'installers', 'packaged-launch'],
  );
  assert.equal(callOrder[0].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[1].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[1].context.platform, 'linux');
  assert.equal(callOrder[1].context.arch, 'x64');
  assert.equal(callOrder[1].context.target, 'x86_64-unknown-linux-gnu');
  assert.equal(callOrder[1].context.packageProfileId, 'dual-kernel');
  assert.equal(callOrder[2].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[2].context.platform, 'linux');
  assert.equal(callOrder[2].context.arch, 'x64');
  assert.equal(callOrder[2].context.target, 'x86_64-unknown-linux-gnu');
  assert.equal(callOrder[2].context.packageProfileId, 'dual-kernel');
  assert.equal(callOrder[3].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[3].context.platform, 'linux');
  assert.equal(callOrder[3].context.arch, 'x64');
  assert.equal(callOrder[3].context.target, 'x86_64-unknown-linux-gnu');
  assert.equal(callOrder[3].context.packageProfileId, 'dual-kernel');
});

test('local release helper forwards the resolved package profile into plan generation', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const planCalls = [];
  const stdoutChunks = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk, encoding, callback) => {
    stdoutChunks.push(String(chunk));
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  try {
    const context = await helper.runLocalReleaseCommand({
      mode: 'plan',
      env: {},
      platform: 'win32',
      arch: 'x64',
      packageProfileId: 'dual-kernel',
      createReleasePlanFn(options) {
        planCalls.push(options);
        return {
          profileId: options.profileId,
          packageProfileId: options.packageProfileId,
          releaseTag: options.releaseTag,
          gitRef: options.gitRef,
          desktopMatrix: [],
          serverMatrix: [],
          containerMatrix: [],
          kubernetesMatrix: [],
          release: {
            manifestFileName: 'release-manifest.json',
            globalChecksumsFileName: 'SHA256SUMS.txt',
          },
        };
      },
    });

    assert.equal(context.mode, 'plan');
    assert.equal(context.packageProfileId, 'dual-kernel');
    assert.deepEqual(planCalls, [
      {
        profileId: 'claw-studio',
        packageProfileId: 'dual-kernel',
        releaseTag: 'release-local',
        gitRef: 'refs/tags/release-local',
      },
    ]);
    assert.match(stdoutChunks.join(''), /"packageProfileId": "dual-kernel"/);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('local release helper automatically runs server smoke after packaging server release assets', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const callOrder = [];
  await helper.runLocalReleaseCommand({
    mode: 'package:server',
    env: {},
    platform: 'linux',
    arch: 'x64',
    releaseAssetsDir: 'D:/synthetic/release-assets',
    fileExists() {
      return true;
    },
    runServerBuildFn() {
      callOrder.push({
        step: 'build',
      });
    },
    packageServerAssetsFn(context) {
      callOrder.push({
        step: 'package',
        context,
      });
    },
    smokeServerReleaseAssetsFn: async (context) => {
      callOrder.push({
        step: 'smoke',
        context,
      });
      return {
        ok: true,
      };
    },
  });

  assert.deepEqual(
    callOrder.map((entry) => entry.step),
    ['build', 'package', 'smoke'],
  );
  assert.equal(callOrder[1].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[2].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[2].context.platform, 'linux');
  assert.equal(callOrder[2].context.arch, 'x64');
  assert.equal(callOrder[2].context.target, 'x86_64-unknown-linux-gnu');
});

test('local release helper automatically runs deployment smoke after packaging container and kubernetes release assets', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const callOrder = [];
  await helper.runLocalReleaseCommand({
    mode: 'package:container',
    env: {},
    platform: 'linux',
    arch: 'x64',
    releaseAssetsDir: 'D:/synthetic/release-assets',
    fileExists() {
      return true;
    },
    runServerBuildFn() {
      callOrder.push({
        step: 'build-container',
      });
    },
    packageContainerAssetsFn(context) {
      callOrder.push({
        step: 'package-container',
        context,
      });
    },
    smokeDeploymentReleaseAssetsFn: async (context) => {
      callOrder.push({
        step: `smoke-${context.family}`,
        context,
      });
      return {
        ok: true,
      };
    },
  });

  await helper.runLocalReleaseCommand({
    mode: 'package:kubernetes',
    env: {},
    platform: 'linux',
    arch: 'arm64',
    releaseAssetsDir: 'D:/synthetic/release-assets',
    packageKubernetesAssetsFn(context) {
      callOrder.push({
        step: 'package-kubernetes',
        context,
      });
    },
    smokeDeploymentReleaseAssetsFn: async (context) => {
      callOrder.push({
        step: `smoke-${context.family}`,
        context,
      });
      return {
        ok: true,
      };
    },
  });

  assert.deepEqual(
    callOrder.map((entry) => entry.step),
    ['build-container', 'package-container', 'smoke-container', 'package-kubernetes', 'smoke-kubernetes'],
  );
  assert.equal(callOrder[2].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[2].context.platform, 'linux');
  assert.equal(callOrder[2].context.arch, 'x64');
  assert.equal(callOrder[2].context.accelerator, 'cpu');
  assert.equal(callOrder[4].context.releaseAssetsDir.replaceAll('\\', '/'), 'D:/synthetic/release-assets');
  assert.equal(callOrder[4].context.platform, 'linux');
  assert.equal(callOrder[4].context.arch, 'arm64');
  assert.equal(callOrder[4].context.family, 'kubernetes');
});
