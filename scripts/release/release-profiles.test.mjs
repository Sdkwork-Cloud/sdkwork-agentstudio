import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('release profiles expose a reusable claw-studio release matrix with standard desktop bundle coverage', async () => {
  const profilePath = path.join(rootDir, 'scripts', 'release', 'release-profiles.mjs');
  assert.equal(existsSync(profilePath), true, 'missing scripts/release/release-profiles.mjs');

  const profiles = await import(pathToFileURL(profilePath).href);
  assert.equal(typeof profiles.resolveReleaseProfile, 'function');
  assert.equal(typeof profiles.resolveDesktopBundleTargets, 'function');
  assert.equal(typeof profiles.buildDesktopReleaseMatrix, 'function');
  assert.equal(typeof profiles.buildServerReleaseMatrix, 'function');
  assert.equal(typeof profiles.buildContainerReleaseMatrix, 'function');
  assert.equal(typeof profiles.buildKubernetesReleaseMatrix, 'function');

  const profile = profiles.resolveReleaseProfile('claw-studio');
  const matrix = profiles.buildDesktopReleaseMatrix('claw-studio');
  const serverMatrix = profiles.buildServerReleaseMatrix('claw-studio');
  const containerMatrix = profiles.buildContainerReleaseMatrix('claw-studio');
  const kubernetesMatrix = profiles.buildKubernetesReleaseMatrix('claw-studio');

  assert.equal(profile.id, 'claw-studio');
  assert.equal(profile.release.manifestFileName, 'release-manifest.json');
  assert.equal(profile.release.manifestChecksumFileName, 'release-manifest.json.sha256.txt');
  assert.equal(profile.release.attestationEvidenceFileName, 'release-attestations.json');
  assert.equal(profile.release.attestationPredicateType, 'https://slsa.dev/provenance/v1');
  assert.equal(profile.release.attestationSignerWorkflowPath, '.github/workflows/release-reusable.yml');
  assert.equal(profile.release.globalChecksumsFileName, 'SHA256SUMS.txt');
  assert.equal(profile.release.enableArtifactAttestations, true);
  assert.equal(matrix.length, 6);
  assert.equal(serverMatrix.length, 6);
  assert.equal(containerMatrix.length, 4);
  assert.equal(kubernetesMatrix.length, 4);
  assert.deepEqual(
    serverMatrix.find((entry) => entry.platform === 'windows' && entry.arch === 'x64'),
    {
      runner: 'windows-2022',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      archiveFormat: 'zip',
    },
  );
  assert.deepEqual(
    containerMatrix.find((entry) => entry.arch === 'x64' && entry.accelerator === 'nvidia-cuda'),
    {
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'nvidia-cuda',
    },
  );
  assert.deepEqual(
    kubernetesMatrix.find((entry) => entry.arch === 'arm64' && entry.accelerator === 'cpu'),
    {
      runner: 'ubuntu-24.04-arm',
      platform: 'linux',
      arch: 'arm64',
      target: 'aarch64-unknown-linux-gnu',
      accelerator: 'cpu',
    },
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'windows',
      arch: 'x64',
    }),
    ['nsis'],
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'linux',
      arch: 'x64',
    }),
    ['deb', 'rpm'],
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'linux',
      arch: 'x64',
      bundleTargets: ['appimage'],
    }),
    ['appimage'],
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'macos',
      arch: 'arm64',
    }),
    ['app', 'dmg'],
  );
});
