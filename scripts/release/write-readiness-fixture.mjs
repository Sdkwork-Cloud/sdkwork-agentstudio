#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  createStoredZipArchive,
  createTarGzArchive,
} from '../test-support/archive-fixtures.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  buildReleaseCoverage,
} from './release-coverage.mjs';
import {
  assertReleaseReadiness,
} from './assert-release-readiness.mjs';
import {
  createReleasePlan,
} from './resolve-release-plan.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release-readiness-fixture');
const DEFAULT_RELEASE_TAG = 'release-fixture';
const DEFAULT_REPOSITORY = 'Sdkwork-Cloud/claw-studio';
const DEFAULT_GENERATED_AT = '2026-04-12T01:02:03.000Z';
const RELEASE_READINESS_FIXTURE_DIR_NAME = 'release-readiness-fixture';

function normalizeComparablePath(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);

  return Boolean(relativePath)
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath);
}

function assertSafeReleaseReadinessFixtureDir(releaseAssetsDir) {
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const comparableReleaseAssetsDir = normalizeComparablePath(normalizedReleaseAssetsDir);
  const artifactsDir = path.join(rootDir, 'artifacts');
  const dangerousWorkspaceDirs = [
    rootDir,
    artifactsDir,
    path.join(artifactsDir, 'release'),
    path.join(rootDir, 'release-assets'),
  ].map(normalizeComparablePath);

  if (dangerousWorkspaceDirs.includes(comparableReleaseAssetsDir)) {
    throw new Error(
      `Refusing to clean unsafe release readiness fixture directory: ${normalizedReleaseAssetsDir}`,
    );
  }

  const workspaceRelativePath = path.relative(rootDir, normalizedReleaseAssetsDir);
  const isInsideWorkspace = workspaceRelativePath
    && !workspaceRelativePath.startsWith('..')
    && !path.isAbsolute(workspaceRelativePath);
  const defaultFixtureDir = path.resolve(DEFAULT_RELEASE_ASSETS_DIR);
  if (
    isInsideWorkspace
    && normalizeComparablePath(defaultFixtureDir) !== comparableReleaseAssetsDir
    && !isPathInside(defaultFixtureDir, normalizedReleaseAssetsDir)
    && path.basename(normalizedReleaseAssetsDir) !== RELEASE_READINESS_FIXTURE_DIR_NAME
  ) {
    throw new Error(
      `Refusing to use workspace directory that is not an explicit release readiness fixture directory: ${normalizedReleaseAssetsDir}`,
    );
  }

  const systemTemporaryDir = path.resolve(tmpdir());
  if (
    !isInsideWorkspace
    && !isPathInside(systemTemporaryDir, normalizedReleaseAssetsDir)
  ) {
    throw new Error(
      `Refusing to use release readiness fixture directory outside the workspace or system temporary directory: ${normalizedReleaseAssetsDir}`,
    );
  }
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function fileSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeJsonFile(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeBinaryFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function buildFileMetadata(filePath, prefix) {
  return {
    [`${prefix}Sha256`]: fileSha256(filePath),
    [`${prefix}Size`]: statSync(filePath).size,
  };
}

function buildCommonSmokeEvidenceMetadata({
  manifestPath,
  reportPath,
}) {
  return {
    reportSha256: fileSha256(reportPath),
    reportSize: statSync(reportPath).size,
    manifestSha256: fileSha256(manifestPath),
    manifestSize: statSync(manifestPath).size,
  };
}

function buildAttestationSignerWorkflowIdentity({
  repository,
  signerWorkflow,
}) {
  return `${repository}/${signerWorkflow}`;
}

function buildAttestationEvidence({
  repository,
  releaseTag,
  predicateType,
  signerWorkflow,
  subjects,
}) {
  const sourceRef = `refs/tags/${releaseTag}`;
  const signerWorkflowIdentity = buildAttestationSignerWorkflowIdentity({
    repository,
    signerWorkflow,
  });

  return {
    schemaVersion: 1,
    repository,
    releaseTag,
    sourceRef,
    generatedAt: DEFAULT_GENERATED_AT,
    predicateType,
    signerWorkflow,
    signerWorkflowIdentity,
    artifacts: subjects.map((subject) => ({
      kind: subject.attestationKind,
      relativePath: subject.relativePath,
      sha256: subject.sha256,
      repository,
      releaseTag,
      sourceRef,
      predicateType,
      signerWorkflow,
      signerWorkflowIdentity,
      verified: true,
      verificationCommand: `gh attestation verify ${subject.relativePath} -R ${repository} --source-ref ${sourceRef} --predicate-type ${predicateType} --signer-workflow ${signerWorkflowIdentity} --format json`,
      verifiedAt: DEFAULT_GENERATED_AT,
    })),
  };
}

function createWebArchive({
  bundleRoot,
}) {
  return createTarGzArchive([
    {
      name: `${bundleRoot}/web/dist/index.html`,
      content: '<html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>\n',
    },
    {
      name: `${bundleRoot}/web/dist/assets/index.js`,
      content: 'console.log("claw studio release fixture");\n',
    },
    {
      name: `${bundleRoot}/docs/dist/index.html`,
      content: '<html><body>Docs</body></html>\n',
    },
    {
      name: `${bundleRoot}/docs/dist/404.html`,
      content: '<html><body>Not found</body></html>\n',
    },
    {
      name: `${bundleRoot}/docs/dist/search-index.json`,
      content: `${JSON.stringify([
        {
          title: 'Getting started',
          url: '/guide/getting-started.html',
        },
      ])}\n`,
    },
  ]);
}

function createServerArchive({
  archiveFormat,
  launcherName,
}) {
  if (archiveFormat === 'zip') {
    return createStoredZipArchive([
      {
        name: `${launcherName}`,
        content: 'server executable\n',
      },
      {
        name: 'web/index.html',
        content: '<html><body>Claw server</body></html>\n',
      },
    ]);
  }

  return createTarGzArchive([
    {
      name: launcherName,
      content: 'server executable\n',
    },
    {
      name: 'web/index.html',
      content: '<html><body>Claw server</body></html>\n',
    },
  ]);
}

function createDeploymentArchive({
  family,
  launcherPath,
}) {
  return createTarGzArchive([
    {
      name: launcherPath,
      content: family === 'container'
        ? 'services:\n  claw-server:\n    image: claw-studio-server:fixture\n'
        : 'apiVersion: v2\nname: claw-studio\nversion: 0.1.0\n',
    },
    {
      name: 'release-metadata.json',
      content: `${JSON.stringify({
        family,
        fixture: true,
      })}\n`,
    },
  ]);
}

function buildWebChecks() {
  return [
    ['artifact-checksum', 'archive checksum matches manifest and sidecar metadata'],
    ['web-index', 'web/dist/index.html is present in the archive'],
    ['web-assets', 'web/dist/assets contains browser assets'],
    ['docs-index', 'docs/dist/index.html is present in the archive'],
    ['docs-404', 'docs/dist/404.html is present in the archive'],
    ['docs-search-index', 'docs/dist/search-index.json is present and parseable'],
    ['public-doc-boundary', 'docs/dist excludes internal-only documentation directories'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function buildServerChecks() {
  return [
    ['health-ready', '/claw/health/ready responded from the packaged server'],
    ['host-endpoints', '/claw/manage/v1/host-endpoints responded from the packaged server'],
    ['browser-shell', 'bundled browser shell responded from the packaged server'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function buildContainerChecks() {
  return [
    ['deployment-identity', 'packaged deployment identity matches the release target'],
    ['runtime-profile', 'packaged runtime profile preserves production-safe defaults'],
    ['manage-credentials', 'packaged compose layout requires explicit manage credentials'],
    ['persistent-storage', 'packaged compose layout persists /var/lib/claw-server'],
    ['docker-compose-up', 'docker compose accepted the packaged layout'],
    ['docker-compose-healthy', 'docker reported packaged services healthy'],
    ['health-ready', '/claw/health/ready responded from the packaged deployment'],
    ['host-endpoints', '/claw/manage/v1/host-endpoints responded from the packaged deployment'],
    ['browser-shell', 'bundled browser shell responded from the packaged deployment'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function buildKubernetesChecks() {
  return [
    ['helm-template', 'helm template rendered the packaged chart'],
    ['deployment-identity', 'rendered deployment identity matches the release target'],
    ['image-reference', 'rendered workload uses immutable release image metadata'],
    ['configmap-runtime-identity', 'rendered ConfigMap preserves runtime identity'],
    ['readiness-probe', 'rendered workload exposes readiness probe'],
    ['secret-ref', 'rendered workload wires manage credentials through Secret refs'],
    ['persistent-storage', 'rendered workload requests /var/lib/claw-server persistence'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function buildDesktopStartupChecks() {
  return [
    ['startup-status', 'startup evidence status is passed'],
    ['startup-phase', 'startup evidence reached shell-mounted'],
    ['runtime-readiness', 'runtime readiness evidence is ready'],
    ['built-in-instance', 'built-in OpenClaw instance is online'],
    ['gateway-websocket', 'gateway websocket probe is dialable'],
    ['local-ai-proxy-runtime', 'local AI proxy runtime metadata is present'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function buildDesktopInstallerChecks() {
  return [
    ['artifact-inventory', 'installable artifact inventory matches the release manifest'],
    ['install-plan', 'dry-run install plan was generated for every installable artifact'],
  ].map(([id, detail]) => ({
    id,
    status: 'passed',
    detail,
  }));
}

function writeSmokeEvidence({
  releaseAssetsDir,
  manifestRelativePath,
  reportRelativePath,
  manifestContent = {},
  report,
}) {
  const manifestPath = path.join(releaseAssetsDir, manifestRelativePath);
  const reportPath = path.join(releaseAssetsDir, reportRelativePath);
  writeJsonFile(manifestPath, manifestContent);
  writeJsonFile(reportPath, report);

  return {
    manifestPath,
    reportPath,
    metadataBase: {
      reportRelativePath,
      manifestRelativePath,
      ...buildCommonSmokeEvidenceMetadata({
        manifestPath,
        reportPath,
      }),
      verifiedAt: report.verifiedAt,
      target: report.target,
      smokeKind: report.smokeKind,
      status: report.status,
      artifactRelativePaths: report.artifactRelativePaths,
      checks: report.checks,
    },
  };
}

function buildDesktopArtifactName({
  platform,
  arch,
  bundle,
}) {
  const base = `Claw.Studio_0.1.0_${arch}`;
  if (bundle === 'nsis') {
    return `${base}-setup.exe`;
  }
  if (bundle === 'msi') {
    return `${base}.msi`;
  }
  if (bundle === 'deb') {
    return `${base}.deb`;
  }
  if (bundle === 'rpm') {
    return `${base}.rpm`;
  }
  if (bundle === 'appimage') {
    return `${base}.AppImage`;
  }
  if (bundle === 'app') {
    return `${base}.app.tar.gz`;
  }
  if (bundle === 'dmg') {
    return `${base}.dmg`;
  }

  return `${base}-${platform}-${bundle}.bin`;
}

function buildDesktopArtifactContent({
  platform,
  arch,
  bundle,
}) {
  if (bundle === 'app') {
    return createTarGzArchive([
      {
        name: 'Claw Studio.app/Contents/MacOS/claw-studio',
        content: `desktop ${platform} ${arch} app\n`,
      },
      {
        name: 'Claw Studio.app/Contents/Info.plist',
        content: '<plist><dict></dict></plist>\n',
      },
    ]);
  }

  return Buffer.from(`desktop ${platform} ${arch} ${bundle} installer\n`, 'utf8');
}

function buildDesktopInstallPlanFormat(bundle) {
  if (bundle === 'app') {
    return 'app';
  }
  if (bundle === 'dmg') {
    return 'dmg';
  }
  return bundle;
}

function writeDesktopArtifacts({
  releaseAssetsDir,
  profile,
}) {
  const artifacts = [];
  const groupedArtifacts = new Map();

  for (const entry of profile.desktop?.matrix ?? []) {
    for (const bundle of entry.bundles ?? []) {
      const fileName = buildDesktopArtifactName({
        platform: entry.platform,
        arch: entry.arch,
        bundle,
      });
      const relativePath = `desktop/${entry.platform}/${entry.arch}/${fileName}`;
      const absolutePath = path.join(releaseAssetsDir, relativePath);
      writeBinaryFile(
        absolutePath,
        buildDesktopArtifactContent({
          platform: entry.platform,
          arch: entry.arch,
          bundle,
        }),
      );

      const key = `${entry.platform}/${entry.arch}`;
      const group = groupedArtifacts.get(key) ?? {
        entry,
        artifactRelativePaths: [],
        artifacts: [],
      };
      group.artifactRelativePaths.push(relativePath);
      group.artifacts.push({
        family: 'desktop',
        platform: entry.platform,
        arch: entry.arch,
        kind: bundle === 'app' ? 'archive' : 'installer',
        relativePath,
        sha256: fileSha256(absolutePath),
        size: statSync(absolutePath).size,
        bundle,
      });
      groupedArtifacts.set(key, group);
    }
  }

  for (const group of groupedArtifacts.values()) {
    const { entry, artifactRelativePaths } = group;
    const baseRelativeDir = `desktop/${entry.platform}/${entry.arch}`;
    const smokeManifestRelativePath = `${baseRelativeDir}/release-asset-manifest.json`;
    const installerSmokeReportRelativePath = `${baseRelativeDir}/installer-smoke-report.json`;
    const startupSmokeReportRelativePath = `${baseRelativeDir}/desktop-startup-smoke-report.json`;
    const capturedEvidenceRelativePath = `${baseRelativeDir}/diagnostics/desktop-startup-evidence.json`;
    const installPlanSummaries = group.artifacts.map((artifact) => ({
      relativePath: artifact.relativePath,
      format: buildDesktopInstallPlanFormat(artifact.bundle),
      platform: entry.platform,
      stepCount: 3,
    }));
    const installerChecks = buildDesktopInstallerChecks();
    const installerReport = {
      platform: entry.platform,
      arch: entry.arch,
      target: entry.target,
      verifiedAt: DEFAULT_GENERATED_AT,
      manifestPath: path.join(releaseAssetsDir, smokeManifestRelativePath),
      installableArtifactRelativePaths: artifactRelativePaths,
      requiredCompanionArtifactRelativePaths: [],
      installPlanSummaries,
      checks: installerChecks,
    };
    const startupChecks = buildDesktopStartupChecks();
    const packageProfileId = 'openclaw-only';
    const localAiProxyRuntime = {
      lifecycle: 'running',
      messageCaptureEnabled: true,
      observabilityDbPath: `/fixture/${entry.platform}/${entry.arch}/local-ai-proxy-observability.sqlite3`,
      snapshotPath: `/fixture/${entry.platform}/${entry.arch}/local-ai-proxy.snapshot.json`,
      logPath: `/fixture/${entry.platform}/${entry.arch}/local-ai-proxy.log`,
    };
    const startupReport = {
      platform: entry.platform,
      arch: entry.arch,
      target: entry.target,
      status: 'passed',
      phase: 'shell-mounted',
      verifiedAt: DEFAULT_GENERATED_AT,
      manifestPath: path.join(releaseAssetsDir, smokeManifestRelativePath),
      capturedEvidenceRelativePath,
      packageProfileId,
      includedKernelIds: ['openclaw'],
      defaultEnabledKernelIds: ['openclaw'],
      descriptorBrowserBaseUrl: 'http://127.0.0.1:19797',
      builtInInstanceId: 'managed-openclaw-primary',
      builtInInstanceStatus: 'online',
      localAiProxyRuntime,
      artifactRelativePaths,
      checks: startupChecks,
    };
    const capturedEvidencePath = path.join(releaseAssetsDir, capturedEvidenceRelativePath);
    writeJsonFile(capturedEvidencePath, {
      version: 2,
      status: 'passed',
      phase: 'shell-mounted',
      recordedAt: DEFAULT_GENERATED_AT,
      readinessEvidence: {
        ready: true,
        gatewayWebsocketDialable: true,
      },
    });
    const installerEvidence = writeSmokeEvidence({
      releaseAssetsDir,
      manifestRelativePath: smokeManifestRelativePath,
      reportRelativePath: installerSmokeReportRelativePath,
      manifestContent: {
        profileId: profile.id,
        platform: entry.platform,
        arch: entry.arch,
        artifacts: group.artifacts.map(({ bundle, ...artifact }) => artifact),
      },
      report: installerReport,
    });
    const startupReportPath = path.join(releaseAssetsDir, startupSmokeReportRelativePath);
    writeJsonFile(startupReportPath, startupReport);
    const desktopInstallerSmoke = {
      ...installerEvidence.metadataBase,
      installableArtifactRelativePaths: installerReport.installableArtifactRelativePaths,
      requiredCompanionArtifactRelativePaths: installerReport.requiredCompanionArtifactRelativePaths,
      installPlanSummaries: installerReport.installPlanSummaries,
    };
    const desktopStartupSmoke = {
      reportRelativePath: startupSmokeReportRelativePath,
      manifestRelativePath: smokeManifestRelativePath,
      capturedEvidenceRelativePath,
      ...buildCommonSmokeEvidenceMetadata({
        manifestPath: installerEvidence.manifestPath,
        reportPath: startupReportPath,
      }),
      ...buildFileMetadata(capturedEvidencePath, 'capturedEvidence'),
      verifiedAt: startupReport.verifiedAt,
      target: startupReport.target,
      status: startupReport.status,
      phase: startupReport.phase,
      packageProfileId,
      includedKernelIds: startupReport.includedKernelIds,
      defaultEnabledKernelIds: startupReport.defaultEnabledKernelIds,
      descriptorBrowserBaseUrl: startupReport.descriptorBrowserBaseUrl,
      builtInInstanceId: startupReport.builtInInstanceId,
      builtInInstanceStatus: startupReport.builtInInstanceStatus,
      localAiProxyRuntime,
      artifactRelativePaths,
      checks: startupReport.checks,
    };

    for (const artifact of group.artifacts) {
      const { bundle, ...artifactWithoutBundle } = artifact;
      artifacts.push({
        ...artifactWithoutBundle,
        desktopInstallerSmoke,
        desktopStartupSmoke,
      });
    }
  }

  return artifacts;
}

function writeWebArtifact({
  releaseAssetsDir,
  profile,
  releaseTag,
}) {
  const bundleRoot = `claw-studio-web-assets-${releaseTag}`;
  const relativePath = `web/${bundleRoot}.tar.gz`;
  const absolutePath = path.join(releaseAssetsDir, relativePath);
  writeBinaryFile(
    absolutePath,
    createWebArchive({ bundleRoot }),
  );
  const artifact = {
    family: 'web',
    platform: 'web',
    arch: 'any',
    kind: 'archive',
    relativePath,
    sha256: fileSha256(absolutePath),
    size: statSync(absolutePath).size,
  };
  const smokeManifestRelativePath = 'web/release-asset-manifest.json';
  const smokeReportRelativePath = 'web/release-smoke-report.json';
  const checks = buildWebChecks();
  const report = {
    family: 'web',
    platform: 'web',
    arch: 'any',
    target: '',
    smokeKind: 'web-archive-content',
    status: 'passed',
    verifiedAt: DEFAULT_GENERATED_AT,
    manifestPath: path.join(releaseAssetsDir, smokeManifestRelativePath),
    artifactRelativePaths: [relativePath],
    launcherRelativePath: '',
    runtimeBaseUrl: '',
    checks,
  };
  const evidence = writeSmokeEvidence({
    releaseAssetsDir,
    manifestRelativePath: smokeManifestRelativePath,
    reportRelativePath: smokeReportRelativePath,
    manifestContent: {
      profileId: profile.id,
      platform: 'web',
      arch: 'any',
      artifacts: [artifact],
    },
    report,
  });

  return {
    ...artifact,
    webArchiveSmoke: evidence.metadataBase,
  };
}

function writeServerArtifacts({
  releaseAssetsDir,
  profile,
  releaseTag,
}) {
  return (profile.server?.matrix ?? []).map((entry) => {
    const archiveFormat = entry.archiveFormat ?? (entry.platform === 'windows' ? 'zip' : 'tar.gz');
    const extension = archiveFormat === 'zip' ? 'zip' : 'tar.gz';
    const baseName = `claw-studio-server-${releaseTag}-${entry.platform}-${entry.arch}`;
    const relativePath = `server/${entry.platform}/${entry.arch}/${baseName}.${extension}`;
    const launcherFileName = entry.platform === 'windows' ? 'claw-server.exe' : 'claw-server';
    const launcherRelativePath = `server/${entry.platform}/${entry.arch}/${baseName}/${launcherFileName}`;
    const absolutePath = path.join(releaseAssetsDir, relativePath);
    writeBinaryFile(
      absolutePath,
      createServerArchive({
        archiveFormat,
        launcherName: launcherFileName,
      }),
    );
    const artifact = {
      family: 'server',
      platform: entry.platform,
      arch: entry.arch,
      kind: 'archive',
      relativePath,
      sha256: fileSha256(absolutePath),
      size: statSync(absolutePath).size,
    };
    const smokeManifestRelativePath = `server/${entry.platform}/${entry.arch}/release-asset-manifest.json`;
    const smokeReportRelativePath = `server/${entry.platform}/${entry.arch}/release-smoke-report.json`;
    const checks = buildServerChecks();
    const report = {
      family: 'server',
      platform: entry.platform,
      arch: entry.arch,
      target: entry.target,
      smokeKind: 'bundle-runtime',
      status: 'passed',
      verifiedAt: DEFAULT_GENERATED_AT,
      manifestPath: path.join(releaseAssetsDir, smokeManifestRelativePath),
      artifactRelativePaths: [relativePath],
      launcherRelativePath,
      runtimeBaseUrl: 'http://127.0.0.1:18080',
      checks,
    };
    const evidence = writeSmokeEvidence({
      releaseAssetsDir,
      manifestRelativePath: smokeManifestRelativePath,
      reportRelativePath: smokeReportRelativePath,
      manifestContent: {
        profileId: profile.id,
        platform: entry.platform,
        arch: entry.arch,
        artifacts: [artifact],
      },
      report,
    });

    return {
      ...artifact,
      serverBundleSmoke: {
        ...evidence.metadataBase,
        launcherRelativePath,
        runtimeBaseUrl: report.runtimeBaseUrl,
      },
    };
  });
}

function writeDeploymentArtifacts({
  releaseAssetsDir,
  profile,
  releaseTag,
  family,
}) {
  return (profile[family]?.matrix ?? []).map((entry) => {
    const baseName = `claw-studio-${family}-bundle-${releaseTag}-${entry.platform}-${entry.arch}-${entry.accelerator}`;
    const relativePath = `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/${baseName}.tar.gz`;
    const launcherRelativePath = family === 'container'
      ? `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/${baseName}/docker-compose.yml`
      : `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/${baseName}/Chart.yaml`;
    const archiveLauncherPath = family === 'container' ? 'docker-compose.yml' : 'Chart.yaml';
    const absolutePath = path.join(releaseAssetsDir, relativePath);
    writeBinaryFile(
      absolutePath,
      createDeploymentArchive({
        family,
        launcherPath: archiveLauncherPath,
      }),
    );
    const artifact = {
      family,
      platform: entry.platform,
      arch: entry.arch,
      accelerator: entry.accelerator,
      kind: 'archive',
      relativePath,
      sha256: fileSha256(absolutePath),
      size: statSync(absolutePath).size,
    };
    const smokeManifestRelativePath = `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/release-asset-manifest.json`;
    const smokeReportRelativePath = `${family}/${entry.platform}/${entry.arch}/${entry.accelerator}/release-smoke-report.json`;
    const checks = family === 'container' ? buildContainerChecks() : buildKubernetesChecks();
    const report = {
      family,
      platform: entry.platform,
      arch: entry.arch,
      accelerator: entry.accelerator,
      target: entry.target,
      smokeKind: family === 'container' ? 'live-deployment' : 'chart-render',
      status: 'passed',
      verifiedAt: DEFAULT_GENERATED_AT,
      manifestPath: path.join(releaseAssetsDir, smokeManifestRelativePath),
      artifactRelativePaths: [relativePath],
      launcherRelativePath,
      runtimeBaseUrl: family === 'container' ? 'http://127.0.0.1:18080' : '',
      checks,
    };
    const evidence = writeSmokeEvidence({
      releaseAssetsDir,
      manifestRelativePath: smokeManifestRelativePath,
      reportRelativePath: smokeReportRelativePath,
      manifestContent: {
        profileId: profile.id,
        platform: entry.platform,
        arch: entry.arch,
        accelerator: entry.accelerator,
        artifacts: [artifact],
      },
      report,
    });

    return {
      ...artifact,
      deploymentSmoke: {
        ...evidence.metadataBase,
        launcherRelativePath,
        runtimeBaseUrl: report.runtimeBaseUrl,
      },
    };
  });
}

function writeReleaseNotes({
  releaseAssetsDir,
  releaseTag,
}) {
  const relativePath = 'release-notes.md';
  const absolutePath = path.join(releaseAssetsDir, relativePath);
  writeFileSync(
    absolutePath,
    [
      '# Claw Studio Release Fixture',
      '',
      `Synthetic finalized release fixture for ${releaseTag}.`,
      '',
    ].join('\n'),
    'utf8',
  );

  return {
    kind: 'release-notes',
    purpose: 'github-release-body',
    relativePath,
    sha256: fileSha256(absolutePath),
    size: statSync(absolutePath).size,
    required: true,
  };
}

function writeManifestChecksumSidecar({
  releaseAssetsDir,
  manifestFileName,
  manifestChecksumFileName,
}) {
  const manifestPath = path.join(releaseAssetsDir, manifestFileName);
  writeFileSync(
    path.join(releaseAssetsDir, manifestChecksumFileName),
    `${fileSha256(manifestPath)}  ${manifestFileName}\n`,
    'utf8',
  );
}

export function writeReleaseReadinessFixture({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = DEFAULT_RELEASE_TAG,
  repository = DEFAULT_REPOSITORY,
  clean = true,
  resolveReleaseProfileFn = resolveReleaseProfile,
  createReleasePlanFn = createReleasePlan,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const normalizedReleaseTag = String(releaseTag ?? '').trim() || DEFAULT_RELEASE_TAG;
  const normalizedRepository = String(repository ?? '').trim() || DEFAULT_REPOSITORY;

  assertSafeReleaseReadinessFixtureDir(normalizedReleaseAssetsDir);

  if (clean) {
    rmSync(normalizedReleaseAssetsDir, { recursive: true, force: true });
  }
  mkdirSync(normalizedReleaseAssetsDir, { recursive: true });

  const artifacts = [
    writeWebArtifact({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      profile,
      releaseTag: normalizedReleaseTag,
    }),
    ...writeDesktopArtifacts({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      profile,
    }),
    ...writeServerArtifacts({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      profile,
      releaseTag: normalizedReleaseTag,
    }),
    ...writeDeploymentArtifacts({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      profile,
      releaseTag: normalizedReleaseTag,
      family: 'container',
    }),
    ...writeDeploymentArtifacts({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      profile,
      releaseTag: normalizedReleaseTag,
      family: 'kubernetes',
    }),
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const releaseMetadata = [
    writeReleaseNotes({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      releaseTag: normalizedReleaseTag,
    }),
  ];
  const releaseCoverage = buildReleaseCoverage({
    profile,
    artifacts,
    allowPartialRelease: false,
  });
  if (releaseCoverage.status !== 'complete') {
    throw new Error(
      `Readiness fixture generation failed to cover release profile ${profile.id}: missing ${releaseCoverage.missingTargets.join(', ')}`,
    );
  }
  const releasePlan = createReleasePlanFn({
    profileId: profile.id,
    packageProfileId: profile.defaultPackageProfileId,
    releaseTag: normalizedReleaseTag,
  });
  const releasePlanTargetCount = releasePlan.requiredTargetCount;
  if (!Number.isInteger(releasePlanTargetCount)) {
    throw new Error(
      `Release plan for ${profile.id} did not expose requiredTargetCount.`,
    );
  }
  if (releasePlanTargetCount !== releaseCoverage.requiredTargets.length) {
    throw new Error(
      `Readiness fixture release target count drifted from release plan for ${profile.id}: fixture=${releaseCoverage.requiredTargets.length} plan=${releasePlanTargetCount}`,
    );
  }

  const checksumFileName = profile.release.globalChecksumsFileName;
  writeFileSync(
    path.join(normalizedReleaseAssetsDir, checksumFileName),
    [
      ...artifacts.map((artifact) => `${artifact.sha256}  ${artifact.relativePath}`),
      ...releaseMetadata.map((metadata) => `${metadata.sha256}  ${metadata.relativePath}`),
    ].join('\n') + '\n',
    'utf8',
  );

  const manifest = {
    profileId: profile.id,
    productName: profile.productName ?? 'Claw Studio',
    releaseTag: normalizedReleaseTag,
    repository: normalizedRepository,
    generatedAt: DEFAULT_GENERATED_AT,
    checksumFileName,
    releaseCoverage,
    releaseMetadata,
    artifacts,
  };
  writeJsonFile(
    path.join(normalizedReleaseAssetsDir, profile.release.manifestFileName),
    manifest,
  );
  writeManifestChecksumSidecar({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestFileName: profile.release.manifestFileName,
    manifestChecksumFileName: profile.release.manifestChecksumFileName,
  });
  writeJsonFile(
    path.join(normalizedReleaseAssetsDir, profile.release.attestationEvidenceFileName),
    buildAttestationEvidence({
      repository: normalizedRepository,
      releaseTag: normalizedReleaseTag,
      predicateType: profile.release.attestationPredicateType,
      signerWorkflow: profile.release.attestationSignerWorkflowPath,
      subjects: [
        ...artifacts.map((artifact) => ({
          attestationKind: 'artifact',
          relativePath: artifact.relativePath,
          sha256: artifact.sha256,
        })),
        ...releaseMetadata.map((metadata) => ({
          attestationKind: 'release-metadata',
          relativePath: metadata.relativePath,
          sha256: metadata.sha256,
        })),
      ],
    }),
  );

  return {
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestPath: path.join(normalizedReleaseAssetsDir, profile.release.manifestFileName),
    artifactCount: artifacts.length,
    releaseMetadataCount: releaseMetadata.length,
    requiredTargetCount: releaseCoverage.requiredTargets.length,
    releasePlanTargetCount,
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: DEFAULT_RELEASE_TAG,
    repository: DEFAULT_REPOSITORY,
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
    assertReady: true,
    clean: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }
    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }
    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
        rootDir,
      );
      index += 1;
      continue;
    }
    if (token === '--no-assert-ready') {
      options.assertReady = false;
      continue;
    }
    if (token === '--no-clean') {
      options.clean = false;
      continue;
    }
    if (token === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unsupported readiness fixture option: ${token}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write([
    'Usage: node scripts/release/write-readiness-fixture.mjs [options]',
    '',
    'Generate a complete synthetic finalized release assets directory and verify it with release:assert-ready.',
    '',
    'Options:',
    '  --profile <id>              Release profile id (default: claw-studio)',
    '  --release-tag <tag>         Synthetic release tag (default: release-fixture)',
    '  --repository <owner/repo>   Repository slug for attestation evidence',
    '  --release-assets-dir <dir>  Output directory (default: artifacts/release-readiness-fixture)',
    '  --no-assert-ready           Generate files without running the readiness assertion',
    '  --no-clean                  Do not remove the output directory before writing',
    '  --help                      Show this help message',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = writeReleaseReadinessFixture(options);
  let readinessResult = null;
  if (options.assertReady) {
    readinessResult = assertReleaseReadiness({
      profileId: options.profileId,
      releaseAssetsDir: result.releaseAssetsDir,
    });
  }

  process.stdout.write([
    'Release readiness fixture generated.',
    `releaseAssetsDir=${result.releaseAssetsDir}`,
    `manifest=${result.manifestPath}`,
    `artifactCount=${result.artifactCount}`,
    `releaseMetadataCount=${result.releaseMetadataCount}`,
    `requiredTargetCount=${result.requiredTargetCount}`,
    `releasePlanTargetCount=${result.releasePlanTargetCount}`,
    readinessResult ? 'Release readiness assertion passed.' : 'Release readiness assertion skipped.',
    '',
  ].join('\n'));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
