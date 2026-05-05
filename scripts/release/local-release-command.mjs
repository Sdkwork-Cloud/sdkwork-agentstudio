#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runServerBuild } from '../run-claw-server-build.mjs';
import { inspectTauriTarget } from '../ensure-tauri-target-clean.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  resolveKernelPackageProfile,
} from './kernel-package-profiles.mjs';
import { createReleasePlan } from './resolve-release-plan.mjs';
import {
  packageContainerAssets,
  packageDesktopAssets,
  packageKubernetesAssets,
  packageServerAssets,
  packageWebAssets,
  resolveExistingDesktopBundleRoot,
} from './package-release-assets.mjs';
import { finalizeReleaseAssets } from './finalize-release-assets.mjs';
import { assertReleaseReadiness } from './assert-release-readiness.mjs';
import { collectReleaseStatus } from './release-status.mjs';
import {
  buildDesktopReleaseEnv,
  buildDesktopTargetTriple,
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  smokeDesktopInstallers,
} from './smoke-desktop-installers.mjs';
import {
  smokeDesktopStartupEvidence,
} from './smoke-desktop-startup-evidence.mjs';
import {
  smokeDesktopPackagedLaunch,
} from './smoke-desktop-packaged-launch.mjs';
import {
  smokeServerReleaseAssets,
} from './smoke-server-release-assets.mjs';
import {
  smokeWebReleaseAssets,
} from './smoke-web-release-assets.mjs';
import {
  smokeDeploymentReleaseAssets,
} from './smoke-deployment-release-assets.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const desktopSrcTauriDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
);
const serverBuildTargetDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-server',
  'src-host',
  'target',
);
const webPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-web');
const webDistDir = path.join(webPackageDir, 'dist');
const docsDistDir = path.join(rootDir, 'docs', '.vitepress', 'dist');

const LOCAL_RELEASE_TAG = 'release-local';
const RELEASE_PROFILE_ENV_VAR = 'SDKWORK_RELEASE_PROFILE';
const RELEASE_PACKAGE_PROFILE_ENV_VAR = 'SDKWORK_RELEASE_PACKAGE_PROFILE';
const RELEASE_TAG_ENV_VAR = 'SDKWORK_RELEASE_TAG';
const RELEASE_GIT_REF_ENV_VAR = 'SDKWORK_RELEASE_GIT_REF';
const RELEASE_OUTPUT_DIR_ENV_VAR = 'SDKWORK_RELEASE_OUTPUT_DIR';
const RELEASE_ASSETS_DIR_ENV_VAR = 'SDKWORK_RELEASE_ASSETS_DIR';
const RELEASE_PLATFORM_ENV_VAR = 'SDKWORK_RELEASE_PLATFORM';
const RELEASE_ARCH_ENV_VAR = 'SDKWORK_RELEASE_ARCH';
const RELEASE_TARGET_ENV_VAR = 'SDKWORK_RELEASE_TARGET';
const RELEASE_ACCELERATOR_ENV_VAR = 'SDKWORK_RELEASE_ACCELERATOR';
const RELEASE_IMAGE_REPOSITORY_ENV_VAR = 'SDKWORK_RELEASE_IMAGE_REPOSITORY';
const RELEASE_IMAGE_TAG_ENV_VAR = 'SDKWORK_RELEASE_IMAGE_TAG';
const RELEASE_IMAGE_DIGEST_ENV_VAR = 'SDKWORK_RELEASE_IMAGE_DIGEST';
const RELEASE_REPOSITORY_ENV_VAR = 'SDKWORK_RELEASE_REPOSITORY';
const RELEASE_DESKTOP_STARTUP_EVIDENCE_PATH_ENV_VAR =
  'SDKWORK_RELEASE_DESKTOP_STARTUP_EVIDENCE_PATH';
const GIT_REMOTE_REPOSITORY_TIMEOUT_MS = 10000;

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

export function normalizeGitRemoteRepository(remoteUrl = '') {
  const normalizedRemoteUrl = String(remoteUrl ?? '').trim();
  if (!normalizedRemoteUrl) {
    return '';
  }

  const sshLikeMatch = normalizedRemoteUrl.match(/^[^@]+@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshLikeMatch) {
    return String(sshLikeMatch[1] ?? '').trim();
  }

  const canonicalUrl = normalizedRemoteUrl.replace(/^git\+/, '');

  try {
    const parsedUrl = new URL(canonicalUrl);
    const pathSegments = parsedUrl.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (pathSegments.length >= 2) {
      const owner = pathSegments[pathSegments.length - 2];
      const repo = pathSegments[pathSegments.length - 1].replace(/\.git$/i, '');
      if (owner && repo) {
        return `${owner}/${repo}`;
      }
    }
  } catch {
    // Ignore parse failures and fall back to an empty repository slug.
  }

  return '';
}

export function resolveGitRepositoryFromRemote({
  cwd = rootDir,
  env = process.env,
  spawnSyncImpl = spawnSync,
} = {}) {
  const result = spawnSyncImpl('git', ['config', '--get', 'remote.origin.url'], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: GIT_REMOTE_REPOSITORY_TIMEOUT_MS,
    shell: false,
  });

  if (result?.error || (result?.status ?? 1) !== 0) {
    return '';
  }

  return normalizeGitRemoteRepository(result?.stdout);
}

function resolveServerBinaryFileName(platform = '') {
  return normalizeDesktopPlatform(platform) === 'windows'
    ? 'claw-server.exe'
    : 'claw-server';
}

export function resolveLocalServerBinaryPath({
  target = '',
  platform = '',
} = {}) {
  const normalizedTarget = String(target ?? '').trim();
  const binaryFileName = resolveServerBinaryFileName(platform);

  if (normalizedTarget.length > 0) {
    return path.join(serverBuildTargetDir, normalizedTarget, 'release', binaryFileName);
  }

  return path.join(serverBuildTargetDir, 'release', binaryFileName);
}

export function ensureLocalServerBuildPrerequisite({
  context,
  fileExists = existsSync,
  resolveBinaryPath = resolveLocalServerBinaryPath,
  runServerBuildFn = runServerBuild,
} = {}) {
  const normalizedMode = String(context?.mode ?? '').trim().toLowerCase();
  if (normalizedMode !== 'package:server' && normalizedMode !== 'package:container') {
    return null;
  }

  const binaryPath = resolveBinaryPath({
    target: context?.target,
    platform: context?.platform,
  });
  runServerBuildFn({
    targetTriple: String(context?.target ?? '').trim(),
  });
  if (!(typeof binaryPath === 'string' && binaryPath.length > 0 && fileExists(binaryPath))) {
    throw new Error(
      `Server build completed without producing the canonical binary at ${binaryPath}.`,
    );
  }
  return {
    binaryPath,
    built: true,
  };
}

export function runLocalDesktopBuild({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  targetTriple = '',
  spawnSyncImpl = spawnSync,
} = {}) {
  const args = [
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    '--profile',
    String(profileId ?? '').trim() || DEFAULT_RELEASE_PROFILE_ID,
  ];
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  if (normalizedTargetTriple) {
    args.push('--target', normalizedTargetTriple);
  }

  const result = spawnSyncImpl(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result?.error) {
    throw result.error;
  }
  if (result?.signal) {
    throw new Error(`Desktop release build exited with signal ${result.signal}`);
  }
  if ((result?.status ?? 1) !== 0) {
    throw new Error(
      `Desktop release build exited with code ${result?.status ?? 'unknown'}`,
    );
  }
}

function runRequiredLocalBuildStep({
  label,
  command,
  args,
  cwd = rootDir,
  spawnSyncImpl = spawnSync,
} = {}) {
  const result = spawnSyncImpl(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result?.error) {
    throw result.error;
  }
  if (result?.signal) {
    throw new Error(`${label} exited with signal ${result.signal}`);
  }
  if ((result?.status ?? 1) !== 0) {
    throw new Error(`${label} exited with code ${result?.status ?? 'unknown'}`);
  }
}

export function runLocalWebBuild({
  spawnSyncImpl = spawnSync,
} = {}) {
  const steps = [
    {
      label: 'Shared SDK preparation',
      args: [path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs')],
      cwd: rootDir,
    },
    {
      label: 'Web release build',
      args: [
        path.join(rootDir, 'scripts', 'run-vite-host.mjs'),
        'build',
        '--mode',
        'production',
      ],
      cwd: webPackageDir,
    },
    {
      label: 'Web performance budget check',
      args: [path.join(rootDir, 'scripts', 'check-web-performance-budget.mjs')],
      cwd: rootDir,
    },
    {
      label: 'Docs release build',
      args: [path.join(rootDir, 'scripts', 'run-vitepress.mjs'), 'build', 'docs'],
      cwd: rootDir,
    },
  ];

  for (const step of steps) {
    runRequiredLocalBuildStep({
      label: step.label,
      command: process.execPath,
      args: step.args,
      cwd: step.cwd,
      spawnSyncImpl,
    });
  }
}

export function ensureLocalWebBuildPrerequisite({
  context,
  fileExists = existsSync,
  webBuildDir = webDistDir,
  docsBuildDir = docsDistDir,
  runWebBuildFn = runLocalWebBuild,
} = {}) {
  const normalizedMode = String(context?.mode ?? '').trim().toLowerCase();
  if (normalizedMode !== 'package:web') {
    return null;
  }

  runWebBuildFn();
  if (!(typeof webBuildDir === 'string' && webBuildDir.length > 0 && fileExists(webBuildDir))) {
    throw new Error(
      `Web release build completed without producing the canonical web dist directory at ${webBuildDir}.`,
    );
  }
  if (!(typeof docsBuildDir === 'string' && docsBuildDir.length > 0 && fileExists(docsBuildDir))) {
    throw new Error(
      `Web release build completed without producing the canonical docs dist directory at ${docsBuildDir}.`,
    );
  }

  return {
    webBuildDir,
    docsBuildDir,
    built: true,
  };
}

export function ensureLocalDesktopBuildPrerequisite({
  context,
  fileExists = existsSync,
  resolveDesktopBundleRoot = resolveExistingDesktopBundleRoot,
  inspectTauriTargetFn = inspectTauriTarget,
  runDesktopBuildFn = runLocalDesktopBuild,
} = {}) {
  const normalizedMode = String(context?.mode ?? '').trim().toLowerCase();
  if (normalizedMode !== 'package:desktop') {
    return null;
  }

  const inspectionEnv = String(context?.target ?? '').trim()
    ? buildDesktopReleaseEnv({
        env: process.env,
        targetTriple: String(context.target ?? '').trim(),
      })
    : process.env;
  const bundleRoot = resolveDesktopBundleRoot({
    targetTriple: String(context?.target ?? '').trim(),
    env: inspectionEnv,
  });
  const targetInspection = inspectTauriTargetFn(desktopSrcTauriDir, {
    env: inspectionEnv,
  });
  const bundleReady =
    typeof bundleRoot === 'string' && bundleRoot.length > 0 && fileExists(bundleRoot);
  const staleTarget = Boolean(targetInspection?.stale);

  if (bundleReady && !staleTarget) {
    return {
      bundleRoot,
      built: false,
      staleTarget: false,
    };
  }

  runDesktopBuildFn({
    profileId: context?.profileId,
    targetTriple: context?.target,
  });
  const rebuiltBundleRoot = resolveDesktopBundleRoot({
    targetTriple: String(context?.target ?? '').trim(),
    env: inspectionEnv,
  });
  if (!(
    typeof rebuiltBundleRoot === 'string'
    && rebuiltBundleRoot.length > 0
    && fileExists(rebuiltBundleRoot)
  )) {
    throw new Error(
      `Desktop release build completed without producing the canonical bundle root at ${rebuiltBundleRoot}.`,
    );
  }

  return {
    bundleRoot: rebuiltBundleRoot,
    built: true,
    staleTarget,
  };
}

function resolveMode(command, family) {
  const normalizedCommand = String(command ?? '').trim().toLowerCase();
  const normalizedFamily = String(family ?? '').trim().toLowerCase();

  if (!normalizedCommand) {
    throw new Error('A local release command is required: plan, status, package <family>, smoke <family>, finalize, or assert-ready.');
  }
  if (
    normalizedCommand === 'plan'
    || normalizedCommand === 'status'
    || normalizedCommand === 'finalize'
    || normalizedCommand === 'assert-ready'
  ) {
    return normalizedCommand;
  }
  if (normalizedCommand === 'package') {
    if (!normalizedFamily) {
      throw new Error('A release family is required for "package": desktop, server, container, kubernetes, or web.');
    }
    return `package:${normalizedFamily}`;
  }
  if (normalizedCommand === 'smoke') {
    if (
      normalizedFamily !== 'desktop'
      && normalizedFamily !== 'server'
      && normalizedFamily !== 'web'
      && normalizedFamily !== 'container'
      && normalizedFamily !== 'kubernetes'
    ) {
      throw new Error('A release family is required for "smoke": desktop, server, web, container, or kubernetes.');
    }
    return `smoke:${normalizedFamily}`;
  }

  return normalizedCommand;
}

export function parseArgs(argv) {
  const [command, maybeFamily, ...rest] = argv;
  const options = {
    mode: resolveMode(
      command,
      command === 'package' || command === 'smoke'
        ? maybeFamily
        : '',
    ),
    profileId: '',
    packageProfileId: '',
    releaseTag: '',
    gitRef: '',
    outputDir: '',
    releaseAssetsDir: '',
    platform: '',
    arch: '',
    target: '',
    accelerator: '',
    imageRepository: '',
    imageTag: '',
    imageDigest: '',
    repository: '',
    startupEvidencePath: '',
    allowPartialRelease: false,
  };
  const startIndex =
    command === 'package' || command === 'smoke'
      ? 2
      : 1;
  const tokens = argv.slice(startIndex);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(tokens, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--package-profile') {
      options.packageProfileId = readOptionValue(tokens, index, '--package-profile');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(tokens, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--git-ref') {
      options.gitRef = readOptionValue(tokens, index, '--git-ref');
      index += 1;
      continue;
    }

    if (token === '--output-dir') {
      options.outputDir = readOptionValue(tokens, index, '--output-dir');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = readOptionValue(tokens, index, '--release-assets-dir');
      index += 1;
      continue;
    }

    if (token === '--platform') {
      options.platform = readOptionValue(tokens, index, '--platform');
      index += 1;
      continue;
    }

    if (token === '--arch') {
      options.arch = readOptionValue(tokens, index, '--arch');
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.target = readOptionValue(tokens, index, '--target');
      index += 1;
      continue;
    }

    if (token === '--accelerator') {
      options.accelerator = readOptionValue(tokens, index, '--accelerator');
      index += 1;
      continue;
    }

    if (token === '--image-repository') {
      options.imageRepository = readOptionValue(tokens, index, '--image-repository');
      index += 1;
      continue;
    }

    if (token === '--image-tag') {
      options.imageTag = readOptionValue(tokens, index, '--image-tag');
      index += 1;
      continue;
    }

    if (token === '--image-digest') {
      options.imageDigest = readOptionValue(tokens, index, '--image-digest');
      index += 1;
      continue;
    }

    if (token === '--repository') {
      options.repository = readOptionValue(tokens, index, '--repository');
      index += 1;
      continue;
    }

    if (token === '--startup-evidence-path') {
      options.startupEvidencePath = readOptionValue(tokens, index, '--startup-evidence-path');
      index += 1;
      continue;
    }

    if (token === '--allow-partial-release') {
      options.allowPartialRelease = true;
    }
  }

  return options;
}

export function resolveLocalReleaseContext({
  mode,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  cwd = rootDir,
  cliOverrides = {},
  resolveGitRepositoryFn = resolveGitRepositoryFromRemote,
} = {}) {
  const normalizedMode = String(mode ?? '').trim().toLowerCase();
  const hostPlatform = firstNonEmpty(platform, process.platform);
  const hostArch = firstNonEmpty(arch, process.arch);
  const profileId = firstNonEmpty(
    cliOverrides.profileId,
    env?.[RELEASE_PROFILE_ENV_VAR],
    DEFAULT_RELEASE_PROFILE_ID,
  );
  const packageProfileId = resolveKernelPackageProfile(
    firstNonEmpty(
      cliOverrides.packageProfileId,
      env?.[RELEASE_PACKAGE_PROFILE_ENV_VAR],
      resolveReleaseProfile(profileId).defaultPackageProfileId,
      DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
    ),
  ).profileId;
  const releaseTag = firstNonEmpty(
    cliOverrides.releaseTag,
    env?.[RELEASE_TAG_ENV_VAR],
    LOCAL_RELEASE_TAG,
  );
  const gitRef = firstNonEmpty(
    cliOverrides.gitRef,
    env?.[RELEASE_GIT_REF_ENV_VAR],
    `refs/tags/${releaseTag}`,
  );
  const outputDir = resolveCliPath(
    firstNonEmpty(
      cliOverrides.outputDir,
      env?.[RELEASE_OUTPUT_DIR_ENV_VAR],
      path.join('artifacts', 'release'),
    ),
    cwd,
  );
  const releaseAssetsDir = resolveCliPath(
    firstNonEmpty(
      cliOverrides.releaseAssetsDir,
      env?.[RELEASE_ASSETS_DIR_ENV_VAR],
      outputDir,
    ),
    cwd,
  );
  const repository = firstNonEmpty(
    cliOverrides.repository,
    env?.[RELEASE_REPOSITORY_ENV_VAR],
    env?.GITHUB_REPOSITORY,
    resolveGitRepositoryFn({
      cwd,
      env,
    }),
  );
  const accelerator = firstNonEmpty(
    cliOverrides.accelerator,
    env?.[RELEASE_ACCELERATOR_ENV_VAR],
    'cpu',
  );
  const imageRepository = firstNonEmpty(
    cliOverrides.imageRepository,
    env?.[RELEASE_IMAGE_REPOSITORY_ENV_VAR],
    'claw-studio-server',
  );
  const imageTag = firstNonEmpty(
    cliOverrides.imageTag,
    env?.[RELEASE_IMAGE_TAG_ENV_VAR],
    releaseTag,
  );
  const imageDigest = firstNonEmpty(
    cliOverrides.imageDigest,
    env?.[RELEASE_IMAGE_DIGEST_ENV_VAR],
  );
  const startupEvidencePath = firstNonEmpty(
    cliOverrides.startupEvidencePath,
    env?.[RELEASE_DESKTOP_STARTUP_EVIDENCE_PATH_ENV_VAR],
  );
  const resolvedStartupEvidencePath = resolveCliPath(startupEvidencePath, cwd);

  if (
    normalizedMode === 'package:container'
    || normalizedMode === 'package:kubernetes'
    || normalizedMode === 'smoke:container'
    || normalizedMode === 'smoke:kubernetes'
  ) {
    const resolvedPlatform = normalizeDesktopPlatform(
      firstNonEmpty(
        cliOverrides.platform,
        env?.[RELEASE_PLATFORM_ENV_VAR],
        'linux',
      ),
    );
    if (resolvedPlatform !== 'linux') {
      throw new Error(`${normalizedMode} only supports linux deployment targets.`);
    }
    const resolvedArch = normalizeDesktopArch(
      firstNonEmpty(
        cliOverrides.arch,
        env?.[RELEASE_ARCH_ENV_VAR],
        hostArch,
      ),
    );
    const target = firstNonEmpty(
      cliOverrides.target,
      env?.[RELEASE_TARGET_ENV_VAR],
      buildDesktopTargetTriple({
        platform: resolvedPlatform,
        arch: resolvedArch,
      }),
    );

    return {
      mode: normalizedMode,
      profileId,
      packageProfileId,
      releaseTag,
      gitRef,
      outputDir,
      releaseAssetsDir,
      repository,
      platform: resolvedPlatform,
      arch: resolvedArch,
      target,
      accelerator,
      imageRepository,
      imageTag,
      imageDigest,
      startupEvidencePath: '',
    };
  }

  if (
    normalizedMode === 'package:desktop'
    || normalizedMode === 'package:server'
    || normalizedMode === 'smoke:desktop'
    || normalizedMode === 'smoke:server'
  ) {
    const targetSpec = resolveDesktopReleaseTarget({
      targetTriple: firstNonEmpty(
        cliOverrides.target,
        env?.[RELEASE_TARGET_ENV_VAR],
      ),
      platform: firstNonEmpty(
        cliOverrides.platform,
        env?.[RELEASE_PLATFORM_ENV_VAR],
        hostPlatform,
      ),
      arch: firstNonEmpty(
        cliOverrides.arch,
        env?.[RELEASE_ARCH_ENV_VAR],
        hostArch,
      ),
    });

    return {
      mode: normalizedMode,
      profileId,
      packageProfileId,
      releaseTag,
      gitRef,
      outputDir,
      releaseAssetsDir,
      repository,
      platform: targetSpec.platform,
      arch: targetSpec.arch,
      target: targetSpec.targetTriple,
      accelerator,
      imageRepository,
      imageTag,
      imageDigest,
      startupEvidencePath: resolvedStartupEvidencePath,
    };
  }

  if (normalizedMode === 'smoke:web') {
    return {
      mode: normalizedMode,
      profileId,
      packageProfileId,
      releaseTag,
      gitRef,
      outputDir,
      releaseAssetsDir,
      repository,
      platform: 'web',
      arch: 'any',
      target: '',
      accelerator,
      imageRepository,
      imageTag,
      imageDigest,
      startupEvidencePath: '',
    };
  }

  return {
    mode: normalizedMode,
    profileId,
    packageProfileId,
    releaseTag,
    gitRef,
    outputDir,
    releaseAssetsDir,
    repository,
    platform: '',
    arch: '',
    target: '',
    accelerator,
    imageRepository,
    imageTag,
    imageDigest,
    startupEvidencePath: resolvedStartupEvidencePath,
  };
}

export async function runLocalReleaseCommand(options = {}) {
  const cliOverrides = {
    ...options,
    platform: String(options.cliPlatform ?? '').trim(),
    arch: String(options.cliArch ?? '').trim(),
  };
  const context = resolveLocalReleaseContext({
    mode: options.mode,
    env: options.env,
    platform: options.hostPlatform ?? options.platform,
    arch: options.hostArch ?? options.arch,
    cwd: options.cwd,
    cliOverrides,
  });
  const packageDesktopAssetsFn = options.packageDesktopAssetsFn ?? packageDesktopAssets;
  const packageServerAssetsFn = options.packageServerAssetsFn ?? packageServerAssets;
  const packageContainerAssetsFn = options.packageContainerAssetsFn ?? packageContainerAssets;
  const packageKubernetesAssetsFn = options.packageKubernetesAssetsFn ?? packageKubernetesAssets;
  const packageWebAssetsFn = options.packageWebAssetsFn ?? packageWebAssets;
  const ensureLocalDesktopBuildPrerequisiteFn =
    options.ensureLocalDesktopBuildPrerequisiteFn ?? ensureLocalDesktopBuildPrerequisite;
  const ensureLocalWebBuildPrerequisiteFn =
    options.ensureLocalWebBuildPrerequisiteFn ?? ensureLocalWebBuildPrerequisite;
  const smokeDesktopInstallersFn = options.smokeDesktopInstallersFn ?? smokeDesktopInstallers;
  const smokeDesktopStartupEvidenceFn =
    options.smokeDesktopStartupEvidenceFn ?? smokeDesktopStartupEvidence;
  const smokeDesktopPackagedLaunchFn =
    options.smokeDesktopPackagedLaunchFn ?? smokeDesktopPackagedLaunch;
  const smokeServerReleaseAssetsFn = options.smokeServerReleaseAssetsFn ?? smokeServerReleaseAssets;
  const smokeWebReleaseAssetsFn = options.smokeWebReleaseAssetsFn ?? smokeWebReleaseAssets;
  const smokeDeploymentReleaseAssetsFn = options.smokeDeploymentReleaseAssetsFn ?? smokeDeploymentReleaseAssets;
  const createReleasePlanFn = options.createReleasePlanFn ?? createReleasePlan;
  const finalizeReleaseAssetsFn = options.finalizeReleaseAssetsFn ?? finalizeReleaseAssets;
  const assertReleaseReadinessFn = options.assertReleaseReadinessFn ?? assertReleaseReadiness;
  const collectReleaseStatusFn = options.collectReleaseStatusFn ?? collectReleaseStatus;

  if (context.mode === 'plan') {
    const plan = createReleasePlanFn({
      profileId: context.profileId,
      packageProfileId: context.packageProfileId,
      releaseTag: context.releaseTag,
      gitRef: context.gitRef,
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return context;
  }

  if (context.mode === 'package:desktop') {
    ensureLocalDesktopBuildPrerequisiteFn({
      context,
    });
    packageDesktopAssetsFn(context);
    await smokeDesktopInstallersFn(context);
    await smokeDesktopPackagedLaunchFn(context);
    return context;
  }

  if (context.mode === 'package:server') {
    ensureLocalServerBuildPrerequisite({
      context,
      fileExists: options.fileExists,
      resolveBinaryPath: options.resolveBinaryPath,
      runServerBuildFn: options.runServerBuildFn,
    });
    packageServerAssetsFn(context);
    await smokeServerReleaseAssetsFn(context);
    return context;
  }

  if (context.mode === 'package:container') {
    ensureLocalServerBuildPrerequisite({
      context,
      fileExists: options.fileExists,
      resolveBinaryPath: options.resolveBinaryPath,
      runServerBuildFn: options.runServerBuildFn,
    });
    packageContainerAssetsFn(context);
    await smokeDeploymentReleaseAssetsFn({
      ...context,
      family: 'container',
    });
    return context;
  }

  if (context.mode === 'package:kubernetes') {
    packageKubernetesAssetsFn(context);
    await smokeDeploymentReleaseAssetsFn({
      ...context,
      family: 'kubernetes',
    });
    return context;
  }

  if (context.mode === 'package:web') {
    ensureLocalWebBuildPrerequisiteFn({
      context,
      fileExists: options.fileExists,
      webBuildDir: options.webBuildDir,
      docsBuildDir: options.docsBuildDir,
      runWebBuildFn: options.runWebBuildFn,
    });
    packageWebAssetsFn(context);
    await smokeWebReleaseAssetsFn(context);
    return context;
  }

  if (context.mode === 'status') {
    const status = collectReleaseStatusFn({
      profileId: context.profileId,
      packageProfileId: context.packageProfileId,
      releaseTag: context.releaseTag,
      gitRef: context.gitRef,
      repository: context.repository,
      releaseAssetsDir: context.releaseAssetsDir,
      createReleasePlanFn,
    });
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return context;
  }

  if (context.mode === 'smoke:desktop') {
    await smokeDesktopInstallersFn(context);
    if (context.startupEvidencePath) {
      await smokeDesktopStartupEvidenceFn(context);
    } else {
      await smokeDesktopPackagedLaunchFn(context);
    }
    return context;
  }

  if (context.mode === 'smoke:server') {
    await smokeServerReleaseAssetsFn(context);
    return context;
  }

  if (context.mode === 'smoke:web') {
    await smokeWebReleaseAssetsFn(context);
    return context;
  }

  if (context.mode === 'smoke:container' || context.mode === 'smoke:kubernetes') {
    await smokeDeploymentReleaseAssetsFn({
      ...context,
      family: context.mode.slice('smoke:'.length),
    });
    return context;
  }

  if (context.mode === 'finalize') {
    finalizeReleaseAssetsFn({
      profileId: context.profileId,
      releaseTag: context.releaseTag,
      repository: context.repository,
      releaseAssetsDir: context.releaseAssetsDir,
      allowPartialRelease: Boolean(options.allowPartialRelease),
    });
    return context;
  }

  if (context.mode === 'assert-ready') {
    assertReleaseReadinessFn({
      profileId: context.profileId,
      releaseAssetsDir: context.releaseAssetsDir,
    });
    return context;
  }

  throw new Error(`Unsupported local release command: ${context.mode}`);
}

async function main() {
  const parsedOptions = parseArgs(process.argv.slice(2));
  await runLocalReleaseCommand({
    ...parsedOptions,
    hostPlatform: process.platform,
    hostArch: process.arch,
    cliPlatform: parsedOptions.platform,
    cliArch: parsedOptions.arch,
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
