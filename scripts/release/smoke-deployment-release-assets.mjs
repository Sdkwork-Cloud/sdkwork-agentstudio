#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';
import {
  fetchJson,
  probeEndpoint,
} from './smoke-server-release-assets.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';
const DOCKER_SERVER_CAPABILITY_TIMEOUT_MS = 10000;

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function runCommand({
  command,
  args,
  cwd,
  env,
  input,
  label,
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status ?? 'unknown'}.${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: DOCKER_SERVER_CAPABILITY_TIMEOUT_MS,
    windowsHide: true,
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
}

export function detectDeploymentSmokeCapabilities({
  family,
  commandExistsFn = commandExists,
  probeDockerServerFn = probeDockerServer,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();

  if (normalizedFamily === 'container') {
    const dockerCliAvailable = commandExistsFn('docker', ['--version']);
    return {
      docker: dockerCliAvailable && probeDockerServerFn({
        timeoutMs: DOCKER_SERVER_CAPABILITY_TIMEOUT_MS,
      }),
      dockerCompose: commandExistsFn('docker', ['compose', 'version']),
    };
  }

  if (normalizedFamily === 'kubernetes') {
    return {
      helm: commandExists('helm', ['version']),
      kubectl: commandExists('kubectl', ['version', '--client']),
    };
  }

  throw new Error(`Unsupported deployment smoke family: ${family}`);
}

function probeDockerServer({
  timeoutMs = DOCKER_SERVER_CAPABILITY_TIMEOUT_MS,
} = {}) {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });

  if (result.error) {
    return false;
  }

  return result.status === 0 && String(result.stdout ?? '').trim().length > 0;
}

function resolveDeploymentReleaseAssetManifestPath({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  family,
  platform,
  arch,
  accelerator = 'cpu',
} = {}) {
  return path.join(
    releaseAssetsDir,
    family,
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
    String(accelerator ?? '').trim().toLowerCase() || 'cpu',
    RELEASE_ASSET_MANIFEST_FILENAME,
  );
}

function readDeploymentReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  family,
  platform,
  arch,
  accelerator = 'cpu',
} = {}) {
  const manifestPath = resolveDeploymentReleaseAssetManifestPath({
    releaseAssetsDir,
    family,
    platform,
    arch,
    accelerator,
  });

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${family} release asset manifest: ${manifestPath}`);
  }

  return {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  };
}

function resolveDeploymentArchiveArtifact(manifest, manifestPath) {
  const archiveArtifacts = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.filter((artifact) => {
      const relativePath = String(artifact?.relativePath ?? '').trim().toLowerCase();
      return relativePath.endsWith('.tar.gz') || relativePath.endsWith('.zip');
    })
    : [];

  if (archiveArtifacts.length === 0) {
    throw new Error(`Missing deployment archive artifact in ${manifestPath}`);
  }

  return archiveArtifacts[0];
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Deployment release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing deployment release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

export async function extractDeploymentBundle({
  archivePath,
  extractDir,
} = {}) {
  const lowerCaseArchivePath = String(archivePath ?? '').trim().toLowerCase();

  if (lowerCaseArchivePath.endsWith('.zip')) {
    runCommand({
      command: 'tar',
      args: ['-xf', archivePath, '-C', extractDir],
      label: 'Extracting deployment zip archive',
    });
  } else {
    runCommand({
      command: 'tar',
      args: ['-xzf', archivePath, '-C', extractDir],
      label: 'Extracting deployment tar.gz archive',
    });
  }

  const bundleDirectories = readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (bundleDirectories.length === 0) {
    throw new Error(`Unable to resolve extracted deployment bundle root from ${archivePath}`);
  }

  return path.join(extractDir, bundleDirectories[0].name);
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeDeploymentAccelerator(accelerator = 'cpu') {
  return String(accelerator ?? '').trim().toLowerCase() || 'cpu';
}

function parseSimpleEnvFile(content) {
  const entries = new Map();
  for (const rawLine of String(content ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    entries.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim(),
    );
  }

  return entries;
}

function resolveExpectedKubernetesNodeArch(arch = '') {
  const normalizedArch = normalizeDesktopArch(arch);
  if (normalizedArch === 'x64') {
    return 'amd64';
  }
  if (normalizedArch === 'arm64') {
    return 'arm64';
  }

  throw new Error(`Unsupported kubernetes release architecture: ${arch}`);
}

function resolveContainerComposeFilePaths(accelerator = 'cpu') {
  const composeFiles = ['deploy/docker/docker-compose.yml'];
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';

  if (normalizedAccelerator === 'nvidia-cuda') {
    composeFiles.push('deploy/docker/docker-compose.nvidia-cuda.yml');
  }
  if (normalizedAccelerator === 'amd-rocm') {
    composeFiles.push('deploy/docker/docker-compose.amd-rocm.yml');
  }

  return composeFiles;
}

export function runDockerComposeUp({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const composeFiles = resolveContainerComposeFilePaths(accelerator);
  const args = ['compose'];
  for (const composeFile of composeFiles) {
    args.push('-f', composeFile);
  }
  args.push('up', '-d', '--build');

  runCommand({
    command: 'docker',
    args,
    cwd: bundleRoot,
    env,
    label: 'Starting packaged container deployment smoke',
  });
}

export function runDockerComposeDown({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const composeFiles = resolveContainerComposeFilePaths(accelerator);
  const args = ['compose'];
  for (const composeFile of composeFiles) {
    args.push('-f', composeFile);
  }
  args.push('down', '-v', '--remove-orphans');

  runCommand({
    command: 'docker',
    args,
    cwd: bundleRoot,
    env,
    label: 'Stopping packaged container deployment smoke',
  });
}

export function runDockerComposePs({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const composeFiles = resolveContainerComposeFilePaths(accelerator);
  const args = ['compose'];
  for (const composeFile of composeFiles) {
    args.push('-f', composeFile);
  }
  args.push('ps', '--format', 'json');

  return runCommand({
    command: 'docker',
    args,
    cwd: bundleRoot,
    env,
    label: 'Inspecting packaged container deployment smoke health',
  }).stdout;
}

export function parseDockerComposePsOutput(output) {
  const normalizedOutput = String(output ?? '').trim();
  if (!normalizedOutput) {
    throw new Error('docker compose ps returned no packaged service records.');
  }

  const rawEntries = normalizedOutput.startsWith('[')
    ? JSON.parse(normalizedOutput)
    : normalizedOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const records = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

  return records.map((record) => ({
    service: String(record?.Service ?? record?.service ?? '').trim(),
    name: String(record?.Name ?? record?.name ?? '').trim(),
    state: String(record?.State ?? record?.state ?? record?.Status ?? '').trim().toLowerCase(),
    health: String(record?.Health ?? record?.health ?? '').trim().toLowerCase(),
  }));
}

export function inspectDockerComposeHealth({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const services = parseDockerComposePsOutput(runDockerComposePs({
    bundleRoot,
    accelerator,
    env,
  }));

  if (services.length === 0) {
    throw new Error('docker compose ps did not report any packaged services.');
  }

  for (const service of services) {
    const serviceLabel = service.service || service.name || 'unknown-service';
    if (!service.state.includes('running')) {
      throw new Error(
        `Packaged docker compose service ${serviceLabel} is not running (state: ${service.state || 'unknown'}).`,
      );
    }
    if (!service.health) {
      throw new Error(
        `Packaged docker compose service ${serviceLabel} did not expose a health status.`,
      );
    }
    if (service.health !== 'healthy') {
      throw new Error(
        `Packaged docker compose service ${serviceLabel} is not healthy (health: ${service.health}).`,
      );
    }
  }

  return {
    services,
  };
}

export function inspectContainerDeploymentContract({
  bundleRoot,
  accelerator = 'cpu',
} = {}) {
  const composePath = path.join(bundleRoot, 'deploy', 'docker', 'docker-compose.yml');
  const defaultProfilePath = path.join(bundleRoot, 'deploy', 'docker', 'profiles', 'default.env');
  const releaseMetadata = requireDeploymentBundleReleaseMetadata(bundleRoot);
  const normalizedAccelerator = normalizeDeploymentAccelerator(accelerator);
  if (!existsSync(composePath)) {
    throw new Error(`Packaged container bundle is missing deploy/docker/docker-compose.yml: ${composePath}`);
  }
  if (!existsSync(defaultProfilePath)) {
    throw new Error(`Packaged container bundle is missing deploy/docker/profiles/default.env: ${defaultProfilePath}`);
  }

  const composeDefinition = readFileSync(composePath, 'utf8');
  const defaultProfileEntries = parseSimpleEnvFile(readFileSync(defaultProfilePath, 'utf8'));
  const metadataFamily = String(releaseMetadata?.family ?? '').trim().toLowerCase();
  const metadataAccelerator = normalizeDeploymentAccelerator(releaseMetadata?.accelerator);

  if (metadataFamily !== 'container') {
    throw new Error('Packaged container bundle release-metadata.json must declare family=container.');
  }
  if (metadataAccelerator !== normalizedAccelerator) {
    throw new Error(
      `Packaged container bundle accelerator mismatch: expected ${normalizedAccelerator}, received ${metadataAccelerator}.`,
    );
  }
  if (defaultProfileEntries.get('CLAW_DEPLOYMENT_FAMILY') !== 'container') {
    throw new Error(
      `Packaged container runtime profile must pin CLAW_DEPLOYMENT_FAMILY=container in ${defaultProfilePath}.`,
    );
  }

  if (normalizedAccelerator === 'cpu') {
    if (defaultProfileEntries.get('CLAW_ACCELERATOR_PROFILE') !== 'cpu') {
      throw new Error(
        `Packaged container runtime profile must pin CLAW_ACCELERATOR_PROFILE=cpu in ${defaultProfilePath}.`,
      );
    }
  } else {
    const overlayProfilePath = path.join(
      bundleRoot,
      'deploy',
      'docker',
      'profiles',
      `${normalizedAccelerator}.env`,
    );
    const overlayComposePath = path.join(
      bundleRoot,
      'deploy',
      'docker',
      `docker-compose.${normalizedAccelerator}.yml`,
    );
    if (!existsSync(overlayProfilePath)) {
      throw new Error(`Packaged container bundle is missing accelerator profile ${overlayProfilePath}.`);
    }
    if (!existsSync(overlayComposePath)) {
      throw new Error(`Packaged container bundle is missing accelerator compose overlay ${overlayComposePath}.`);
    }
    const overlayProfileEntries = parseSimpleEnvFile(readFileSync(overlayProfilePath, 'utf8'));
    if (overlayProfileEntries.get('CLAW_ACCELERATOR_PROFILE') !== normalizedAccelerator) {
      throw new Error(
        `Packaged accelerator profile ${overlayProfilePath} must pin CLAW_ACCELERATOR_PROFILE=${normalizedAccelerator}.`,
      );
    }
    if (overlayProfileEntries.get('CLAW_DEPLOYMENT_FAMILY') !== 'container') {
      throw new Error(
        `Packaged accelerator profile ${overlayProfilePath} must pin CLAW_DEPLOYMENT_FAMILY=container.`,
      );
    }
  }

  if (defaultProfileEntries.get('CLAW_SERVER_DATA_DIR') !== '/var/lib/claw-server') {
    throw new Error(
      `Packaged container runtime profile must pin CLAW_SERVER_DATA_DIR=/var/lib/claw-server in ${defaultProfilePath}.`,
    );
  }
  if (defaultProfileEntries.get('CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND') !== 'false') {
    throw new Error(
      `Packaged container runtime profile must keep CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false in ${defaultProfilePath}.`,
    );
  }

  if (
    !/CLAW_SERVER_MANAGE_USERNAME:\s+\$\{CLAW_SERVER_MANAGE_USERNAME:\?/m.test(composeDefinition)
    || !/CLAW_SERVER_MANAGE_PASSWORD:\s+\$\{CLAW_SERVER_MANAGE_PASSWORD:\?/m.test(composeDefinition)
  ) {
    throw new Error(
      `Packaged docker compose must require explicit manage credentials in ${composePath}.`,
    );
  }

  if (!/^\s*-\s+[^:\r\n]+:\/var\/lib\/claw-server\s*$/m.test(composeDefinition)) {
    throw new Error(
      `Packaged docker compose must persist /var/lib/claw-server in ${composePath}.`,
    );
  }

  return {
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
    ],
  };
}

async function waitForSuccessfulEndpoint({
  id,
  baseUrl,
  requestPath,
  probeEndpointFn = probeEndpoint,
  timeoutMs = 30000,
  intervalMs = 500,
} = {}) {
  const startedAt = Date.now();
  let lastResponse = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastResponse = await probeEndpointFn({
        baseUrl,
        path: requestPath,
      });
      if (lastResponse?.statusCode === 200) {
        return {
          id,
          status: 'passed',
          detail: `${requestPath} returned 200`,
        };
      }
    } catch (error) {
      lastResponse = {
        statusCode: 0,
        body: error instanceof Error ? error.message : String(error),
      };
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Deployment smoke timed out waiting for ${requestPath}. Last response: ${JSON.stringify(lastResponse)}`,
  );
}

async function readHostEndpointCheck({
  baseUrl,
  fetchJsonFn = fetchJson,
} = {}) {
  const response = await fetchJsonFn({
    baseUrl,
    path: '/claw/manage/v1/host-endpoints',
  });
  if (response?.statusCode !== 200) {
    throw new Error(
      `Deployment smoke expected /claw/manage/v1/host-endpoints to return 200, received ${response?.statusCode ?? 'unknown'}.`,
    );
  }
  if (!Array.isArray(response?.json)) {
    throw new Error('Deployment smoke expected /claw/manage/v1/host-endpoints to return a JSON array.');
  }

  return {
    id: 'host-endpoints',
    status: 'passed',
    detail: '/claw/manage/v1/host-endpoints returned canonical endpoints',
  };
}

export async function smokeContainerDeploymentBundle({
  bundleRoot,
  accelerator = 'cpu',
  capabilities = {},
  inspectContainerDeploymentContractFn = inspectContainerDeploymentContract,
  runDockerComposeUpFn = runDockerComposeUp,
  runDockerComposeDownFn = runDockerComposeDown,
  inspectDockerComposeHealthFn = inspectDockerComposeHealth,
  probeEndpointFn = probeEndpoint,
  fetchJsonFn = fetchJson,
} = {}) {
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';
  const baseUrl = 'http://127.0.0.1:18797';
  const env = {
    ...process.env,
    CLAW_SERVER_MANAGE_USERNAME: process.env.CLAW_SERVER_MANAGE_USERNAME || 'claw-admin',
    CLAW_SERVER_MANAGE_PASSWORD: process.env.CLAW_SERVER_MANAGE_PASSWORD || 'claw-smoke-password',
  };
  let started = false;

  try {
    const containerDeploymentContract = inspectContainerDeploymentContractFn({
      bundleRoot,
      accelerator: normalizedAccelerator,
      capabilities,
    });
    const checks = Array.isArray(containerDeploymentContract?.checks)
      ? [...containerDeploymentContract.checks]
      : [];

    runDockerComposeUpFn({
      bundleRoot,
      accelerator: normalizedAccelerator,
      env,
      capabilities,
    });
    started = true;

    checks.push({
      id: 'docker-compose-up',
      status: 'passed',
      detail: 'docker compose brought the packaged bundle online',
    });
    const composeHealth = await inspectDockerComposeHealthFn({
      bundleRoot,
      accelerator: normalizedAccelerator,
      env,
      capabilities,
    });
    const healthyServiceLabels = normalizeStringArray(
      Array.isArray(composeHealth?.services)
        ? composeHealth.services.map((service) => service?.service || service?.name)
        : [],
    );
    checks.push({
      id: 'docker-compose-healthy',
      status: 'passed',
      detail: healthyServiceLabels.length > 0
        ? `docker compose reported healthy services: ${healthyServiceLabels.join(', ')}`
        : 'docker compose reported all packaged services healthy',
    });
    checks.push(await waitForSuccessfulEndpoint({
      id: 'health-ready',
      baseUrl,
      requestPath: '/claw/health/ready',
      probeEndpointFn,
    }));
    checks.push(await readHostEndpointCheck({
      baseUrl,
      fetchJsonFn,
    }));
    checks.push(await waitForSuccessfulEndpoint({
      id: 'browser-shell',
      baseUrl,
      requestPath: '/',
      probeEndpointFn,
    }));

    return {
      launcherRelativePath: 'deploy/docker/docker-compose.yml',
      runtimeBaseUrl: baseUrl,
      checks,
    };
  } finally {
    if (started) {
      try {
        runDockerComposeDownFn({
          bundleRoot,
          accelerator: normalizedAccelerator,
          env,
          capabilities,
        });
      } catch {
        // Preserve the original failure while still attempting teardown.
      }
    }
  }
}

function resolveKubernetesOverlayValuesPath(accelerator = 'cpu') {
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';

  if (normalizedAccelerator === 'nvidia-cuda') {
    return 'chart/values-nvidia-cuda.yaml';
  }
  if (normalizedAccelerator === 'amd-rocm') {
    return 'chart/values-amd-rocm.yaml';
  }

  return '';
}

function requireDeploymentBundleReleaseMetadata(bundleRoot) {
  const metadataPath = path.join(bundleRoot, 'release-metadata.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Packaged deployment bundle is missing release-metadata.json: ${metadataPath}`);
  }

  return JSON.parse(readFileSync(metadataPath, 'utf8'));
}

function resolveExpectedKubernetesImageReference(releaseMetadata) {
  const normalizedImageRepository = String(releaseMetadata?.imageRepository ?? '').trim();
  const normalizedImageTag = String(releaseMetadata?.imageTag ?? '').trim();
  const normalizedImageDigest = String(releaseMetadata?.imageDigest ?? '').trim();

  if (!normalizedImageRepository) {
    throw new Error('Packaged kubernetes bundle release-metadata.json is missing imageRepository.');
  }
  if (!normalizedImageTag && !normalizedImageDigest) {
    throw new Error('Packaged kubernetes bundle release-metadata.json is missing image metadata.');
  }

  return normalizedImageDigest
    ? `${normalizedImageRepository}@${normalizedImageDigest}`
    : `${normalizedImageRepository}:${normalizedImageTag}`;
}

function requireKubernetesReleaseValues(bundleRoot) {
  const valuesPath = path.join(bundleRoot, 'values.release.yaml');
  if (!existsSync(valuesPath)) {
    throw new Error(`Packaged kubernetes bundle is missing values.release.yaml: ${valuesPath}`);
  }

  return {
    valuesPath,
    values: readFileSync(valuesPath, 'utf8'),
  };
}

export function runHelmTemplate({
  bundleRoot,
  accelerator = 'cpu',
} = {}) {
  const args = [
    'template',
    'claw-studio',
    './chart',
    '-f',
    'values.release.yaml',
    '--set',
    'auth.manageUsername=claw-admin',
    '--set',
    'auth.managePassword=claw-smoke-password',
  ];
  const overlayValuesPath = resolveKubernetesOverlayValuesPath(accelerator);

  if (overlayValuesPath) {
    args.splice(4, 0, '-f', overlayValuesPath);
  }

  return runCommand({
    command: 'helm',
    args,
    cwd: bundleRoot,
    label: 'Rendering packaged kubernetes chart smoke',
  }).stdout;
}

export function runKubectlClientDryRun({
  renderedManifest,
} = {}) {
  runCommand({
    command: 'kubectl',
    args: ['apply', '--dry-run=client', '--validate=false', '-f', '-'],
    input: renderedManifest,
    label: 'Client-side kubernetes dry-run smoke',
  });
}

export async function smokeKubernetesDeploymentBundle({
  bundleRoot,
  accelerator = 'cpu',
  capabilities = {},
  runHelmTemplateFn = runHelmTemplate,
  runKubectlClientDryRunFn = runKubectlClientDryRun,
} = {}) {
  const releaseMetadata = requireDeploymentBundleReleaseMetadata(bundleRoot);
  const { valuesPath, values: releaseValues } = requireKubernetesReleaseValues(bundleRoot);
  const normalizedAccelerator = normalizeDeploymentAccelerator(accelerator);
  const metadataFamily = String(releaseMetadata?.family ?? '').trim().toLowerCase();
  const metadataArch = normalizeDesktopArch(releaseMetadata?.arch);
  const metadataAccelerator = normalizeDeploymentAccelerator(releaseMetadata?.accelerator);
  const expectedNodeArch = resolveExpectedKubernetesNodeArch(metadataArch);
  const renderedManifest = runHelmTemplateFn({
    bundleRoot,
    accelerator,
    capabilities,
  });
  const checks = [
    {
      id: 'helm-template',
      status: 'passed',
      detail: 'helm template rendered the packaged chart successfully',
    },
  ];

  if (metadataFamily !== 'kubernetes') {
    throw new Error('Packaged kubernetes bundle release-metadata.json must declare family=kubernetes.');
  }
  if (metadataAccelerator !== normalizedAccelerator) {
    throw new Error(
      `Packaged kubernetes bundle accelerator mismatch: expected ${normalizedAccelerator}, received ${metadataAccelerator}.`,
    );
  }
  if (!new RegExp(`targetArchitecture:\\s*${metadataArch}\\b`, 'm').test(releaseValues)) {
    throw new Error(
      `Packaged kubernetes release values must pin targetArchitecture=${metadataArch} in ${valuesPath}.`,
    );
  }
  if (!new RegExp(`acceleratorProfile:\\s*${normalizedAccelerator}\\b`, 'm').test(releaseValues)) {
    throw new Error(
      `Packaged kubernetes release values must pin acceleratorProfile=${normalizedAccelerator} in ${valuesPath}.`,
    );
  }
  checks.push({
    id: 'deployment-identity',
    status: 'passed',
    detail: 'packaged kubernetes bundle preserves target architecture and accelerator identity',
  });

  const expectedImageReference = resolveExpectedKubernetesImageReference(releaseMetadata);
  if (!renderedManifest.includes(expectedImageReference)) {
    throw new Error(`Rendered kubernetes manifests must reference ${expectedImageReference}.`);
  }
  checks.push({
    id: 'image-reference',
    status: 'passed',
    detail: 'rendered manifests reference the packaged OCI image coordinates',
  });

  const hasDeploymentFamilyIdentity = (
    /CLAW_DEPLOYMENT_FAMILY:\s*"kubernetes"/m.test(renderedManifest)
    || /name:\s*CLAW_DEPLOYMENT_FAMILY\s*\n\s*value:\s*"kubernetes"/m.test(renderedManifest)
  );
  const hasAcceleratorIdentity = (
    new RegExp(`CLAW_ACCELERATOR_PROFILE:\\s*"${normalizedAccelerator}"`, 'm').test(renderedManifest)
    || new RegExp(`name:\\s*CLAW_ACCELERATOR_PROFILE\\s*\\n\\s*value:\\s*"${normalizedAccelerator}"`, 'm').test(renderedManifest)
  );
  const hasExpectedNodeArch = new RegExp(`kubernetes\\.io/arch:\\s*${expectedNodeArch}\\b`, 'm')
    .test(renderedManifest);
  if (!hasDeploymentFamilyIdentity || !hasAcceleratorIdentity || !hasExpectedNodeArch) {
    throw new Error(
      'Rendered kubernetes manifests must preserve deployment family, accelerator profile, and node architecture identity.',
    );
  }
  checks.push({
    id: 'configmap-runtime-identity',
    status: 'passed',
    detail: 'rendered config map preserves kubernetes deployment family and accelerator profile',
  });

  if (!renderedManifest.includes('/claw/health/ready')) {
    throw new Error('Rendered kubernetes manifests must probe /claw/health/ready.');
  }
  checks.push({
    id: 'readiness-probe',
    status: 'passed',
    detail: 'rendered deployment probes /claw/health/ready',
  });

  if (
    !/kind:\s+Secret\b/m.test(renderedManifest)
    || !/secretRef:\s*\n\s*name:\s*[^\s]+/m.test(renderedManifest)
  ) {
    throw new Error(
      'Rendered kubernetes manifests must define and consume Secret-backed control-plane credentials.',
    );
  }
  checks.push({
    id: 'secret-ref',
    status: 'passed',
    detail: 'rendered deployment consumes Secret-backed control-plane credentials',
  });

  if (
    !/kind:\s+PersistentVolumeClaim\b/m.test(renderedManifest)
    || !/persistentVolumeClaim:\s*\n\s*claimName:\s*[^\s]+/m.test(renderedManifest)
    || !/mountPath:\s*\/var\/lib\/claw-server\b/m.test(renderedManifest)
  ) {
    throw new Error(
      'Rendered kubernetes manifests must mount /var/lib/claw-server through a PersistentVolumeClaim.',
    );
  }
  checks.push({
    id: 'persistent-storage',
    status: 'passed',
    detail: 'rendered manifests mount /var/lib/claw-server through a PersistentVolumeClaim',
  });

  if (capabilities.kubectl) {
    runKubectlClientDryRunFn({
      bundleRoot,
      accelerator,
      capabilities,
      renderedManifest,
    });
    checks.push({
      id: 'kubectl-client-dry-run',
      status: 'passed',
      detail: 'kubectl client-side dry-run accepted the rendered manifests',
    });
  }

  return {
    launcherRelativePath: 'chart/Chart.yaml',
    checks,
  };
}

function buildSkippedReason(family, capabilities) {
  if (family === 'container') {
    return (capabilities.docker && capabilities.dockerCompose)
      ? 'container deployment smoke did not run'
      : 'docker and/or docker compose are unavailable on this host';
  }

  return capabilities.helm
    ? 'kubernetes chart smoke did not run'
    : 'helm is unavailable on this host';
}

function buildFailedSmokeCheck(error) {
  return [
    {
      id: 'smoke-error',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    },
  ];
}

export async function smokeDeploymentReleaseAssets({
  family,
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = 'linux',
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
  detectDeploymentSmokeCapabilitiesFn = detectDeploymentSmokeCapabilities,
  extractDeploymentBundleFn = extractDeploymentBundle,
  smokeContainerDeploymentBundleFn = smokeContainerDeploymentBundle,
  smokeKubernetesDeploymentBundleFn = smokeKubernetesDeploymentBundle,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  if (normalizedFamily !== 'container' && normalizedFamily !== 'kubernetes') {
    throw new Error(`Unsupported deployment smoke family: ${family}`);
  }

  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';
  const { manifestPath, manifest } = readDeploymentReleaseAssetManifest({
    releaseAssetsDir,
    family: normalizedFamily,
    platform: releasePlatform,
    arch: releaseArch,
    accelerator: normalizedAccelerator,
  });
  const artifactRelativePaths = normalizeStringArray(
    Array.isArray(manifest?.artifacts)
      ? manifest.artifacts.map((artifact) => artifact?.relativePath)
      : [],
  );
  const capabilities = detectDeploymentSmokeCapabilitiesFn({
    family: normalizedFamily,
  });

  const shouldSkip = normalizedFamily === 'container'
    ? (!capabilities.docker || !capabilities.dockerCompose)
    : !capabilities.helm;
  if (shouldSkip) {
    const report = writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'skipped',
      manifestPath,
      artifactRelativePaths,
      skippedReason: buildSkippedReason(normalizedFamily, capabilities),
      capabilities,
    });

    return {
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      accelerator: normalizedAccelerator,
      manifestPath,
      report,
    };
  }

  const archiveArtifact = resolveDeploymentArchiveArtifact(manifest, manifestPath);
  const archivePath = resolveArtifactAbsolutePath(releaseAssetsDir, archiveArtifact);
  const extractDir = mkdtempSync(path.join(
    os.tmpdir(),
    normalizedFamily === 'container'
      ? 'claw-deployment-smoke-container-'
      : 'claw-deployment-smoke-kubernetes-',
  ));

  try {
    const bundleRoot = await extractDeploymentBundleFn({
      archivePath,
      extractDir,
      family: normalizedFamily,
    });
    const smokeResult = normalizedFamily === 'container'
      ? await smokeContainerDeploymentBundleFn({
        bundleRoot,
        accelerator: normalizedAccelerator,
        capabilities,
      })
      : await smokeKubernetesDeploymentBundleFn({
        bundleRoot,
        accelerator: normalizedAccelerator,
        capabilities,
      });
    const report = writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'passed',
      manifestPath,
      artifactRelativePaths,
      launcherRelativePath: String(smokeResult?.launcherRelativePath ?? '').trim(),
      runtimeBaseUrl: String(smokeResult?.runtimeBaseUrl ?? '').trim(),
      checks: smokeResult?.checks ?? [],
      capabilities,
    });

    return {
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      accelerator: normalizedAccelerator,
      manifestPath,
      report,
    };
  } catch (error) {
    writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'failed',
      manifestPath,
      artifactRelativePaths,
      checks: buildFailedSmokeCheck(error),
      capabilities,
    });
    throw error;
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}

export function parseArgs(argv) {
  const options = {
    family: '',
    platform: 'linux',
    arch: process.arch,
    target: '',
    accelerator: 'cpu',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--family') {
      options.family = readOptionValue(argv, index, '--family');
      index += 1;
      continue;
    }
    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--accelerator') {
      options.accelerator = readOptionValue(argv, index, '--accelerator');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeDeploymentReleaseAssets(parseArgs(argv));
  console.log(
    `Recorded ${result.family} deployment smoke evidence for ${result.platform}-${result.arch}-${result.accelerator}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
