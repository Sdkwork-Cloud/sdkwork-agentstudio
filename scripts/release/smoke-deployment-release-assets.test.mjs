import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function writeReleaseManifest({
  releaseAssetsDir,
  family,
  platform = 'linux',
  arch = 'x64',
  accelerator = 'cpu',
  releaseTag,
  archiveRelativePath,
} = {}) {
  const familyDir = path.join(releaseAssetsDir, family, platform, arch, accelerator);
  mkdirSync(familyDir, { recursive: true });
  writeFileSync(
    path.join(releaseAssetsDir, archiveRelativePath),
    `${family}-bundle`,
    'utf8',
  );
  writeFileSync(
    path.join(familyDir, 'release-asset-manifest.json'),
    `${JSON.stringify({
      profileId: 'claw-studio',
      releaseTag,
      platform,
      arch,
      artifacts: [
        {
          name: path.basename(archiveRelativePath),
          relativePath: archiveRelativePath,
          family,
          platform,
          arch,
          accelerator,
          kind: 'archive',
          sha256: 'placeholder',
          size: 16,
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );

  return familyDir;
}

test('container deployment smoke validates packaged bundles and writes runtime-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-deployment-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeDeploymentReleaseAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-container-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'container/linux/x64/cpu/claw-studio-container-bundle-release-2026-04-06-02-linux-x64-cpu.tar.gz';
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-container');

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'container',
      releaseTag: 'release-2026-04-06-02',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'container',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          docker: true,
          dockerCompose: true,
        };
      },
      extractDeploymentBundleFn: async ({ archivePath, extractDir }) => {
        assert.equal(archivePath.replaceAll('\\', '/'), path.join(releaseAssetsDir, archiveRelativePath).replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-deployment-smoke-container-/);
        mkdirSync(path.join(extractedBundleRoot, 'deploy', 'docker'), { recursive: true });
        writeFileSync(
          path.join(extractedBundleRoot, 'deploy', 'docker', 'docker-compose.yml'),
          'services: {}\n',
          'utf8',
        );
        return extractedBundleRoot;
      },
      smokeContainerDeploymentBundleFn: async ({ bundleRoot, accelerator, capabilities }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(accelerator, 'cpu');
        assert.deepEqual(capabilities, {
          docker: true,
          dockerCompose: true,
        });
        return {
          launcherRelativePath: 'deploy/docker/docker-compose.yml',
          runtimeBaseUrl: 'http://127.0.0.1:18797',
          checks: [
            {
              id: 'deployment-identity',
              status: 'passed',
              detail: 'packaged container bundle preserves deployment family and accelerator identity',
            },
            {
              id: 'runtime-profile',
              status: 'passed',
              detail: 'packaged container profile pins safe public bind and data directory defaults',
            },
            {
              id: 'manage-credentials',
              status: 'passed',
              detail: 'packaged docker compose requires explicit manage credentials',
            },
            {
              id: 'persistent-storage',
              status: 'passed',
              detail: 'packaged docker compose persists /var/lib/claw-server',
            },
            {
              id: 'docker-compose-up',
              status: 'passed',
              detail: 'docker compose brought the packaged bundle online',
            },
            {
              id: 'docker-compose-healthy',
              status: 'passed',
              detail: 'docker compose reported all packaged services healthy',
            },
            {
              id: 'health-ready',
              status: 'passed',
              detail: '/claw/health/ready returned 200',
            },
            {
              id: 'host-endpoints',
              status: 'passed',
              detail: '/claw/manage/v1/host-endpoints returned canonical endpoints',
            },
            {
              id: 'browser-shell',
              status: 'passed',
              detail: '/ returned bundled browser shell HTML',
            },
          ],
        };
      },
    });

    assert.equal(result.family, 'container');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'live-deployment');
    assert.equal(result.report.report.launcherRelativePath, 'deploy/docker/docker-compose.yml');
    assert.equal(result.report.report.runtimeBaseUrl, 'http://127.0.0.1:18797');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['deployment-identity', 'runtime-profile', 'manage-credentials', 'persistent-storage', 'docker-compose-up', 'docker-compose-healthy', 'health-ready', 'host-endpoints', 'browser-shell'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container deployment bundle smoke requires packaged manage credentials, persistence, and healthy services before endpoint verification', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.smokeContainerDeploymentBundle, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-container-bundle-smoke-'));
  const bundleRoot = path.join(tempRoot, 'bundle');
  const events = [];
  try {
    mkdirSync(path.join(bundleRoot, 'deploy', 'docker', 'profiles'), { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'container',
        platform: 'linux',
        arch: 'x64',
        accelerator: 'cpu',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'docker-compose.yml'),
      [
        'services:',
        '  claw-server:',
        '    environment:',
        '      CLAW_SERVER_MANAGE_USERNAME: ${CLAW_SERVER_MANAGE_USERNAME:?set CLAW_SERVER_MANAGE_USERNAME before starting the public control plane}',
        '      CLAW_SERVER_MANAGE_PASSWORD: ${CLAW_SERVER_MANAGE_PASSWORD:?set CLAW_SERVER_MANAGE_PASSWORD before starting the public control plane}',
        '    volumes:',
        '      - claw-server-data:/var/lib/claw-server',
        'volumes:',
        '  claw-server-data:',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'profiles', 'default.env'),
      [
        'CLAW_DEPLOYMENT_FAMILY=container',
        'CLAW_ACCELERATOR_PROFILE=cpu',
        'CLAW_SERVER_DATA_DIR=/var/lib/claw-server',
        'CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = await smoke.smokeContainerDeploymentBundle({
      bundleRoot,
      accelerator: 'cpu',
      capabilities: {
        docker: true,
        dockerCompose: true,
      },
      runDockerComposeUpFn({ bundleRoot, accelerator, env, capabilities }) {
        assert.match(bundleRoot.replaceAll('\\', '/'), /claw-container-bundle-smoke-.*\/bundle$/);
        assert.equal(accelerator, 'cpu');
        assert.equal(env.CLAW_SERVER_MANAGE_USERNAME, 'claw-admin');
        assert.equal(env.CLAW_SERVER_MANAGE_PASSWORD, 'claw-smoke-password');
        assert.deepEqual(capabilities, {
          docker: true,
          dockerCompose: true,
        });
        events.push('up');
      },
      inspectDockerComposeHealthFn({ bundleRoot, accelerator, env, capabilities }) {
        assert.match(bundleRoot.replaceAll('\\', '/'), /claw-container-bundle-smoke-.*\/bundle$/);
        assert.equal(accelerator, 'cpu');
        assert.equal(env.CLAW_SERVER_MANAGE_USERNAME, 'claw-admin');
        assert.equal(env.CLAW_SERVER_MANAGE_PASSWORD, 'claw-smoke-password');
        assert.deepEqual(capabilities, {
          docker: true,
          dockerCompose: true,
        });
        events.push('inspect');
        return [
          {
            service: 'claw-server',
            state: 'running',
            health: 'healthy',
          },
        ];
      },
      probeEndpointFn: async ({ path: requestPath }) => {
        events.push(requestPath);
        return {
          statusCode: 200,
          body: 'ok',
        };
      },
      fetchJsonFn: async ({ path: requestPath }) => {
        events.push(requestPath);
        return {
          statusCode: 200,
          json: [],
        };
      },
      runDockerComposeDownFn() {
        events.push('down');
      },
    });

    assert.equal(result.runtimeBaseUrl, 'http://127.0.0.1:18797');
    assert.deepEqual(
      result.checks.map((check) => check.id),
      ['deployment-identity', 'runtime-profile', 'manage-credentials', 'persistent-storage', 'docker-compose-up', 'docker-compose-healthy', 'health-ready', 'host-endpoints', 'browser-shell'],
    );
    assert.match(result.checks[0].detail, /deployment family/i);
    assert.match(result.checks[1].detail, /safe public bind/i);
    assert.match(result.checks[2].detail, /manage credentials/i);
    assert.match(result.checks[3].detail, /var\/lib\/claw-server/i);
    assert.match(result.checks[5].detail, /healthy/i);
    assert.deepEqual(
      events,
      ['up', 'inspect', '/claw/health/ready', '/claw/manage/v1/host-endpoints', '/', 'down'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container deployment bundle smoke rejects packaged runtime profiles that loosen public bind safety defaults', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-container-bundle-profile-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(path.join(bundleRoot, 'deploy', 'docker', 'profiles'), { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'container',
        platform: 'linux',
        arch: 'x64',
        accelerator: 'cpu',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'docker-compose.yml'),
      [
        'services:',
        '  claw-server:',
        '    environment:',
        '      CLAW_SERVER_MANAGE_USERNAME: ${CLAW_SERVER_MANAGE_USERNAME:?set CLAW_SERVER_MANAGE_USERNAME before starting the public control plane}',
        '      CLAW_SERVER_MANAGE_PASSWORD: ${CLAW_SERVER_MANAGE_PASSWORD:?set CLAW_SERVER_MANAGE_PASSWORD before starting the public control plane}',
        '    volumes:',
        '      - claw-server-data:/var/lib/claw-server',
        'volumes:',
        '  claw-server-data:',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'profiles', 'default.env'),
      [
        'CLAW_DEPLOYMENT_FAMILY=container',
        'CLAW_ACCELERATOR_PROFILE=cpu',
        'CLAW_SERVER_DATA_DIR=/var/lib/claw-server',
        'CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true',
        '',
      ].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () => smoke.smokeContainerDeploymentBundle({
        bundleRoot,
        accelerator: 'cpu',
        capabilities: {
          docker: true,
          dockerCompose: true,
        },
        runDockerComposeUpFn() {
          throw new Error('should not start docker compose when packaged runtime profile is unsafe');
        },
      }),
      /public bind|CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND|runtime profile/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container deployment bundle smoke rejects accelerator bundles whose packaged identity overlays drift from the selected accelerator', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-container-bundle-accelerator-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(path.join(bundleRoot, 'deploy', 'docker', 'profiles'), { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'container',
        platform: 'linux',
        arch: 'x64',
        accelerator: 'nvidia-cuda',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'docker-compose.yml'),
      [
        'services:',
        '  claw-server:',
        '    environment:',
        '      CLAW_SERVER_MANAGE_USERNAME: ${CLAW_SERVER_MANAGE_USERNAME:?set CLAW_SERVER_MANAGE_USERNAME before starting the public control plane}',
        '      CLAW_SERVER_MANAGE_PASSWORD: ${CLAW_SERVER_MANAGE_PASSWORD:?set CLAW_SERVER_MANAGE_PASSWORD before starting the public control plane}',
        '    volumes:',
        '      - claw-server-data:/var/lib/claw-server',
        'volumes:',
        '  claw-server-data:',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'profiles', 'default.env'),
      [
        'CLAW_DEPLOYMENT_FAMILY=container',
        'CLAW_ACCELERATOR_PROFILE=cpu',
        'CLAW_SERVER_DATA_DIR=/var/lib/claw-server',
        'CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false',
        '',
      ].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () => smoke.smokeContainerDeploymentBundle({
        bundleRoot,
        accelerator: 'nvidia-cuda',
        capabilities: {
          docker: true,
          dockerCompose: true,
        },
        runDockerComposeUpFn() {
          throw new Error('should not start docker compose when accelerator identity drifts');
        },
      }),
      /accelerator|deployment family|docker-compose\.nvidia-cuda\.yml|nvidia-cuda\.env/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container deployment bundle smoke rejects packaged compose layouts missing explicit manage credentials', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-container-bundle-contract-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(path.join(bundleRoot, 'deploy', 'docker', 'profiles'), { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'container',
        platform: 'linux',
        arch: 'x64',
        accelerator: 'cpu',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'docker-compose.yml'),
      [
        'services:',
        '  claw-server:',
        '    environment:',
        '      CLAW_SERVER_INTERNAL_USERNAME: ${CLAW_SERVER_INTERNAL_USERNAME:-}',
        '    volumes:',
        '      - claw-server-data:/var/lib/claw-server',
        'volumes:',
        '  claw-server-data:',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'deploy', 'docker', 'profiles', 'default.env'),
      [
        'CLAW_DEPLOYMENT_FAMILY=container',
        'CLAW_ACCELERATOR_PROFILE=cpu',
        'CLAW_SERVER_DATA_DIR=/var/lib/claw-server',
        'CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false',
        '',
      ].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () => smoke.smokeContainerDeploymentBundle({
        bundleRoot,
        accelerator: 'cpu',
        capabilities: {
          docker: true,
          dockerCompose: true,
        },
        runDockerComposeUpFn() {
          throw new Error('should not start docker compose when packaged credentials are missing');
        },
      }),
      /manage credentials|CLAW_SERVER_MANAGE_USERNAME|CLAW_SERVER_MANAGE_PASSWORD/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes deployment smoke validates packaged charts and writes render-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-kubernetes-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'kubernetes/linux/x64/cpu/claw-studio-kubernetes-bundle-release-2026-04-06-03-linux-x64-cpu.tar.gz';
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-kubernetes');

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'kubernetes',
      releaseTag: 'release-2026-04-06-03',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'kubernetes',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          helm: true,
          kubectl: true,
        };
      },
      extractDeploymentBundleFn: async ({ archivePath, extractDir }) => {
        assert.equal(archivePath.replaceAll('\\', '/'), path.join(releaseAssetsDir, archiveRelativePath).replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-deployment-smoke-kubernetes-/);
        mkdirSync(path.join(extractedBundleRoot, 'chart', 'templates'), { recursive: true });
        writeFileSync(path.join(extractedBundleRoot, 'chart', 'Chart.yaml'), 'apiVersion: v2\nname: claw-studio\n', 'utf8');
        writeFileSync(path.join(extractedBundleRoot, 'values.release.yaml'), 'targetArchitecture: x64\n', 'utf8');
        return extractedBundleRoot;
      },
      smokeKubernetesDeploymentBundleFn: async ({ bundleRoot, accelerator, capabilities }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(accelerator, 'cpu');
        assert.deepEqual(capabilities, {
          helm: true,
          kubectl: true,
        });
        return {
          launcherRelativePath: 'chart/Chart.yaml',
          checks: [
            {
              id: 'helm-template',
              status: 'passed',
              detail: 'helm template rendered the packaged chart successfully',
            },
            {
              id: 'deployment-identity',
              status: 'passed',
              detail: 'packaged kubernetes bundle preserves target architecture and accelerator identity',
            },
            {
              id: 'image-reference',
              status: 'passed',
              detail: 'rendered manifests reference the packaged OCI image coordinates',
            },
            {
              id: 'configmap-runtime-identity',
              status: 'passed',
              detail: 'rendered config map preserves kubernetes deployment family and accelerator profile',
            },
            {
              id: 'readiness-probe',
              status: 'passed',
              detail: 'rendered deployment probes /claw/health/ready',
            },
            {
              id: 'secret-ref',
              status: 'passed',
              detail: 'rendered deployment consumes Secret-backed control-plane credentials',
            },
            {
              id: 'persistent-storage',
              status: 'passed',
              detail: 'rendered manifests mount /var/lib/claw-server through a PersistentVolumeClaim',
            },
            {
              id: 'kubectl-client-dry-run',
              status: 'passed',
              detail: 'kubectl client-side dry-run accepted the rendered manifests',
            },
          ],
        };
      },
    });

    assert.equal(result.family, 'kubernetes');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'chart-render');
    assert.equal(result.report.report.launcherRelativePath, 'chart/Chart.yaml');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['helm-template', 'deployment-identity', 'image-reference', 'configmap-runtime-identity', 'readiness-probe', 'secret-ref', 'persistent-storage', 'kubectl-client-dry-run'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes deployment bundle smoke requires packaged image metadata, secret refs, and persistent storage invariants', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.smokeKubernetesDeploymentBundle, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kubernetes-bundle-smoke-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(bundleRoot, { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'kubernetes',
        platform: 'linux',
        arch: 'x64',
        accelerator: 'cpu',
        imageRepository: 'ghcr.io/sdkwork-cloud/claw-studio-server',
        imageTag: 'release-2026-04-06-07-linux-x64',
        imageDigest: 'sha256:1234567890abcdef',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'values.release.yaml'),
      [
        'targetArchitecture: x64',
        'acceleratorProfile: cpu',
        '',
      ].join('\n'),
      'utf8',
    );

    let dryRunCalled = false;
    const result = await smoke.smokeKubernetesDeploymentBundle({
      bundleRoot,
      accelerator: 'cpu',
      capabilities: {
        helm: true,
        kubectl: true,
      },
      runHelmTemplateFn() {
        return [
          'apiVersion: apps/v1',
          'kind: Deployment',
          'spec:',
          '  template:',
          '    spec:',
          '      containers:',
          '        - name: claw-studio',
          '          image: ghcr.io/sdkwork-cloud/claw-studio-server@sha256:1234567890abcdef',
          '          env:',
          '            - name: CLAW_DEPLOYMENT_FAMILY',
          '              value: "kubernetes"',
          '            - name: CLAW_ACCELERATOR_PROFILE',
          '              value: "cpu"',
          '          envFrom:',
          '            - secretRef:',
          '                name: claw-studio-auth',
          '          volumeMounts:',
          '            - name: claw-data',
          '              mountPath: /var/lib/claw-server',
          '          readinessProbe:',
          '            httpGet:',
          '              path: /claw/health/ready',
          '      volumes:',
          '        - name: claw-data',
          '          persistentVolumeClaim:',
          '            claimName: claw-studio-data',
          '      nodeSelector:',
          '        kubernetes.io/arch: amd64',
          '---',
          'apiVersion: v1',
          'kind: Secret',
          'metadata:',
          '  name: claw-studio-auth',
          '---',
          'apiVersion: v1',
          'kind: PersistentVolumeClaim',
        ].join('\n');
      },
      runKubectlClientDryRunFn({ renderedManifest }) {
        dryRunCalled = true;
        assert.match(renderedManifest, /kind:\s+PersistentVolumeClaim/);
      },
    });

    assert.equal(dryRunCalled, true);
    assert.deepEqual(
      result.checks.map((check) => check.id),
      ['helm-template', 'deployment-identity', 'image-reference', 'configmap-runtime-identity', 'readiness-probe', 'secret-ref', 'persistent-storage', 'kubectl-client-dry-run'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes deployment bundle smoke rejects release values whose packaged architecture or accelerator identity drifts', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kubernetes-bundle-identity-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(bundleRoot, { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'kubernetes',
        platform: 'linux',
        arch: 'arm64',
        accelerator: 'nvidia-cuda',
        imageRepository: 'ghcr.io/sdkwork-cloud/claw-studio-server',
        imageTag: 'release-2026-04-06-09-linux-arm64',
        imageDigest: 'sha256:fedcba0987654321',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'values.release.yaml'),
      [
        'targetArchitecture: x64',
        'acceleratorProfile: cpu',
        '',
      ].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () => smoke.smokeKubernetesDeploymentBundle({
        bundleRoot,
        accelerator: 'nvidia-cuda',
        capabilities: {
          helm: true,
          kubectl: false,
        },
        runHelmTemplateFn() {
          return [
            'apiVersion: apps/v1',
            'kind: Deployment',
            'spec:',
            '  template:',
            '    spec:',
            '      containers:',
            '        - name: claw-studio',
            '          image: ghcr.io/sdkwork-cloud/claw-studio-server@sha256:fedcba0987654321',
            '          env:',
            '            - name: CLAW_DEPLOYMENT_FAMILY',
            '              value: "kubernetes"',
            '            - name: CLAW_ACCELERATOR_PROFILE',
            '              value: "cpu"',
            '          envFrom:',
            '            - secretRef:',
            '                name: claw-studio-auth',
            '          volumeMounts:',
            '            - name: claw-data',
            '              mountPath: /var/lib/claw-server',
            '          readinessProbe:',
            '            httpGet:',
            '              path: /claw/health/ready',
            '      volumes:',
            '        - name: claw-data',
            '          persistentVolumeClaim:',
            '            claimName: claw-studio-data',
            '      nodeSelector:',
            '        kubernetes.io/arch: amd64',
            '---',
            'apiVersion: v1',
            'kind: Secret',
            'metadata:',
            '  name: claw-studio-auth',
            '---',
            'apiVersion: v1',
            'kind: PersistentVolumeClaim',
          ].join('\n');
        },
      }),
      /targetArchitecture|acceleratorProfile|kubernetes\.io\/arch|deployment family|identity/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes deployment bundle smoke rejects bundles missing immutable image metadata', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kubernetes-bundle-smoke-metadata-'));
  const bundleRoot = path.join(tempRoot, 'bundle');

  try {
    mkdirSync(bundleRoot, { recursive: true });

    await assert.rejects(
      () => smoke.smokeKubernetesDeploymentBundle({
        bundleRoot,
        accelerator: 'cpu',
        capabilities: {
          helm: true,
          kubectl: false,
        },
        runHelmTemplateFn() {
          return [
            'apiVersion: apps/v1',
            'kind: Deployment',
            'spec:',
            '  template:',
            '    spec:',
            '      containers:',
            '        - name: claw-studio',
            '          image: ghcr.io/sdkwork-cloud/claw-studio-server:release-2026-04-06-08-linux-x64',
            '          envFrom:',
            '            - secretRef:',
            '                name: claw-studio-auth',
            '          volumeMounts:',
            '            - name: claw-data',
            '              mountPath: /var/lib/claw-server',
            '          readinessProbe:',
            '            httpGet:',
            '              path: /claw/health/ready',
            '      volumes:',
            '        - name: claw-data',
            '          persistentVolumeClaim:',
            '            claimName: claw-studio-data',
            '---',
            'apiVersion: v1',
            'kind: PersistentVolumeClaim',
          ].join('\n');
        },
      }),
      /release-metadata\.json|image metadata|image reference/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('deployment smoke records structured skipped evidence when required capabilities are unavailable', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-skipped-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'container/linux/x64/cpu/claw-studio-container-bundle-release-2026-04-06-04-linux-x64-cpu.tar.gz';

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'container',
      releaseTag: 'release-2026-04-06-04',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'container',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          docker: false,
          dockerCompose: false,
        };
      },
    });

    assert.equal(result.report.report.status, 'skipped');
    assert.match(result.report.report.skippedReason, /docker/i);
    assert.deepEqual(result.report.report.capabilities, {
      docker: false,
      dockerCompose: false,
    });
    assert.equal(
      JSON.parse(readFileSync(result.report.reportPath, 'utf8')).status,
      'skipped',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container deployment capability detection treats an unresponsive docker daemon as unavailable', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const capabilities = smoke.detectDeploymentSmokeCapabilities({
    family: 'container',
    commandExistsFn(command, args) {
      if (command === 'docker' && Array.isArray(args) && args[0] === '--version') {
        return true;
      }
      if (
        command === 'docker'
        && Array.isArray(args)
        && args[0] === 'compose'
        && args[1] === 'version'
      ) {
        return true;
      }
      throw new Error(`Unexpected capability probe: ${command} ${String(args ?? []).trim()}`);
    },
    probeDockerServerFn({ timeoutMs }) {
      assert.equal(timeoutMs, 10000);
      return false;
    },
  });

  assert.deepEqual(capabilities, {
    docker: false,
    dockerCompose: true,
  });
});
