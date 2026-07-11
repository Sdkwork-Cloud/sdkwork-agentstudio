import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeManifestFixture({
  releaseAssetsDir,
  releaseTag = 'release-2026-04-12-01',
  repository = 'Sdkwork-Cloud/agent-studio',
  artifactRelativePath = 'web/agent-studio-web-assets-release-2026-04-12-01.tar.gz',
  artifactContent = 'web-assets',
} = {}) {
  const artifactPath = path.join(releaseAssetsDir, artifactRelativePath);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, artifactContent, 'utf8');
  const releaseNotesRelativePath = 'release-notes.md';
  const releaseNotesContent = '# Agent Studio Release\n\nRelease notes.\n';
  const releaseNotesPath = path.join(releaseAssetsDir, releaseNotesRelativePath);
  writeFileSync(releaseNotesPath, releaseNotesContent, 'utf8');
  writeFileSync(
    path.join(releaseAssetsDir, 'release-manifest.json'),
    `${JSON.stringify({
      profileId: 'agent-studio',
      productName: 'Agent Studio',
      releaseTag,
      repository,
      generatedAt: '2026-04-12T01:02:03.000Z',
      checksumFileName: 'SHA256SUMS.txt',
      releaseCoverage: {
        status: 'complete',
        allowPartialRelease: false,
        requiredTargets: ['web/web/any'],
        presentTargets: ['web/web/any'],
        missingTargets: [],
      },
      releaseMetadata: [
        {
          kind: 'release-notes',
          purpose: 'github-release-body',
          relativePath: releaseNotesRelativePath,
          sha256: sha256(releaseNotesContent),
          size: statSync(releaseNotesPath).size,
          required: true,
        },
      ],
      artifacts: [
        {
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          relativePath: artifactRelativePath,
          sha256: sha256(artifactContent),
          size: Buffer.byteLength(artifactContent),
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    artifactRelativePath,
    artifactSha256: sha256(artifactContent),
    releaseNotesRelativePath,
    releaseNotesSha256: sha256(releaseNotesContent),
  };
}

test('attestation evidence writer verifies every finalized artifact and writes machine-readable evidence', async () => {
  const evidencePath = path.join(rootDir, 'scripts', 'release', 'write-attestation-evidence.mjs');
  assert.equal(existsSync(evidencePath), true, 'missing scripts/release/write-attestation-evidence.mjs');

  const evidence = await import(pathToFileURL(evidencePath).href);
  assert.equal(typeof evidence.parseArgs, 'function');
  assert.equal(typeof evidence.writeAttestationEvidence, 'function');
  assert.throws(
    () => evidence.parseArgs(['--release-assets-dir']),
    /Missing value for --release-assets-dir/,
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-attestation-evidence-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    const {
      artifactRelativePath,
      artifactSha256,
      releaseNotesRelativePath,
      releaseNotesSha256,
    } = writeManifestFixture({ releaseAssetsDir });
    const ghCalls = [];

    const result = evidence.writeAttestationEvidence({
      profileId: 'agent-studio',
      releaseAssetsDir,
      repository: 'Sdkwork-Cloud/agent-studio',
      releaseTag: 'release-2026-04-12-01',
      now: () => '2026-04-12T02:03:04.000Z',
      execFileSyncImpl(command, args) {
        ghCalls.push({ command, args });
        assert.equal(command, 'gh');
        assert.match(args.join(' '), /attestation verify/);
        assert.match(
          args.join(' '),
          /--signer-workflow Sdkwork-Cloud\/agent-studio\/\.github\/workflows\/release-reusable\.yml/,
        );
        assert.match(args.join(' '), /--format json/);
        const verifiedPath = String(args[2] ?? '').replaceAll('\\', '/');
        const expectedRelativePath = verifiedPath.endsWith(releaseNotesRelativePath)
          ? releaseNotesRelativePath
          : artifactRelativePath;
        const expectedSha256 = expectedRelativePath === releaseNotesRelativePath
          ? releaseNotesSha256
          : artifactSha256;
        return JSON.stringify([
          {
            verificationResult: 'success',
            predicateType: 'https://slsa.dev/provenance/v1',
            subject: [
              {
                name: expectedRelativePath,
                digest: {
                  sha256: expectedSha256,
                },
              },
            ],
          },
        ]);
      },
    });

    assert.equal(ghCalls.length, 2);
    assert.deepEqual(
      ghCalls.map((call) => path.relative(releaseAssetsDir, call.args[2]).replaceAll('\\', '/')).sort(),
      [artifactRelativePath, releaseNotesRelativePath].sort(),
    );
    assert.equal(result.evidencePath, path.join(releaseAssetsDir, 'release-attestations.json'));
    assert.equal(result.subjectCount, 2);

    const written = JSON.parse(readFileSync(result.evidencePath, 'utf8'));
    assert.equal(written.schemaVersion, 1);
    assert.equal(written.repository, 'Sdkwork-Cloud/agent-studio');
    assert.equal(written.releaseTag, 'release-2026-04-12-01');
    assert.equal(written.predicateType, 'https://slsa.dev/provenance/v1');
    assert.equal(written.signerWorkflow, '.github/workflows/release-reusable.yml');
    assert.equal(written.signerWorkflowIdentity, 'Sdkwork-Cloud/agent-studio/.github/workflows/release-reusable.yml');
    assert.equal(written.artifacts.length, 2);
    const writtenArtifact = written.artifacts.find((entry) => entry.relativePath === artifactRelativePath);
    const writtenReleaseNotes = written.artifacts.find((entry) => entry.relativePath === releaseNotesRelativePath);
    assert.deepEqual(
      {
        kind: writtenArtifact.kind,
        relativePath: writtenArtifact.relativePath,
        sha256: writtenArtifact.sha256,
        repository: writtenArtifact.repository,
        releaseTag: writtenArtifact.releaseTag,
        sourceRef: writtenArtifact.sourceRef,
        predicateType: writtenArtifact.predicateType,
        signerWorkflow: writtenArtifact.signerWorkflow,
        signerWorkflowIdentity: writtenArtifact.signerWorkflowIdentity,
        verified: writtenArtifact.verified,
        verifiedAt: writtenArtifact.verifiedAt,
      },
      {
        kind: 'artifact',
        relativePath: artifactRelativePath,
        sha256: artifactSha256,
        repository: 'Sdkwork-Cloud/agent-studio',
        releaseTag: 'release-2026-04-12-01',
        sourceRef: 'refs/tags/release-2026-04-12-01',
        predicateType: 'https://slsa.dev/provenance/v1',
        signerWorkflow: '.github/workflows/release-reusable.yml',
        signerWorkflowIdentity: 'Sdkwork-Cloud/agent-studio/.github/workflows/release-reusable.yml',
        verified: true,
        verifiedAt: '2026-04-12T02:03:04.000Z',
      },
    );
    assert.equal(writtenReleaseNotes.kind, 'release-metadata');
    assert.equal(writtenReleaseNotes.relativePath, releaseNotesRelativePath);
    assert.equal(writtenReleaseNotes.sha256, releaseNotesSha256);
    assert.match(writtenArtifact.verificationCommand, /gh attestation verify/);
    assert.match(writtenArtifact.verificationCommand, /--source-ref refs\/tags\/release-2026-04-12-01/);
    assert.match(writtenArtifact.verificationCommand, /--predicate-type https:\/\/slsa\.dev\/provenance\/v1/);
    assert.match(
      writtenArtifact.verificationCommand,
      /--signer-workflow Sdkwork-Cloud\/agent-studio\/\.github\/workflows\/release-reusable\.yml/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('attestation evidence writer rejects verification output that does not bind the expected artifact digest', async () => {
  const evidencePath = path.join(rootDir, 'scripts', 'release', 'write-attestation-evidence.mjs');
  const evidence = await import(pathToFileURL(evidencePath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-attestation-evidence-mismatch-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeManifestFixture({ releaseAssetsDir });

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'agent-studio',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/agent-studio',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          return JSON.stringify([
            {
              verificationResult: 'success',
              predicateType: 'https://slsa.dev/provenance/v1',
              subject: [
                {
                  name: 'web/agent-studio-web-assets-release-2026-04-12-01.tar.gz',
                  digest: {
                    sha256: '0'.repeat(64),
                  },
                },
              ],
            },
          ]);
        },
      }),
      /Attestation verification did not bind expected digest/,
    );

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'agent-studio',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/agent-studio',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          return '{not-json';
        },
      }),
      /Unable to parse gh attestation verification output/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('attestation evidence writer rejects release metadata without a finalized file or digest', async () => {
  const evidencePath = path.join(rootDir, 'scripts', 'release', 'write-attestation-evidence.mjs');
  const evidence = await import(pathToFileURL(evidencePath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-attestation-evidence-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeManifestFixture({ releaseAssetsDir });
    rmSync(path.join(releaseAssetsDir, 'release-notes.md'), { force: true });

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'agent-studio',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/agent-studio',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          throw new Error('should not verify missing metadata');
        },
      }),
      /Missing release subject for attestation verification: release-notes\.md/,
    );

    writeManifestFixture({ releaseAssetsDir });
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.releaseMetadata[0].sha256 = '';
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'agent-studio',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/agent-studio',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          throw new Error('should not verify malformed metadata');
        },
      }),
      /Release manifest subject is missing sha256 for attestation verification: release-notes\.md/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
