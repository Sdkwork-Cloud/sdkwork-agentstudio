import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function writeJsonFile(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeArtifactFile(releaseAssetsDir, relativePath) {
  const absolutePath = path.join(releaseAssetsDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, 'synthetic packaged desktop artifact\n', 'utf8');
  return absolutePath;
}

function writeDesktopManifest({
  releaseAssetsDir,
  platform,
  arch,
  artifacts,
} = {}) {
  const manifestPath = path.join(
    releaseAssetsDir,
    'desktop',
    platform,
    arch,
    'release-asset-manifest.json',
  );

  writeJsonFile(manifestPath, {
    profileId: 'claw-studio',
    productName: 'Claw Studio',
    releaseTag: 'release-2026-04-06-09',
    platform,
    arch,
    artifacts,
  });

  return manifestPath;
}

function buildDesktopStartupEvidence({
  status = 'passed',
  phase = 'shell-mounted',
} = {}) {
  return {
    version: 1,
    status,
    phase,
    runId: 4,
    durationMs: 1120,
    recordedAt: '2026-04-06T12:13:14.000Z',
    app: {
      name: 'Claw Studio',
      version: '0.1.0',
      tauriVersion: '2.0.0',
    },
    paths: {
      dataDir: 'D:/synthetic/home/.sdkwork/crawstudio/studio',
      logsDir: 'D:/synthetic/home/.sdkwork/crawstudio/logs',
      machineLogsDir: 'D:/synthetic/program-data/SdkWork/CrawStudio/logs',
      mainLogFile: 'D:/synthetic/program-data/SdkWork/CrawStudio/logs/app/app.log',
    },
    descriptor: {
      mode: 'desktopCombined',
      lifecycle: 'ready',
      apiBasePath: '/claw/api/v1',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      browserBaseUrl: 'http://127.0.0.1:19797',
      lastError: null,
      endpointId: 'desktop-managed-endpoint',
      requestedPort: 19797,
      activePort: 19797,
      loopbackOnly: true,
      dynamicPort: false,
      stateStoreDriver: 'sqlite',
      stateStoreProfileId: 'desktop-managed',
      runtimeDataDir: 'D:/synthetic/runtime',
      webDistDir: 'D:/synthetic/web',
    },
    hostPlatformStatus: {
      lifecycle: 'ready',
      mode: 'desktopCombined',
      supportedCapabilityKeys: ['manage.openclaw.gateway.invoke'],
      availableCapabilityKeys: ['manage.openclaw.gateway.invoke'],
    },
    hostEndpoints: [
      {
        endpointId: 'desktop-managed-endpoint',
        requestedPort: 19797,
        activePort: 19797,
        baseUrl: 'http://127.0.0.1:19797',
      },
    ],
    openClawRuntime: {
      lifecycle: 'ready',
      endpointId: 'desktop-managed-endpoint',
      activePort: 19797,
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
    },
    openClawGateway: {
      lifecycle: 'ready',
      endpointId: 'desktop-managed-endpoint',
      activePort: 19797,
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
    },
    builtInInstance: {
      id: 'local-built-in',
      name: 'OpenClaw',
      version: '2026.4.2',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
      isBuiltIn: true,
      isDefault: true,
    },
    readinessEvidence: {
      hostLifecycleReady: true,
      gatewayInvokeCapabilityAvailable: true,
      manageEndpointPublished: true,
      manageEndpointMatchesDescriptor: true,
      openClawRuntimeReady: true,
      openClawGatewayReady: true,
      runtimeAndGatewayBaseUrlMatch: true,
      runtimeAndGatewayWebsocketUrlMatch: true,
      builtInInstanceOnline: true,
      builtInInstanceReady: true,
      gatewayWebsocketProbeSupported: true,
      gatewayWebsocketDialable: true,
      ready: true,
    },
    error: null,
  };
}

test('desktop packaged launch smoke selects the canonical packaged launch artifact for each platform', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.resolveDesktopPackagedLaunchArtifact, 'function');

  assert.equal(
    smoke.resolveDesktopPackagedLaunchArtifact({
      platform: 'windows',
      artifacts: [
        { relativePath: 'desktop/windows/x64/msi/Claw Studio_0.1.0_x64_en-US.msi' },
        { relativePath: 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe' },
      ],
    }).relativePath,
    'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe',
  );
  assert.equal(
    smoke.resolveDesktopPackagedLaunchArtifact({
      platform: 'linux',
      artifacts: [
        { relativePath: 'desktop/linux/x64/rpm/claw-studio-0.1.0-1.x86_64.rpm' },
        { relativePath: 'desktop/linux/x64/deb/claw-studio_0.1.0_amd64.deb' },
      ],
    }).relativePath,
    'desktop/linux/x64/deb/claw-studio_0.1.0_amd64.deb',
  );
  assert.equal(
    smoke.resolveDesktopPackagedLaunchArtifact({
      platform: 'macos',
      artifacts: [
        { relativePath: 'desktop/macos/arm64/dmg/Claw Studio_0.1.0_aarch64.dmg' },
        { relativePath: 'desktop/macos/arm64/macos/Claw Studio_0.1.0_arm64.app.zip' },
      ],
    }).relativePath,
    'desktop/macos/arm64/macos/Claw Studio_0.1.0_arm64.app.zip',
  );
});

test('desktop packaged launch smoke keeps its default wait budget aligned with slow first-launch desktop runtime activation', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const source = readFileSync(smokePath, 'utf8');

  assert.match(source, /const DEFAULT_WAIT_TIMEOUT_MS = 150_000;/);
});

test('desktop packaged launch smoke prefers the root desktop executable over nested bundled helper binaries on Windows', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const originalSource = readFileSync(smokePath, 'utf8');
  const tempModulePath = path.join(
    rootDir,
    'scripts',
    'release',
    `smoke-desktop-packaged-launch.resolve-binary-${process.pid}-${Date.now()}.mjs`,
  );
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-installed-binary-'));
  const installRoot = path.join(tempRoot, 'install-root');
  const expectedBinaryPath = path.join(installRoot, 'sdkwork-claw-desktop.exe');
  const nestedHelperPath = path.join(
    installRoot,
    'generated',
    'bundled',
    'modules',
    'openclaw-helper',
    '2026.4.14',
    'bin',
    'openclaw-helper.exe',
  );
  const nestedNodePath = path.join(
    installRoot,
    'generated',
    'bundled',
    'runtimes',
    'node',
    '22.16.0',
    'node.exe',
  );

  try {
    writeFileSync(
      tempModulePath,
      originalSource.replace(
        'function resolveInstalledDesktopBinaryPath(',
        'export function resolveInstalledDesktopBinaryPath(',
      ),
      'utf8',
    );

    const smoke = await import(`${pathToFileURL(tempModulePath).href}?cacheBust=${Date.now()}`);

    mkdirSync(path.dirname(expectedBinaryPath), { recursive: true });
    writeFileSync(expectedBinaryPath, 'synthetic app exe\n', 'utf8');
    mkdirSync(path.dirname(nestedHelperPath), { recursive: true });
    writeFileSync(nestedHelperPath, 'synthetic bundled helper exe\n', 'utf8');
    mkdirSync(path.dirname(nestedNodePath), { recursive: true });
    writeFileSync(nestedNodePath, 'synthetic node exe\n', 'utf8');
    writeFileSync(path.join(installRoot, 'uninstall.exe'), 'synthetic uninstall exe\n', 'utf8');

    const resolvedBinaryPath = smoke.resolveInstalledDesktopBinaryPath({
      installRoot,
      productName: 'Claw Studio',
      platform: 'windows',
    });

    assert.equal(
      resolvedBinaryPath.replaceAll('\\', '/'),
      expectedBinaryPath.replaceAll('\\', '/'),
    );
  } finally {
    rmSync(tempModulePath, { force: true });
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop packaged launch smoke waits until captured evidence reaches the shell-mounted passed phase', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.waitForReadyDesktopStartupEvidence, 'function');

  const evidenceSnapshots = [
    buildDesktopStartupEvidence({ phase: 'runtime-ready' }),
    buildDesktopStartupEvidence({ phase: 'shell-mounted' }),
  ];
  let pathExistsChecks = 0;
  let pollCount = 0;

  const result = await smoke.waitForReadyDesktopStartupEvidence({
    evidencePath: 'D:/synthetic/desktop-startup-evidence.json',
    timeoutMs: 50,
    intervalMs: 1,
    pathExistsFn() {
      pathExistsChecks += 1;
      return pathExistsChecks >= 2;
    },
    readFileFn() {
      const current = evidenceSnapshots[pollCount];
      pollCount += 1;
      return JSON.stringify(current);
    },
    delayFn: async () => {},
  });

  assert.equal(result.phase, 'shell-mounted');
  assert.equal(result.status, 'passed');
  assert.equal(pollCount, 2);
});

test('desktop packaged launch smoke retries transient Windows cleanup lock failures', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.removeDirectoryWithRetries, 'function');

  let attempts = 0;
  await smoke.removeDirectoryWithRetries('C:/synthetic/temp-smoke-root', {
    maxRetries: 3,
    retryDelayMs: 1,
    delayFn: async () => {},
    rmSyncFn() {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('resource busy or locked');
        error.code = 'EBUSY';
        throw error;
      }
    },
  });

  assert.equal(attempts, 2);
});

test('desktop packaged launch smoke executes the Windows installer through PowerShell Start-Process', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.prepareDesktopPackagedLaunch, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-windows-installer-'));
  const smokeRoot = path.join(tempRoot, 'smoke-root');
  const expectedBinaryPath = path.join(smokeRoot, 'install-root', 'Claw Studio.exe');
  let commandInvocation = null;

  try {
    const preparedLaunch = await smoke.prepareDesktopPackagedLaunch({
      artifactPath: 'E:/synthetic/Claw Studio_0.1.0_x64-setup.exe',
      artifact: {
        relativePath: 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe',
      },
      releasePlatform: 'windows',
      smokeRoot,
      env: {},
      runCommandFn(commandOptions) {
        commandInvocation = commandOptions;
        mkdirSync(path.dirname(expectedBinaryPath), { recursive: true });
        writeFileSync(expectedBinaryPath, 'synthetic desktop launcher\n', 'utf8');
      },
    });

    assert.equal(commandInvocation.command, 'powershell.exe');
    assert.ok(
      commandInvocation.args.some((argument) => String(argument).includes('Start-Process')),
    );
    assert.equal(
      preparedLaunch.launcher.command.replaceAll('\\', '/'),
      expectedBinaryPath.replaceAll('\\', '/'),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop packaged launch smoke captures packaged startup evidence and forwards it into the canonical startup smoke report', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.smokeDesktopPackagedLaunch, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-packaged-launch-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const artifactRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';
  const capturedEvidencePath = path.join(tempRoot, 'captured', 'desktop-startup-evidence.json');
  const launchEvents = [];

  try {
    writeArtifactFile(releaseAssetsDir, artifactRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: artifactRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: 17,
        },
      ],
    });

    const result = await smoke.smokeDesktopPackagedLaunch({
      releaseAssetsDir,
      platform: 'windows',
      hostPlatform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      prepareDesktopPackagedLaunchFn: async ({ releasePlatform, releaseArch, artifact }) => {
        assert.equal(releasePlatform, 'windows');
        assert.equal(releaseArch, 'x64');
        assert.equal(artifact.relativePath, artifactRelativePath);
        launchEvents.push('prepare');
        return {
          launcher: {
            command: 'D:/synthetic/Claw Studio.exe',
            args: [],
            cwd: 'D:/synthetic',
            env: {
              USERPROFILE: 'D:/synthetic/home',
            },
          },
          evidencePath: capturedEvidencePath,
          cleanup: async () => {
            launchEvents.push('cleanup');
          },
        };
      },
      launchDesktopPackagedAppFn: async (launcher) => {
        assert.equal(launcher.command, 'D:/synthetic/Claw Studio.exe');
        launchEvents.push('launch');
        return {
          pid: 1024,
          launcher,
        };
      },
      waitForReadyDesktopStartupEvidenceFn: async ({ evidencePath }) => {
        assert.equal(evidencePath.replaceAll('\\', '/'), capturedEvidencePath.replaceAll('\\', '/'));
        mkdirSync(path.dirname(capturedEvidencePath), { recursive: true });
        writeJsonFile(capturedEvidencePath, buildDesktopStartupEvidence());
        launchEvents.push('wait');
        return buildDesktopStartupEvidence();
      },
      stopDesktopPackagedAppFn: async (processRecord) => {
        assert.equal(processRecord.pid, 1024);
        launchEvents.push('stop');
      },
      smokeDesktopStartupEvidenceFn: async (options) => {
        assert.equal(
          options.startupEvidencePath.replaceAll('\\', '/'),
          capturedEvidencePath.replaceAll('\\', '/'),
        );
        launchEvents.push('smoke');
        return {
          reportPath: path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-startup-smoke-report.json'),
          report: {
            status: 'passed',
          },
        };
      },
    });

    assert.equal(result.platform, 'windows');
    assert.equal(result.arch, 'x64');
    assert.equal(
      result.capturedEvidencePath.replaceAll('\\', '/'),
      capturedEvidencePath.replaceAll('\\', '/'),
    );
    assert.equal(result.smokeResult.report.status, 'passed');
    assert.deepEqual(
      launchEvents,
      ['prepare', 'launch', 'wait', 'stop', 'smoke', 'cleanup'],
    );
    assert.deepEqual(
      JSON.parse(readFileSync(capturedEvidencePath, 'utf8')).phase,
      'shell-mounted',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop packaged launch smoke rejects stale packaged installers when a newer local desktop bundle artifact exists', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-packaged-launch.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.assertPackagedDesktopLaunchArtifactFreshness, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-artifact-freshness-'));
  const bundleRoot = path.join(tempRoot, 'bundle');
  const packagedArtifactPath = path.join(
    tempRoot,
    'release-assets',
    'desktop',
    'windows',
    'x64',
    'nsis',
    'Claw Studio_0.1.0_x64-setup.exe',
  );
  const sourceArtifactPath = path.join(
    bundleRoot,
    'nsis',
    'Claw Studio_0.1.0_x64-setup.exe',
  );

  try {
    mkdirSync(path.dirname(packagedArtifactPath), { recursive: true });
    writeFileSync(packagedArtifactPath, 'stale packaged installer\n', 'utf8');
    mkdirSync(path.dirname(sourceArtifactPath), { recursive: true });
    writeFileSync(sourceArtifactPath, 'fresh local installer\n', 'utf8');

    const staleAt = new Date('2026-04-21T02:46:50.000Z');
    const freshAt = new Date('2026-04-21T03:35:22.000Z');
    utimesSync(packagedArtifactPath, staleAt, staleAt);
    utimesSync(sourceArtifactPath, freshAt, freshAt);

    assert.throws(
      () => smoke.assertPackagedDesktopLaunchArtifactFreshness({
        artifact: {
          relativePath: 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe',
        },
        artifactPath: packagedArtifactPath,
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        resolveExistingDesktopBundleRootFn: () => bundleRoot,
      }),
      /newer local desktop bundle artifact exists/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
