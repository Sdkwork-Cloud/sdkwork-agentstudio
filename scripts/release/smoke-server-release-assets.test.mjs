import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function writeSyntheticServerRuntime({
  serverTargetDir,
  targetTriple,
  binaryName,
  webDistDir,
  envExamplePath,
} = {}) {
  const serverBinaryPath = path.join(serverTargetDir, targetTriple, 'release', binaryName);
  mkdirSync(path.dirname(serverBinaryPath), { recursive: true });
  mkdirSync(path.join(webDistDir, 'assets'), { recursive: true });
  writeFileSync(serverBinaryPath, 'synthetic binary\n', 'utf8');
  writeFileSync(path.join(webDistDir, 'index.html'), '<html><body>synthetic web</body></html>\n', 'utf8');
  writeFileSync(path.join(webDistDir, 'assets', 'index.js'), 'console.log("synthetic");\n', 'utf8');
  writeFileSync(
    envExamplePath,
    'CLAW_SERVER_HOST=127.0.0.1\nCLAW_SERVER_PORT=18797\nCLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist\n',
    'utf8',
  );
}

test('server bundle smoke validates packaged server bundles and writes runtime-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-server-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeServerReleaseAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-smoke-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const serverDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
  const archiveRelativePath = 'server/linux/x64/claw-studio-server-release-2026-04-06-01-linux-x64.tar.gz';
  const archivePath = path.join(releaseAssetsDir, archiveRelativePath);
  const manifestPath = path.join(serverDir, 'release-asset-manifest.json');
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-server-release-2026-04-06-01-linux-x64');
  let stopped = false;

  try {
    mkdirSync(serverDir, { recursive: true });
    writeFileSync(archivePath, 'synthetic server archive', 'utf8');
    writeFileSync(
      manifestPath,
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-06-01',
        platform: 'linux',
        arch: 'x64',
        artifacts: [
          {
            name: 'claw-studio-server-release-2026-04-06-01-linux-x64.tar.gz',
            relativePath: archiveRelativePath,
            family: 'server',
            platform: 'linux',
            arch: 'x64',
            kind: 'archive',
            sha256: 'placeholder',
            size: 24,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const result = await smoke.smokeServerReleaseAssets({
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      extractServerArchiveFn: async ({ archivePath: inputArchivePath, extractDir }) => {
        assert.equal(inputArchivePath.replaceAll('\\', '/'), archivePath.replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-server-smoke-/);
        mkdirSync(path.join(extractedBundleRoot, 'bin'), { recursive: true });
        writeFileSync(path.join(extractedBundleRoot, 'start-claw-server.sh'), '#!/usr/bin/env sh\n', 'utf8');
        writeFileSync(path.join(extractedBundleRoot, 'bin', 'claw-server'), 'binary\n', 'utf8');
        return extractedBundleRoot;
      },
      launchServerBundleFn: async ({ bundleRoot, platform, port }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(platform, 'linux');
        assert.equal(typeof port, 'number');
        return {
          baseUrl: `http://127.0.0.1:${port}`,
          launcherRelativePath: 'bin/claw-server',
          async stop() {
            stopped = true;
          },
        };
      },
      probeEndpointFn: async (request) => {
        if (request.path === '/claw/health/ready') {
          return {
            statusCode: 200,
            body: '{"status":"ready"}',
          };
        }
        if (request.path === '/') {
          return {
            statusCode: 200,
            body: '<html><body>Claw Studio</body></html>',
          };
        }

        return {
          statusCode: 404,
          body: 'not-found',
        };
      },
      fetchJsonFn: async (request) => {
        assert.equal(request.path, '/claw/manage/v1/host-endpoints');
        return {
          statusCode: 200,
          json: [
            {
              id: 'manage-http',
              kind: 'manage',
              baseUrl: 'http://127.0.0.1:19797',
            },
          ],
        };
      },
      resolveAvailablePortFn: async () => 19797,
    });

    assert.equal(stopped, true);
    assert.equal(result.platform, 'linux');
    assert.equal(result.arch, 'x64');
    assert.equal(result.target, 'x86_64-unknown-linux-gnu');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'bundle-runtime');
    assert.equal(result.report.report.runtimeBaseUrl, 'http://127.0.0.1:19797');
    assert.equal(result.report.report.launcherRelativePath, 'bin/claw-server');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['health-ready', 'host-endpoints', 'browser-shell'],
    );
    assert.equal(existsSync(result.report.reportPath), true);
    assert.equal(
      JSON.parse(readFileSync(result.report.reportPath, 'utf8')).status,
      'passed',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('server bundle smoke can extract Windows zip bundles produced by the release packager', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-windows-smoke-'));
  const outputDir = path.join(tempRoot, 'release-assets');
  const serverTargetDir = path.join(tempRoot, 'server-target');
  const webDistDir = path.join(tempRoot, 'web-dist');
  const envExamplePath = path.join(tempRoot, '.env.example');
  const releaseTag = 'release-2026-04-10-171';

  try {
    writeSyntheticServerRuntime({
      serverTargetDir,
      targetTriple: 'x86_64-pc-windows-msvc',
      binaryName: 'claw-server.exe',
      webDistDir,
      envExamplePath,
    });

    packager.packageServerAssets({
      releaseTag,
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      outputDir,
      serverBuildTargetDir: serverTargetDir,
      serverWebDistDir: webDistDir,
      serverEnvPath: envExamplePath,
    });

    const archivePath = path.join(
      outputDir,
      'server',
      'windows',
      'x64',
      `claw-studio-server-${releaseTag}-windows-x64.zip`,
    );
    const manifestPath = path.join(
      outputDir,
      'server',
      'windows',
      'x64',
      'release-asset-manifest.json',
    );
    const bundleRoot = await smoke.extractServerArchive({
      archivePath,
      extractDir: path.join(tempRoot, 'extract'),
    });

    assert.equal(existsSync(archivePath), true, `missing expected server archive ${archivePath}`);
    assert.equal(existsSync(path.join(bundleRoot, 'bin', 'claw-server.exe')), true);
    assert.equal(existsSync(path.join(bundleRoot, 'start-claw-server.cmd')), true);
    assert.equal(existsSync(path.join(bundleRoot, 'web', 'dist', 'index.html')), true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.platform, 'windows');
    assert.equal(manifest.arch, 'x64');
    assert.equal(
      manifest.artifacts[0].relativePath,
      `server/windows/x64/claw-studio-server-${releaseTag}-windows-x64.zip`,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('server bundle smoke stops Windows launcher trees with taskkill before cleanup', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.stopChildProcess, 'function');

  const taskkillCalls = [];
  const child = {
    pid: 4242,
    exitCode: null,
    signalCode: null,
    kill() {
      throw new Error('windows cleanup should not fall back to child.kill before taskkill');
    },
  };

  await smoke.stopChildProcess(child, {
    platform: 'win32',
    runTaskkillFn(command, args, options) {
      taskkillCalls.push({ command, args, options });
      child.exitCode = 0;
      return {
        status: 0,
        error: null,
      };
    },
    waitForExitFn: async () => {},
  });

  assert.deepEqual(taskkillCalls, [
    {
      command: 'taskkill',
      args: ['/PID', '4242', '/T', '/F'],
      options: {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    },
  ]);
});

test('server bundle smoke falls back to direct child termination when taskkill is blocked', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const killCalls = [];
  const child = {
    pid: 5252,
    exitCode: null,
    signalCode: null,
    kill(signal) {
      killCalls.push(signal ?? 'default');
      this.exitCode = 0;
    },
  };

  await smoke.stopChildProcess(child, {
    platform: 'win32',
    runTaskkillFn() {
      const error = new Error('spawnSync taskkill EPERM');
      error.code = 'EPERM';
      return {
        status: null,
        error,
      };
    },
    waitForExitFn: async () => {},
  });

  assert.deepEqual(killCalls, ['default']);
});

test('server bundle smoke retries transient busy cleanup before failing', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.removeDirectoryWithRetries, 'function');

  let attempts = 0;
  await smoke.removeDirectoryWithRetries('C:/synthetic/claw-server-smoke', {
    retries: 3,
    delayMs: 1,
    delayFn: async () => {},
    rmDirFn() {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('resource busy');
        error.code = 'EBUSY';
        throw error;
      }
    },
  });

  assert.equal(attempts, 3);
});

test('server bundle smoke launches the bundled server binary directly on Windows', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const spawnCalls = [];
  const stopCalls = [];
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-launch-'));
  const bundleRoot = path.join(tempRoot, 'server-bundle');
  const child = {
    pid: 7373,
    exitCode: 0,
    signalCode: null,
  };

  try {
    mkdirSync(bundleRoot, { recursive: true });

    const runtime = await smoke.launchServerBundle({
      bundleRoot,
      platform: 'windows',
      port: 19897,
      spawnFn(command, args, options) {
        spawnCalls.push({ command, args, options });
        return child;
      },
      stopChildProcessFn: async (receivedChild, options) => {
        stopCalls.push({ receivedChild, options });
      },
      existsSyncFn(targetPath) {
        return targetPath === path.join(bundleRoot, 'bin', 'claw-server.exe');
      },
    });

    assert.equal(runtime.baseUrl, 'http://127.0.0.1:19897');
    assert.equal(runtime.launcherRelativePath, 'bin/claw-server.exe');
    assert.deepEqual(spawnCalls, [
      {
        command: path.join(bundleRoot, 'bin', 'claw-server.exe'),
        args: [],
        options: {
          cwd: bundleRoot,
          env: {
            ...process.env,
            CLAW_SERVER_HOST: '127.0.0.1',
            CLAW_SERVER_PORT: '19897',
          },
          stdio: 'ignore',
          windowsHide: true,
        },
      },
    ]);

    await runtime.stop();
    assert.deepEqual(stopCalls, [
      {
        receivedChild: child,
        options: {
          platform: 'windows',
        },
      },
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('server bundle smoke launches the bundled server binary directly on Linux', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const spawnCalls = [];
  const stopCalls = [];
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-launch-linux-'));
  const bundleRoot = path.join(tempRoot, 'server-bundle');
  const child = {
    pid: 8484,
    exitCode: 0,
    signalCode: null,
  };

  try {
    mkdirSync(bundleRoot, { recursive: true });

    const runtime = await smoke.launchServerBundle({
      bundleRoot,
      platform: 'linux',
      port: 20897,
      spawnFn(command, args, options) {
        spawnCalls.push({ command, args, options });
        return child;
      },
      stopChildProcessFn: async (receivedChild, options) => {
        stopCalls.push({ receivedChild, options });
      },
      existsSyncFn(targetPath) {
        return targetPath === path.join(bundleRoot, 'bin', 'claw-server');
      },
    });

    assert.equal(runtime.baseUrl, 'http://127.0.0.1:20897');
    assert.equal(runtime.launcherRelativePath, 'bin/claw-server');
    assert.deepEqual(spawnCalls, [
      {
        command: path.join(bundleRoot, 'bin', 'claw-server'),
        args: [],
        options: {
          cwd: bundleRoot,
          env: {
            ...process.env,
            CLAW_SERVER_HOST: '127.0.0.1',
            CLAW_SERVER_PORT: '20897',
          },
          stdio: 'ignore',
        },
      },
    ]);

    await runtime.stop();
    assert.deepEqual(stopCalls, [
      {
        receivedChild: child,
        options: {
          platform: 'linux',
        },
      },
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
