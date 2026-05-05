#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  assertSafeReleaseRelativePath,
  normalizeReleaseRelativePath,
} from './release-paths.mjs';

const __filename = fileURLToPath(import.meta.url);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseAssetsDir: path.resolve('release-assets'),
    repository: '',
    releaseTag: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
      continue;
    }

    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
    }
  }

  return options;
}

function readJsonFile(filePath, contextLabel) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to parse ${contextLabel}: ${filePath}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertReleaseTopLevelFileName(fileName, label) {
  if (
    !fileName
    || fileName === '.'
    || fileName === '..'
    || fileName.includes('\0')
    || fileName.includes(':')
    || fileName.includes('/')
    || fileName.includes('\\')
    || path.posix.isAbsolute(fileName)
    || path.win32.isAbsolute(fileName)
    || path.posix.basename(fileName) !== fileName
    || path.win32.basename(fileName) !== fileName
  ) {
    throw new Error(`Invalid ${label}: ${fileName || 'missing'}`);
  }
}

function normalizeSubjectRelativePath(subject) {
  const relativePath = normalizeReleaseRelativePath(subject?.relativePath);
  assertSafeReleaseRelativePath(relativePath, {
    contextLabel: 'Finalized release manifest',
    artifactPathLabel: 'attestation subject path',
  });
  return relativePath;
}

function normalizeVerificationOutput(rawOutput, relativePath) {
  try {
    return JSON.parse(String(rawOutput ?? '').trim() || 'null');
  } catch (error) {
    throw new Error(
      `Unable to parse gh attestation verification output for ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractSubjectDigestEntries(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const entries = [];
  if (Array.isArray(value.subject)) {
    entries.push(...value.subject);
  }
  if (Array.isArray(value.subjects)) {
    entries.push(...value.subjects);
  }
  if (Array.isArray(value.attestations)) {
    for (const attestation of value.attestations) {
      entries.push(...extractSubjectDigestEntries(attestation));
    }
  }
  if (Array.isArray(value.bundle?.dsseEnvelope?.payload?.subject)) {
    entries.push(...value.bundle.dsseEnvelope.payload.subject);
  }
  if (value.statement && typeof value.statement === 'object') {
    entries.push(...extractSubjectDigestEntries(value.statement));
  }
  if (value.predicate && typeof value.predicate === 'object') {
    entries.push(...extractSubjectDigestEntries(value.predicate));
  }

  return entries;
}

function collectSubjectDigestEntries(verificationOutput) {
  const values = Array.isArray(verificationOutput)
    ? verificationOutput
    : [verificationOutput];
  return values.flatMap((value) => extractSubjectDigestEntries(value));
}

function verificationOutputContainsDigest({
  verificationOutput,
  expectedSha256,
}) {
  return collectSubjectDigestEntries(verificationOutput).some((subject) => {
    const digest = subject?.digest;
    const sha256 = String(
      digest?.sha256
        ?? digest?.['sha256']
        ?? digest?.['sha256:']
        ?? '',
    ).trim().toLowerCase();
    return sha256 === expectedSha256;
  });
}

function buildSignerWorkflowIdentity({
  repository,
  signerWorkflow,
}) {
  const normalizedRepository = String(repository ?? '').trim();
  const normalizedSignerWorkflow = String(signerWorkflow ?? '').trim().replace(/\\/g, '/');

  if (!normalizedRepository) {
    throw new Error('repository is required to build release attestation signer workflow identity.');
  }
  if (!normalizedSignerWorkflow) {
    throw new Error('Release attestation signer workflow path is required.');
  }
  if (
    normalizedSignerWorkflow.includes('\0')
    || normalizedSignerWorkflow.includes(':')
    || normalizedSignerWorkflow.startsWith('/')
    || normalizedSignerWorkflow.includes('../')
    || normalizedSignerWorkflow.includes('/..')
    || normalizedSignerWorkflow === '..'
  ) {
    throw new Error(`Invalid release attestation signer workflow path: ${normalizedSignerWorkflow}`);
  }

  return `${normalizedRepository}/${normalizedSignerWorkflow}`;
}

function buildGhAttestationArgs({
  artifactPath,
  repository,
  sourceRef,
  predicateType,
  signerWorkflowIdentity,
}) {
  return [
    'attestation',
    'verify',
    artifactPath,
    '-R',
    repository,
    '--source-ref',
    sourceRef,
    '--predicate-type',
    predicateType,
    '--signer-workflow',
    signerWorkflowIdentity,
    '--format',
    'json',
  ];
}

function buildVerificationCommand(args) {
  return `gh ${args.map((arg) => String(arg).includes(' ') ? `"${arg}"` : arg).join(' ')}`;
}

function buildAttestationSubjects(manifest) {
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) {
    throw new Error('Release manifest artifacts must not be empty.');
  }

  const releaseMetadata = Array.isArray(manifest?.releaseMetadata)
    ? manifest.releaseMetadata
    : [];

  return [
    ...artifacts.map((artifact) => ({
      ...artifact,
      attestationKind: 'artifact',
    })),
    ...releaseMetadata.map((metadata) => ({
      ...metadata,
      attestationKind: 'release-metadata',
    })),
  ];
}

export function writeAttestationEvidence({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir = path.resolve('release-assets'),
  repository = '',
  releaseTag = '',
  now = () => new Date().toISOString(),
  execFileSyncImpl = execFileSync,
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);

  if (!existsSync(normalizedReleaseAssetsDir)) {
    throw new Error(`Missing release assets directory: ${normalizedReleaseAssetsDir}`);
  }

  const manifestPath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.manifestFileName,
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing finalized release manifest: ${manifestPath}`);
  }

  assertReleaseTopLevelFileName(
    profile.release.attestationEvidenceFileName,
    'release attestation evidence file name',
  );
  const evidencePath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.attestationEvidenceFileName,
  );
  const manifest = readJsonFile(manifestPath, 'finalized release manifest');
  const subjects = buildAttestationSubjects(manifest);

  const normalizedRepository = String(repository ?? '').trim()
    || String(manifest?.repository ?? '').trim();
  if (!normalizedRepository) {
    throw new Error('repository is required to write release attestation evidence.');
  }

  const normalizedReleaseTag = String(releaseTag ?? '').trim()
    || String(manifest?.releaseTag ?? '').trim();
  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to write release attestation evidence.');
  }

  const predicateType = String(profile.release.attestationPredicateType ?? '').trim();
  const signerWorkflow = String(profile.release.attestationSignerWorkflowPath ?? '').trim();
  const signerWorkflowIdentity = buildSignerWorkflowIdentity({
    repository: normalizedRepository,
    signerWorkflow,
  });
  const sourceRef = `refs/tags/${normalizedReleaseTag}`;
  const generatedAt = now();
  const normalizedSubjects = subjects.map((subject) => {
    const relativePath = normalizeSubjectRelativePath(subject);
    const subjectPath = path.join(normalizedReleaseAssetsDir, relativePath);
    if (!existsSync(subjectPath)) {
      throw new Error(`Missing release subject for attestation verification: ${relativePath}`);
    }
    if (!statSync(subjectPath).isFile()) {
      throw new Error(`Release subject for attestation verification is not a file: ${relativePath}`);
    }

    const expectedSha256 = String(subject?.sha256 ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new Error(`Release manifest subject is missing sha256 for attestation verification: ${relativePath}`);
    }

    return {
      ...subject,
      relativePath,
      subjectPath,
      expectedSha256,
    };
  });
  const evidenceSubjects = [];

  for (const subject of normalizedSubjects) {
    const ghArgs = buildGhAttestationArgs({
      artifactPath: subject.subjectPath,
      repository: normalizedRepository,
      sourceRef,
      predicateType,
      signerWorkflowIdentity,
    });
    const rawVerificationOutput = execFileSyncImpl('gh', ghArgs, {
      cwd: normalizedReleaseAssetsDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const verificationOutput = normalizeVerificationOutput(
      rawVerificationOutput,
      subject.relativePath,
    );
    if (!verificationOutputContainsDigest({
      verificationOutput,
      expectedSha256: subject.expectedSha256,
    })) {
      throw new Error(
        `Attestation verification did not bind expected digest for ${subject.relativePath}: ${subject.expectedSha256}.`,
      );
    }

    evidenceSubjects.push({
      kind: subject.attestationKind,
      relativePath: subject.relativePath,
      sha256: subject.expectedSha256,
      repository: normalizedRepository,
      releaseTag: normalizedReleaseTag,
      sourceRef,
      predicateType,
      signerWorkflow,
      signerWorkflowIdentity,
      verified: true,
      verifiedAt: generatedAt,
      verificationCommand: buildVerificationCommand(ghArgs),
    });
  }

  writeFileSync(
    evidencePath,
    `${JSON.stringify({
      schemaVersion: 1,
      repository: normalizedRepository,
      releaseTag: normalizedReleaseTag,
      sourceRef,
      generatedAt,
      predicateType,
      signerWorkflow,
      signerWorkflowIdentity,
      artifacts: evidenceSubjects,
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    evidencePath,
    subjectCount: evidenceSubjects.length,
  };
}

function main() {
  const result = writeAttestationEvidence(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    [
      'Release attestation evidence written.',
      `evidence=${result.evidencePath}`,
      `subjectCount=${result.subjectCount}`,
    ].join('\n'),
  );
  process.stdout.write('\n');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
