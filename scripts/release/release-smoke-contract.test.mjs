import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('release smoke contract resolves report paths and persists normalized smoke evidence', async () => {
  const contractPath = path.join(rootDir, 'scripts', 'release', 'release-smoke-contract.mjs');
  const contract = await import(pathToFileURL(contractPath).href);

  assert.equal(typeof contract.RELEASE_SMOKE_REPORT_FILENAME, 'string');
  assert.equal(typeof contract.resolveReleaseSmokeReportPath, 'function');
  assert.equal(typeof contract.writeReleaseSmokeReport, 'function');
  assert.equal(typeof contract.readReleaseSmokeReport, 'function');

  assert.equal(
    contract.resolveReleaseSmokeReportPath({
      releaseAssetsDir: 'D:/synthetic/release-assets',
      family: 'server',
      platform: 'linux',
      arch: 'x64',
    }).replaceAll('\\', '/'),
    'D:/synthetic/release-assets/server/linux/x64/release-smoke-report.json',
  );
  assert.equal(
    contract.resolveReleaseSmokeReportPath({
      releaseAssetsDir: 'D:/synthetic/release-assets',
      family: 'container',
      platform: 'linux',
      arch: 'arm64',
      accelerator: 'cpu',
    }).replaceAll('\\', '/'),
    'D:/synthetic/release-assets/container/linux/arm64/cpu/release-smoke-report.json',
  );
  assert.equal(
    contract.resolveReleaseSmokeReportPath({
      releaseAssetsDir: 'D:/synthetic/release-assets',
      family: 'kubernetes',
      platform: 'linux',
      arch: 'x64',
      accelerator: 'nvidia-cuda',
    }).replaceAll('\\', '/'),
    'D:/synthetic/release-assets/kubernetes/linux/x64/nvidia-cuda/release-smoke-report.json',
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-smoke-contract-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    const result = contract.writeReleaseSmokeReport({
      releaseAssetsDir,
      family: 'server',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      smokeKind: 'bundle-runtime',
      status: 'passed',
      manifestPath: path.join(releaseAssetsDir, 'server', 'linux', 'x64', 'release-asset-manifest.json'),
      artifactRelativePaths: [
        'server/linux/x64/claw-studio-server-release-local-linux-x64.tar.gz',
      ],
      launcherRelativePath: 'bin/claw-server',
      runtimeBaseUrl: 'http://127.0.0.1:19797',
      checks: [
        {
          id: 'health-ready',
          status: 'passed',
          detail: '/claw/health/ready returned 200',
        },
      ],
    });

    assert.equal(existsSync(result.reportPath), true);
    const report = JSON.parse(readFileSync(result.reportPath, 'utf8'));
    assert.equal(report.family, 'server');
    assert.equal(report.platform, 'linux');
    assert.equal(report.arch, 'x64');
    assert.equal(report.smokeKind, 'bundle-runtime');
    assert.equal(report.status, 'passed');
    assert.deepEqual(report.checks, [
      {
        id: 'health-ready',
        status: 'passed',
        detail: '/claw/health/ready returned 200',
      },
    ]);

    assert.deepEqual(contract.readReleaseSmokeReport(result.reportPath), report);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
