import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

const releaseProfile = Object.freeze({
  id: 'agent-studio',
  desktop: Object.freeze({
    matrix: Object.freeze([
      Object.freeze({
        platform: 'windows',
        arch: 'x64',
        bundles: Object.freeze(['nsis']),
      }),
      Object.freeze({
        platform: 'macos',
        arch: 'arm64',
        bundles: Object.freeze(['app', 'dmg']),
      }),
    ]),
  }),
  server: Object.freeze({
    matrix: Object.freeze([
      Object.freeze({
        platform: 'linux',
        arch: 'x64',
      }),
    ]),
  }),
  container: Object.freeze({
    matrix: Object.freeze([
      Object.freeze({
        platform: 'linux',
        arch: 'x64',
        accelerator: 'cpu',
      }),
    ]),
  }),
  kubernetes: Object.freeze({
    matrix: Object.freeze([
      Object.freeze({
        platform: 'linux',
        arch: 'arm64',
        accelerator: 'nvidia-cuda',
      }),
    ]),
  }),
});

test('release coverage helper builds required targets and coverage from artifact metadata', async () => {
  const coveragePath = path.join(rootDir, 'scripts', 'release', 'release-coverage.mjs');
  const coverage = await import(pathToFileURL(coveragePath).href);

  assert.deepEqual(
    coverage.buildRequiredReleaseCoverageIds(releaseProfile),
    [
      'container/linux/x64/cpu',
      'desktop/macos/arm64/app',
      'desktop/macos/arm64/dmg',
      'desktop/windows/x64/nsis',
      'kubernetes/linux/arm64/nvidia-cuda',
      'server/linux/x64',
      'web/web/any',
    ],
  );

  const artifacts = [
    {
      family: 'web',
      platform: 'web',
      arch: 'any',
      kind: 'archive',
      relativePath: 'web/agent-studio-web-assets-release-2026-04-12-01.tar.gz',
    },
    {
      family: 'desktop',
      platform: 'windows',
      arch: 'x64',
      kind: 'installer',
      relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
    },
    {
      family: 'desktop',
      platform: 'macos',
      arch: 'arm64',
      kind: 'archive',
      relativePath: 'desktop/macos/arm64/Agent Studio_0.1.0_arm64.app.zip',
    },
    {
      family: 'container',
      platform: 'linux',
      arch: 'x64',
      accelerator: 'cpu',
      kind: 'archive',
      relativePath: 'container/linux/x64/cpu/agent-studio-container-release-linux-x64-cpu.tar.gz',
    },
  ];
  const extraDesktopArtifact = {
    family: 'desktop',
    platform: 'linux',
    arch: 'x64',
    kind: 'package',
    relativePath: 'desktop/linux/x64/Claw.Studio_0.1.0_x64.rpm',
  };
  const duplicateWebArtifact = {
    family: 'web',
    platform: 'web',
    arch: 'any',
    kind: 'archive',
    relativePath: 'web/agent-studio-web-assets-release-2026-04-12-02.tar.gz',
  };

  assert.equal(
    coverage.artifactSatisfiesCoverageRequirement(
      artifacts[1],
      {
        id: 'desktop/windows/x64/nsis',
        family: 'desktop',
        platform: 'windows',
        arch: 'x64',
        accelerator: '',
        bundle: 'nsis',
      },
    ),
    true,
  );
  assert.equal(
    coverage.artifactSatisfiesCoverageRequirement(
      artifacts[1],
      {
        id: 'desktop/windows/x64/msi',
        family: 'desktop',
        platform: 'windows',
        arch: 'x64',
        accelerator: '',
        bundle: 'msi',
      },
    ),
    false,
  );

  assert.deepEqual(
    coverage.buildArtifactPresentTargets({
      profile: releaseProfile,
      artifacts,
    }),
    [
      'container/linux/x64/cpu',
      'desktop/macos/arm64/app',
      'desktop/windows/x64/nsis',
      'web/web/any',
    ],
  );

  assert.deepEqual(
    coverage.buildReleaseCoverage({
      profile: releaseProfile,
      artifacts,
      allowPartialRelease: true,
    }),
    {
      status: 'partial',
      allowPartialRelease: true,
      requiredTargets: [
        'container/linux/x64/cpu',
        'desktop/macos/arm64/app',
        'desktop/macos/arm64/dmg',
        'desktop/windows/x64/nsis',
        'kubernetes/linux/arm64/nvidia-cuda',
        'server/linux/x64',
        'web/web/any',
      ],
      presentTargets: [
        'container/linux/x64/cpu',
        'desktop/macos/arm64/app',
        'desktop/windows/x64/nsis',
        'web/web/any',
      ],
      missingTargets: [
        'desktop/macos/arm64/dmg',
        'kubernetes/linux/arm64/nvidia-cuda',
        'server/linux/x64',
      ],
    },
  );
  assert.deepEqual(
    coverage.buildArtifactsOutsideReleaseProfile({
      profile: releaseProfile,
      artifacts: [
        artifacts[0],
        extraDesktopArtifact,
      ],
    }),
    ['desktop/linux/x64/Claw.Studio_0.1.0_x64.rpm'],
  );
  assert.deepEqual(
    coverage.buildDuplicateReleaseTargetEntries({
      profile: releaseProfile,
      artifacts: [
        artifacts[0],
        duplicateWebArtifact,
      ],
    }),
    [
      {
        target: 'web/web/any',
        artifactPaths: [
          'web/agent-studio-web-assets-release-2026-04-12-01.tar.gz',
          'web/agent-studio-web-assets-release-2026-04-12-02.tar.gz',
        ],
      },
    ],
  );
});
