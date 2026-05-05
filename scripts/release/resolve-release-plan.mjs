#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  buildContainerReleaseMatrix,
  buildDesktopReleaseMatrix,
  buildKubernetesReleaseMatrix,
  buildServerReleaseMatrix,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  listKernelPackageProfiles,
  resolveKernelPackageProfile,
} from './kernel-package-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function createReleasePlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
  releaseTag = '',
  gitRef = '',
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const defaultPackageProfileId = String(profile.defaultPackageProfileId ?? '').trim()
    || DEFAULT_KERNEL_PACKAGE_PROFILE_ID;
  const resolvedPackageProfile = resolveKernelPackageProfile(
    String(packageProfileId ?? '').trim() || defaultPackageProfileId,
  );
  const packageProfiles = listKernelPackageProfiles();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedGitRef = String(gitRef ?? '').trim()
    || (normalizedReleaseTag ? `refs/tags/${normalizedReleaseTag}` : '');

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to resolve a release plan.');
  }

  const desktopMatrix = buildDesktopReleaseMatrix(profile.id);
  const serverMatrix = buildServerReleaseMatrix(profile.id);
  const containerMatrix = buildContainerReleaseMatrix(profile.id);
  const kubernetesMatrix = buildKubernetesReleaseMatrix(profile.id);
  const targetSummary = buildReleasePlanTargetSummary({
    desktopMatrix,
    serverMatrix,
    containerMatrix,
    kubernetesMatrix,
  });

  return {
    profileId: profile.id,
    productName: profile.productName,
    defaultPackageProfileId,
    packageProfileId: resolvedPackageProfile.profileId,
    packageProfile: {
      ...resolvedPackageProfile,
    },
    packageProfiles,
    releaseTag: normalizedReleaseTag,
    gitRef: normalizedGitRef,
    releaseName: `${profile.productName} ${normalizedReleaseTag}`,
    release: {
      ...profile.release,
    },
    ...targetSummary,
    desktopMatrix,
    serverMatrix,
    containerMatrix,
    kubernetesMatrix,
  };
}

export function buildReleasePlanTargetSummary({
  desktopMatrix = [],
  serverMatrix = [],
  containerMatrix = [],
  kubernetesMatrix = [],
} = {}) {
  const familyTargetCounts = {
    web: 1,
    desktop: desktopMatrix.reduce(
      (total, entry) => total + (Array.isArray(entry?.bundles) ? entry.bundles.length : 0),
      0,
    ),
    server: serverMatrix.length,
    container: containerMatrix.length,
    kubernetes: kubernetesMatrix.length,
  };
  const requiredTargetCount = Object.values(familyTargetCounts).reduce(
    (total, count) => total + count,
    0,
  );

  return {
    familyTargetCounts,
    requiredTargetCount,
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    packageProfileId: '',
    releaseTag: '',
    gitRef: '',
    githubOutput: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--package-profile') {
      options.packageProfileId = readOptionValue(argv, index, '--package-profile');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--git-ref') {
      options.gitRef = readOptionValue(argv, index, '--git-ref');
      index += 1;
      continue;
    }

    if (token === '--github-output') {
      options.githubOutput = true;
    }
  }

  return options;
}

export function buildGitHubOutputLines(plan) {
  return [
    `profile_id=${plan.profileId}`,
    `product_name=${plan.productName}`,
    `default_package_profile_id=${plan.defaultPackageProfileId}`,
    `package_profile_id=${plan.packageProfileId}`,
    `package_profile_included_kernel_ids=${JSON.stringify(plan.packageProfile.includedKernelIds)}`,
    `package_profiles=${JSON.stringify(plan.packageProfiles)}`,
    `release_tag=${plan.releaseTag}`,
    `git_ref=${plan.gitRef}`,
    `release_name=${plan.releaseName}`,
    `manifest_file_name=${plan.release.manifestFileName}`,
    `manifest_checksum_file_name=${plan.release.manifestChecksumFileName}`,
    `attestation_evidence_file_name=${plan.release.attestationEvidenceFileName}`,
    `global_checksums_file_name=${plan.release.globalChecksumsFileName}`,
    `required_target_count=${plan.requiredTargetCount}`,
    `family_target_counts=${JSON.stringify(plan.familyTargetCounts)}`,
    `desktop_matrix=${JSON.stringify(plan.desktopMatrix)}`,
    `server_matrix=${JSON.stringify(plan.serverMatrix)}`,
    `container_matrix=${JSON.stringify(plan.containerMatrix)}`,
    `kubernetes_matrix=${JSON.stringify(plan.kubernetesMatrix)}`,
  ];
}

function writeGitHubOutput(plan) {
  const githubOutputPath = String(process.env.GITHUB_OUTPUT ?? '').trim();
  if (!githubOutputPath) {
    throw new Error('GITHUB_OUTPUT is required when --github-output is set.');
  }

  const outputLines = buildGitHubOutputLines(plan);
  fs.appendFileSync(githubOutputPath, `${outputLines.join('\n')}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = createReleasePlan(options);

  if (options.githubOutput) {
    writeGitHubOutput(plan);
    return;
  }

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
