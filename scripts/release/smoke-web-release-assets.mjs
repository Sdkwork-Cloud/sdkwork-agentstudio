#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeArchiveEntryPath,
  readTarGzEntries as readArchiveTarGzEntries,
} from './archive-entry-safety.mjs';
import {
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';

const INTERNAL_DOC_PREFIXES = [
  'community/',
  'prompts/',
  'release/',
  'reports/',
  'review/',
  'step/',
  'plans/',
  'superpowers/',
  'zh-CN/community/',
  'zh-CN/prompts/',
  'zh-CN/release/',
  'zh-CN/reports/',
  'zh-CN/review/',
  'zh-CN/step/',
  'zh-CN/plans/',
  'zh-CN/superpowers/',
  `${String.fromCodePoint(0x67b6, 0x6784)}/`,
];
const PUBLIC_INTERNAL_DOC_ASSET_PREFIXES = [
  'community/',
  'zh-CN/community/',
];
const PUBLIC_DOC_ASSET_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

export function readTarGzEntries(archivePath) {
  return readArchiveTarGzEntries(archivePath, {
    context: 'Web release',
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

function resolveWebReleaseAssetManifestPath({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'web',
    RELEASE_ASSET_MANIFEST_FILENAME,
  );
}

function readWebReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
} = {}) {
  const manifestPath = resolveWebReleaseAssetManifestPath({
    releaseAssetsDir,
  });

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing web release asset manifest: ${manifestPath}`);
  }

  return {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  };
}

function assertWebManifestMatchesTarget({
  manifest,
  manifestPath,
}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Web release asset manifest must be a JSON object: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(`Web release asset manifest is missing artifacts[]: ${manifestPath}`);
  }
  if (String(manifest.platform ?? '').trim() !== 'web') {
    throw new Error(
      `Web release asset manifest platform mismatch at ${manifestPath}: expected web, received ${manifest.platform ?? 'unknown'}`,
    );
  }
  if (String(manifest.arch ?? '').trim() !== 'any') {
    throw new Error(
      `Web release asset manifest architecture mismatch at ${manifestPath}: expected any, received ${manifest.arch ?? 'unknown'}`,
    );
  }
}

function resolveWebArchiveArtifact(manifest, manifestPath) {
  const archiveArtifacts = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.filter((artifact) => {
      const relativePath = String(artifact?.relativePath ?? '').trim().toLowerCase();
      return String(artifact?.family ?? '').trim() === 'web' && relativePath.endsWith('.tar.gz');
    })
    : [];

  if (archiveArtifacts.length === 0) {
    throw new Error(`Missing web archive artifact in ${manifestPath}`);
  }
  if (archiveArtifacts.length > 1) {
    throw new Error(`Expected exactly one web archive artifact in ${manifestPath}, received ${archiveArtifacts.length}.`);
  }

  return archiveArtifacts[0];
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Web release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  const releaseAssetsRoot = path.resolve(releaseAssetsDir);
  if (
    absolutePath !== releaseAssetsRoot
    && !absolutePath.startsWith(`${releaseAssetsRoot}${path.sep}`)
  ) {
    throw new Error(`Web release artifact resolves outside release assets directory: ${relativePath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing web release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

function readSidecarChecksum(checksumPath) {
  if (!existsSync(checksumPath)) {
    throw new Error(`Missing web release artifact checksum sidecar: ${checksumPath}`);
  }

  const [checksum] = readFileSync(checksumPath, 'utf8').trim().split(/\s+/);
  return String(checksum ?? '').trim().toLowerCase();
}

function computeSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function assertArtifactIntegrity({
  archivePath,
  artifact,
}) {
  const actualSha256 = computeSha256(archivePath);
  const expectedSha256 = String(artifact?.sha256 ?? '').trim().toLowerCase();
  const sidecarSha256 = readSidecarChecksum(`${archivePath}.sha256.txt`);
  const expectedSize = Number(artifact?.size);
  const actualSize = statSync(archivePath).size;

  if (expectedSha256 && expectedSha256 !== actualSha256) {
    throw new Error(
      `Web release artifact checksum mismatch for ${archivePath}: manifest expected ${expectedSha256}, received ${actualSha256}.`,
    );
  }
  if (sidecarSha256 !== actualSha256) {
    throw new Error(
      `Web release artifact checksum mismatch for ${archivePath}: sidecar expected ${sidecarSha256}, received ${actualSha256}.`,
    );
  }
  if (Number.isFinite(expectedSize) && expectedSize !== actualSize) {
    throw new Error(
      `Web release artifact size mismatch for ${archivePath}: manifest expected ${expectedSize}, received ${actualSize}.`,
    );
  }

  return actualSha256;
}

function requireEntry(entries, entryPath, description) {
  if (!entries.has(entryPath)) {
    throw new Error(`Web release archive is missing ${description}: ${entryPath}`);
  }

  return entries.get(entryPath);
}

function hasEntryUnder(entries, prefix) {
  for (const [entryPath, entry] of entries.entries()) {
    if (entryPath.startsWith(prefix) && (entry?.type === '0' || entry?.type === '')) {
      return true;
    }
  }

  return false;
}

function collectPublicDocsAssetPaths({
  publicDir = path.join(rootDir, 'docs', 'public'),
} = {}) {
  const assetPaths = new Set();
  if (!existsSync(publicDir)) {
    return assetPaths;
  }

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      assetPaths.add(
        path.relative(publicDir, absolutePath).replaceAll('\\', '/'),
      );
    }
  };

  visit(publicDir);
  return assetPaths;
}

function isDirectoryEntry(entryPath, entry) {
  return entryPath.endsWith('/') || entry?.type === '5';
}

function isAllowedPublicInternalDocsAssetDirectory(docsRelativePath, publicDocsAssetPaths) {
  const normalizedPath = `${normalizeArchiveEntryPath(docsRelativePath).replace(/\/+$/, '')}/`;
  if (!PUBLIC_INTERNAL_DOC_ASSET_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return false;
  }

  for (const assetPath of publicDocsAssetPaths) {
    if (assetPath.startsWith(normalizedPath)) {
      return true;
    }
  }

  return false;
}

function isAllowedPublicInternalDocsAsset(docsRelativePath, publicDocsAssetPaths) {
  const normalizedPath = normalizeArchiveEntryPath(docsRelativePath);
  const extension = path.posix.extname(normalizedPath).toLowerCase();
  return PUBLIC_INTERNAL_DOC_ASSET_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
    && PUBLIC_DOC_ASSET_EXTENSIONS.has(extension)
    && publicDocsAssetPaths.has(normalizedPath);
}

function parseSearchIndex(entry, entryPath) {
  try {
    const parsed = JSON.parse(entry.content.toString('utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('search index is not an array');
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Web release archive has an invalid docs search index at ${entryPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertPublicDocsBoundary({
  entries,
  bundleRoot,
  searchIndex,
}) {
  const docsRootPrefix = `${bundleRoot}/docs/dist/`;
  const publicDocsAssetPaths = collectPublicDocsAssetPaths();

  for (const [entryPath, entry] of entries.entries()) {
    if (!entryPath.startsWith(docsRootPrefix)) {
      continue;
    }

    const docsRelativePath = entryPath.slice(docsRootPrefix.length);
    const internalPrefix = INTERNAL_DOC_PREFIXES.find((prefix) => docsRelativePath.startsWith(prefix));
    if (internalPrefix) {
      if (
        (isDirectoryEntry(entryPath, entry)
          && isAllowedPublicInternalDocsAssetDirectory(docsRelativePath, publicDocsAssetPaths))
        || isAllowedPublicInternalDocsAsset(docsRelativePath, publicDocsAssetPaths)
      ) {
        continue;
      }

      throw new Error(
        `Web release archive must not include internal documentation path: ${entryPath}`,
      );
    }
  }

  for (const record of searchIndex) {
    const url = String(record?.url ?? '').replace(/^\/+/, '');
    const internalPrefix = INTERNAL_DOC_PREFIXES.find((prefix) => url.startsWith(prefix));
    if (internalPrefix) {
      throw new Error(
        `Web release docs search index must not include internal documentation URL: /${url}`,
      );
    }
  }
}

function buildBundleRoot(artifact) {
  const archiveName = path.posix.basename(String(artifact?.relativePath ?? '').replaceAll('\\', '/'));
  if (!archiveName.endsWith('.tar.gz')) {
    throw new Error(`Web release artifact must be a .tar.gz archive: ${archiveName}`);
  }

  return archiveName.slice(0, -'.tar.gz'.length);
}

export async function smokeWebReleaseAssets({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
} = {}) {
  const { manifestPath, manifest } = readWebReleaseAssetManifest({
    releaseAssetsDir,
  });
  assertWebManifestMatchesTarget({
    manifest,
    manifestPath,
  });

  const archiveArtifact = resolveWebArchiveArtifact(manifest, manifestPath);
  const archivePath = resolveArtifactAbsolutePath(releaseAssetsDir, archiveArtifact);
  assertArtifactIntegrity({
    archivePath,
    artifact: archiveArtifact,
  });

  const entries = readTarGzEntries(archivePath);
  const bundleRoot = buildBundleRoot(archiveArtifact);
  const webIndexPath = `${bundleRoot}/web/dist/index.html`;
  const webAssetsPrefix = `${bundleRoot}/web/dist/assets/`;
  const docsIndexPath = `${bundleRoot}/docs/dist/index.html`;
  const docsNotFoundPath = `${bundleRoot}/docs/dist/404.html`;
  const docsSearchIndexPath = `${bundleRoot}/docs/dist/search-index.json`;

  requireEntry(entries, webIndexPath, 'web/dist/index.html');
  if (!hasEntryUnder(entries, webAssetsPrefix)) {
    throw new Error(`Web release archive is missing built browser assets under ${webAssetsPrefix}`);
  }
  requireEntry(entries, docsIndexPath, 'docs/dist/index.html');
  requireEntry(entries, docsNotFoundPath, 'docs/dist/404.html');
  const searchIndex = parseSearchIndex(
    requireEntry(entries, docsSearchIndexPath, 'docs/dist/search-index.json'),
    docsSearchIndexPath,
  );
  assertPublicDocsBoundary({
    entries,
    bundleRoot,
    searchIndex,
  });

  const artifactRelativePaths = manifest.artifacts
    .map((artifact) => String(artifact?.relativePath ?? '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const report = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'web',
    platform: 'web',
    arch: 'any',
    smokeKind: 'web-archive-content',
    status: 'passed',
    manifestPath,
    artifactRelativePaths,
    checks: [
      {
        id: 'artifact-checksum',
        status: 'passed',
        detail: 'archive checksum matches manifest and sidecar metadata',
      },
      {
        id: 'web-index',
        status: 'passed',
        detail: 'web/dist/index.html is present in the archive',
      },
      {
        id: 'web-assets',
        status: 'passed',
        detail: 'web/dist/assets contains browser assets',
      },
      {
        id: 'docs-index',
        status: 'passed',
        detail: 'docs/dist/index.html is present in the archive',
      },
      {
        id: 'docs-404',
        status: 'passed',
        detail: 'docs/dist/404.html is present in the archive',
      },
      {
        id: 'docs-search-index',
        status: 'passed',
        detail: 'docs/dist/search-index.json is present and parseable',
      },
      {
        id: 'public-doc-boundary',
        status: 'passed',
        detail: 'docs/dist excludes internal-only documentation directories',
      },
    ],
  });

  return {
    platform: 'web',
    arch: 'any',
    manifestPath,
    manifest,
    archivePath,
    report,
  };
}

export function parseArgs(argv) {
  const options = {
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

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
  const result = await smokeWebReleaseAssets(parseArgs(argv));
  console.log(
    `Smoke-verified packaged web archive at ${path.relative(process.cwd(), result.archivePath) || result.archivePath}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
