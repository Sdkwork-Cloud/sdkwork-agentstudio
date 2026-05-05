import {
  normalizeReleaseRelativePath,
} from './release-paths.mjs';

function buildReleaseCoverageRequirement({
  id,
  family,
  platform,
  arch,
  accelerator = '',
  bundle = '',
}) {
  return {
    id,
    family,
    platform,
    arch,
    accelerator,
    bundle,
  };
}

export function buildRequiredReleaseCoverage(profile) {
  const requiredTargets = [
    buildReleaseCoverageRequirement({
      id: 'web/web/any',
      family: 'web',
      platform: 'web',
      arch: 'any',
    }),
  ];

  for (const entry of profile.desktop?.matrix ?? []) {
    for (const bundle of entry.bundles ?? []) {
      requiredTargets.push(buildReleaseCoverageRequirement({
        id: `desktop/${entry.platform}/${entry.arch}/${bundle}`,
        family: 'desktop',
        platform: entry.platform,
        arch: entry.arch,
        bundle,
      }));
    }
  }

  for (const entry of profile.server?.matrix ?? []) {
    requiredTargets.push(buildReleaseCoverageRequirement({
      id: `server/${entry.platform}/${entry.arch}`,
      family: 'server',
      platform: entry.platform,
      arch: entry.arch,
    }));
  }

  for (const entry of profile.container?.matrix ?? []) {
    requiredTargets.push(buildReleaseCoverageRequirement({
      id: `container/${entry.platform}/${entry.arch}/${entry.accelerator}`,
      family: 'container',
      platform: entry.platform,
      arch: entry.arch,
      accelerator: entry.accelerator,
    }));
  }

  for (const entry of profile.kubernetes?.matrix ?? []) {
    requiredTargets.push(buildReleaseCoverageRequirement({
      id: `kubernetes/${entry.platform}/${entry.arch}/${entry.accelerator}`,
      family: 'kubernetes',
      platform: entry.platform,
      arch: entry.arch,
      accelerator: entry.accelerator,
    }));
  }

  return requiredTargets.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildRequiredReleaseCoverageIds(profile) {
  return buildRequiredReleaseCoverage(profile).map((requirement) => requirement.id);
}

function isDesktopBundleArtifact(artifact, bundle) {
  const relativePath = normalizeReleaseRelativePath(artifact?.relativePath).toLowerCase();
  if (bundle === 'nsis') {
    return relativePath.endsWith('.exe');
  }
  if (bundle === 'msi') {
    return relativePath.endsWith('.msi');
  }
  if (bundle === 'deb') {
    return relativePath.endsWith('.deb');
  }
  if (bundle === 'rpm') {
    return relativePath.endsWith('.rpm');
  }
  if (bundle === 'appimage') {
    return relativePath.endsWith('.appimage');
  }
  if (bundle === 'app') {
    return relativePath.endsWith('.app.zip') || relativePath.endsWith('.app.tar.gz');
  }
  if (bundle === 'dmg') {
    return relativePath.endsWith('.dmg');
  }

  return false;
}

export function artifactSatisfiesCoverageRequirement(artifact, requirement) {
  const family = String(artifact?.family ?? '').trim();
  const platform = String(artifact?.platform ?? '').trim();
  const arch = String(artifact?.arch ?? '').trim();
  if (
    family !== requirement.family
    || platform !== requirement.platform
    || arch !== requirement.arch
  ) {
    return false;
  }

  if (requirement.accelerator) {
    return String(artifact?.accelerator ?? '').trim() === requirement.accelerator;
  }

  if (requirement.bundle) {
    return isDesktopBundleArtifact(artifact, requirement.bundle);
  }

  return true;
}

export function buildArtifactPresentTargets({
  profile,
  artifacts,
}) {
  return buildRequiredReleaseCoverage(profile)
    .filter((requirement) => artifacts.some((artifact) => (
      artifactSatisfiesCoverageRequirement(artifact, requirement)
    )))
    .map((requirement) => requirement.id)
    .sort((left, right) => left.localeCompare(right));
}

export function buildArtifactsOutsideReleaseProfile({
  profile,
  artifacts,
}) {
  const requiredTargets = buildRequiredReleaseCoverage(profile);

  return artifacts
    .filter((artifact) => !requiredTargets.some((requirement) => (
      artifactSatisfiesCoverageRequirement(artifact, requirement)
    )))
    .map((artifact) => normalizeReleaseRelativePath(artifact?.relativePath))
    .sort((left, right) => left.localeCompare(right));
}

export function buildDuplicateReleaseTargetEntries({
  profile,
  artifacts,
}) {
  return buildRequiredReleaseCoverage(profile)
    .map((requirement) => {
      const matchingArtifactPaths = artifacts
        .filter((artifact) => artifactSatisfiesCoverageRequirement(artifact, requirement))
        .map((artifact) => normalizeReleaseRelativePath(artifact?.relativePath))
        .sort((left, right) => left.localeCompare(right));

      return {
        target: requirement.id,
        artifactPaths: matchingArtifactPaths,
      };
    })
    .filter((entry) => entry.artifactPaths.length > 1);
}

export function buildReleaseCoverage({
  profile,
  artifacts,
  allowPartialRelease = false,
}) {
  const requiredTargets = buildRequiredReleaseCoverage(profile);
  const presentTargets = buildArtifactPresentTargets({
    profile,
    artifacts,
  });
  const missingTargets = requiredTargets
    .filter((requirement) => !presentTargets.includes(requirement.id))
    .map((requirement) => requirement.id)
    .sort((left, right) => left.localeCompare(right));

  return {
    status: missingTargets.length === 0 ? 'complete' : 'partial',
    allowPartialRelease: Boolean(allowPartialRelease),
    requiredTargets: requiredTargets
      .map((requirement) => requirement.id)
      .sort((left, right) => left.localeCompare(right)),
    presentTargets,
    missingTargets,
  };
}
