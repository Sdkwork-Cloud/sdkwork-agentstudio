import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectReleaseStatus,
} from './release-status.mjs';

const RELEASE_TAG = 'release-status-test';
const syntheticProfile = {
  id: 'synthetic-release-status-profile',
  productName: 'Synthetic Release Status Profile',
  defaultPackageProfileId: 'synthetic-package-profile',
  desktop: {
    matrix: [],
  },
  server: {
    matrix: [],
  },
  container: {
    matrix: [],
  },
  kubernetes: {
    matrix: [],
  },
  release: {
    partialManifestFileName: 'release-asset-manifest.json',
  },
};

function withTempReleaseAssetsDir(testFn) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-status-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    return testFn(releaseAssetsDir);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeArtifact(releaseAssetsDir, relativePath, content = 'synthetic release artifact') {
  const artifactPath = path.join(releaseAssetsDir, relativePath);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, content, 'utf8');
}

function writePartialManifest(releaseAssetsDir, relativeDir, artifacts) {
  const manifestPath = path.join(releaseAssetsDir, relativeDir, 'release-asset-manifest.json');
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      profileId: syntheticProfile.id,
      releaseTag: RELEASE_TAG,
      artifacts,
    }, null, 2)}\n`,
    'utf8',
  );
}

function collectSyntheticStatus(releaseAssetsDir) {
  return collectReleaseStatus({
    profileId: syntheticProfile.id,
    packageProfileId: syntheticProfile.defaultPackageProfileId,
    releaseTag: RELEASE_TAG,
    releaseAssetsDir,
    resolveReleaseProfileFn(profileId) {
      assert.equal(profileId, syntheticProfile.id);
      return syntheticProfile;
    },
    createReleasePlanFn({ profileId, packageProfileId, releaseTag }) {
      assert.equal(profileId, syntheticProfile.id);
      assert.equal(packageProfileId, syntheticProfile.defaultPackageProfileId);
      assert.equal(releaseTag, RELEASE_TAG);

      return {
        profileId,
        packageProfileId,
        releaseTag,
        gitRef: `refs/tags/${releaseTag}`,
        familyTargetCounts: {
          web: 1,
          desktop: 0,
          server: 0,
          container: 0,
          kubernetes: 0,
        },
        requiredTargetCount: 1,
        desktopMatrix: [],
        serverMatrix: [],
        containerMatrix: [],
        kubernetesMatrix: [],
      };
    },
  });
}

function assertNoIssueDiagnostics(status) {
  assert.equal(status.issueCount, 0);
  assert.equal(status.blockingIssueCount, 0);
  assert.equal(status.hasIssues, false);
  assert.equal(status.hasBlockingIssues, false);
  assert.deepEqual(status.issueCountsBySeverity, {});
  assert.deepEqual(status.issueCountsByCode, {});
  assert.deepEqual(status.issues, []);
}

function assertNoNextActions(status) {
  assert.deepEqual(status.nextActions, []);
}

test('release status reports complete when coverage is complete and no structural issues exist', () => withTempReleaseAssetsDir((releaseAssetsDir) => {
  const artifact = {
    family: 'web',
    platform: 'web',
    arch: 'any',
    kind: 'archive',
    relativePath: 'web/claw-studio-web.tar.gz',
  };
  writeArtifact(releaseAssetsDir, artifact.relativePath);
  writePartialManifest(releaseAssetsDir, 'web', [artifact]);

  const status = collectSyntheticStatus(releaseAssetsDir);

  assert.equal(status.status, 'complete');
  assert.equal(status.releaseCoverage.status, 'complete');
  assert.equal(status.presentTargetCount, 1);
  assert.equal(status.missingTargetCount, 0);
  assertNoIssueDiagnostics(status);
  assertNoNextActions(status);
}));

test('release status reports partial when coverage is incomplete and no structural issues exist', () => withTempReleaseAssetsDir((releaseAssetsDir) => {
  mkdirSync(releaseAssetsDir, { recursive: true });

  const status = collectSyntheticStatus(releaseAssetsDir);

  assert.equal(status.status, 'partial');
  assert.equal(status.releaseCoverage.status, 'partial');
  assert.equal(status.presentTargetCount, 0);
  assert.equal(status.missingTargetCount, 1);
  assertNoIssueDiagnostics(status);
  assert.deepEqual(status.nextCommands, [
    {
      family: 'web',
      command: 'pnpm release:package:web',
      targetIds: ['web/web/any'],
    },
  ]);
  assert.deepEqual(status.nextActions, [
    {
      kind: 'package-target',
      priority: 100,
      blocking: false,
      family: 'web',
      command: 'pnpm release:package:web',
      targetIds: ['web/web/any'],
      message: 'Package missing web release targets: web/web/any.',
      recommendedAction: 'Run pnpm release:package:web.',
    },
  ]);
}));

test('release status is invalid when complete coverage contains duplicate target artifacts', () => withTempReleaseAssetsDir((releaseAssetsDir) => {
  const artifacts = [
    {
      family: 'web',
      platform: 'web',
      arch: 'any',
      kind: 'archive',
      relativePath: 'web/claw-studio-web-a.tar.gz',
    },
    {
      family: 'web',
      platform: 'web',
      arch: 'any',
      kind: 'archive',
      relativePath: 'web/claw-studio-web-b.tar.gz',
    },
  ];
  for (const artifact of artifacts) {
    writeArtifact(releaseAssetsDir, artifact.relativePath);
  }
  writePartialManifest(releaseAssetsDir, 'web', artifacts);

  const status = collectSyntheticStatus(releaseAssetsDir);

  assert.equal(status.releaseCoverage.status, 'complete');
  assert.equal(status.presentTargetCount, 1);
  assert.equal(status.missingTargetCount, 0);
  assert.equal(status.status, 'invalid');
  assert.equal(status.issueCount, 1);
  assert.equal(status.blockingIssueCount, 1);
  assert.equal(status.hasIssues, true);
  assert.equal(status.hasBlockingIssues, true);
  assert.deepEqual(status.issueCountsBySeverity, {
    error: 1,
  });
  assert.deepEqual(status.issueCountsByCode, {
    'duplicate-release-target-artifacts': 1,
  });
  assert.deepEqual(status.duplicateTargetEntries, [
    {
      target: 'web/web/any',
      artifactPaths: [
        'web/claw-studio-web-a.tar.gz',
        'web/claw-studio-web-b.tar.gz',
      ],
    },
  ]);
  assert.deepEqual(status.issues.map((issue) => issue.code), [
    'duplicate-release-target-artifacts',
  ]);
  assert.deepEqual(
    status.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      blocking: issue.blocking,
      recommendedAction: issue.recommendedAction,
    })),
    [
      {
        code: 'duplicate-release-target-artifacts',
        severity: 'error',
        blocking: true,
        recommendedAction: 'Remove stale duplicate artifacts so each release target is satisfied by exactly one artifact, then rerun the matching release:package:* command if needed.',
      },
    ],
  );
  assert.deepEqual(status.nextActions, [
    {
      kind: 'fix-issue',
      priority: 10,
      blocking: true,
      severity: 'error',
      code: 'duplicate-release-target-artifacts',
      issueCount: 1,
      message: 'Fix duplicate-release-target-artifacts release status issue.',
      recommendedAction: 'Remove stale duplicate artifacts so each release target is satisfied by exactly one artifact, then rerun the matching release:package:* command if needed.',
    },
  ]);
}));

test('release status is invalid when complete coverage contains artifacts outside the active profile', () => withTempReleaseAssetsDir((releaseAssetsDir) => {
  const artifacts = [
    {
      family: 'web',
      platform: 'web',
      arch: 'any',
      kind: 'archive',
      relativePath: 'web/claw-studio-web.tar.gz',
    },
    {
      family: 'server',
      platform: 'linux',
      arch: 'x64',
      kind: 'archive',
      relativePath: 'server/linux/x64/claw-studio-server.tar.gz',
    },
  ];
  for (const artifact of artifacts) {
    writeArtifact(releaseAssetsDir, artifact.relativePath);
  }
  writePartialManifest(releaseAssetsDir, 'web', artifacts);

  const status = collectSyntheticStatus(releaseAssetsDir);

  assert.equal(status.releaseCoverage.status, 'complete');
  assert.equal(status.presentTargetCount, 1);
  assert.equal(status.missingTargetCount, 0);
  assert.equal(status.status, 'invalid');
  assert.equal(status.issueCount, 1);
  assert.equal(status.blockingIssueCount, 1);
  assert.equal(status.hasIssues, true);
  assert.equal(status.hasBlockingIssues, true);
  assert.deepEqual(status.issueCountsBySeverity, {
    error: 1,
  });
  assert.deepEqual(status.issueCountsByCode, {
    'artifacts-outside-release-profile': 1,
  });
  assert.deepEqual(status.outOfProfileArtifactPaths, [
    'server/linux/x64/claw-studio-server.tar.gz',
  ]);
  assert.deepEqual(status.issues.map((issue) => issue.code), [
    'artifacts-outside-release-profile',
  ]);
  assert.deepEqual(
    status.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      blocking: issue.blocking,
      recommendedAction: issue.recommendedAction,
    })),
    [
      {
        code: 'artifacts-outside-release-profile',
        severity: 'error',
        blocking: true,
        recommendedAction: 'Remove artifacts that are outside the active release profile, or switch to a profile that explicitly owns them, then rerun release:status.',
      },
    ],
  );
  assert.deepEqual(status.nextActions, [
    {
      kind: 'fix-issue',
      priority: 10,
      blocking: true,
      severity: 'error',
      code: 'artifacts-outside-release-profile',
      issueCount: 1,
      message: 'Fix artifacts-outside-release-profile release status issue.',
      recommendedAction: 'Remove artifacts that are outside the active release profile, or switch to a profile that explicitly owns them, then rerun release:status.',
    },
  ]);
}));

test('release status prioritizes blocking issue actions before missing target package actions', () => withTempReleaseAssetsDir((releaseAssetsDir) => {
  const artifact = {
    family: 'server',
    platform: 'linux',
    arch: 'x64',
    kind: 'archive',
    relativePath: 'server/linux/x64/claw-studio-server.tar.gz',
  };
  writeArtifact(releaseAssetsDir, artifact.relativePath);
  writePartialManifest(releaseAssetsDir, 'server', [artifact]);

  const status = collectSyntheticStatus(releaseAssetsDir);

  assert.equal(status.releaseCoverage.status, 'partial');
  assert.equal(status.status, 'invalid');
  assert.equal(status.issueCount, 1);
  assert.equal(status.missingTargetCount, 1);
  assert.deepEqual(status.nextCommands, [
    {
      family: 'web',
      command: 'pnpm release:package:web',
      targetIds: ['web/web/any'],
    },
  ]);
  assert.deepEqual(status.nextActions, [
    {
      kind: 'fix-issue',
      priority: 10,
      blocking: true,
      severity: 'error',
      code: 'artifacts-outside-release-profile',
      issueCount: 1,
      message: 'Fix artifacts-outside-release-profile release status issue.',
      recommendedAction: 'Remove artifacts that are outside the active release profile, or switch to a profile that explicitly owns them, then rerun release:status.',
    },
    {
      kind: 'package-target',
      priority: 100,
      blocking: false,
      family: 'web',
      command: 'pnpm release:package:web',
      targetIds: ['web/web/any'],
      message: 'Package missing web release targets: web/web/any.',
      recommendedAction: 'Run pnpm release:package:web.',
    },
  ]);
}));
