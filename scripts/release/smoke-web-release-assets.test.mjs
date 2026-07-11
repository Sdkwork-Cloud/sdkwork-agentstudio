import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function formatTarOctal(value, width) {
  return `${value.toString(8).padStart(width - 2, '0')}\0 `;
}

function createTarHeader({
  name,
  size,
  type = '0',
} = {}) {
  const header = Buffer.alloc(512, 0);
  Buffer.from(String(name ?? '').slice(0, 100), 'utf8').copy(header, 0);
  Buffer.from(formatTarOctal(0o644, 8), 'utf8').copy(header, 100);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 108);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 116);
  Buffer.from(formatTarOctal(size, 12), 'utf8').copy(header, 124);
  Buffer.from(formatTarOctal(0, 12), 'utf8').copy(header, 136);
  header.fill(0x20, 148, 156);
  header.write(String(type ?? '0').slice(0, 1), 156, 1, 'utf8');
  Buffer.from('ustar\0', 'utf8').copy(header, 257);
  Buffer.from('00', 'utf8').copy(header, 263);

  let checksum = 0;
  for (const value of header.values()) {
    checksum += value;
  }
  Buffer.from(formatTarOctal(checksum, 8), 'utf8').copy(header, 148);

  return header;
}

function createTarRecord({
  name,
  content = '',
  type = '0',
} = {}) {
  const contentBuffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(String(content ?? ''), 'utf8');
  const paddingSize = (512 - (contentBuffer.length % 512)) % 512;

  return Buffer.concat([
    createTarHeader({
      name,
      size: contentBuffer.length,
      type,
    }),
    contentBuffer,
    Buffer.alloc(paddingSize, 0),
  ]);
}

function writeWebReleaseFixture({
  releaseAssetsDir,
  releaseTag = 'release-2026-04-11-01',
  records = [],
} = {}) {
  const webDir = path.join(releaseAssetsDir, 'web');
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;
  const archiveRelativePath = `${archiveBaseName}.tar.gz`;
  const archivePath = path.join(releaseAssetsDir, archiveRelativePath);

  mkdirSync(webDir, { recursive: true });
  writeFileSync(
    archivePath,
    gzipSync(Buffer.concat([
      ...records,
      Buffer.alloc(1024, 0),
    ])),
  );

  const sha256 = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  writeFileSync(
    `${archivePath}.sha256.txt`,
    `${sha256}  ${path.basename(archivePath)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(webDir, 'release-asset-manifest.json'),
    `${JSON.stringify({
      profileId: 'agent-studio',
      productName: 'Agent Studio',
      releaseTag,
      platform: 'web',
      arch: 'any',
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: archiveRelativePath,
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          sha256,
          size: readFileSync(archivePath).length,
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    archiveBaseName,
    archivePath,
    archiveRelativePath,
    manifestPath: path.join(webDir, 'release-asset-manifest.json'),
    sha256,
  };
}

function buildPassingArchiveRecords(bundleRoot) {
  return [
    createTarRecord({
      name: `${bundleRoot}/web/dist/index.html`,
      content: '<html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/web/dist/assets/index.js`,
      content: 'console.log("Agent Studio");\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/dist/index.html`,
      content: '<html><body>Docs</body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/dist/404.html`,
      content: '<html><body>Not found</body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/dist/search-index.json`,
      content: `${JSON.stringify([
        {
          title: 'Getting Started',
          url: '/guide/getting-started',
          text: 'Start with Agent Studio',
        },
      ])}\n`,
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/dist/community/qq-qr-placeholder.svg`,
      content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>\n',
    }),
  ];
}

test('web release smoke validates the packaged archive and records release evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-web-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeWebReleaseAssets, 'function');
  assert.equal(typeof smoke.readTarGzEntries, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-01';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    const fixture = writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: buildPassingArchiveRecords(archiveBaseName),
    });

    const result = await smoke.smokeWebReleaseAssets({
      releaseAssetsDir,
    });

    assert.equal(result.platform, 'web');
    assert.equal(result.arch, 'any');
    assert.equal(result.manifestPath.replaceAll('\\', '/'), fixture.manifestPath.replaceAll('\\', '/'));
    assert.equal(result.archivePath.replaceAll('\\', '/'), fixture.archivePath.replaceAll('\\', '/'));
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.family, 'web');
    assert.equal(result.report.report.smokeKind, 'web-archive-content');
    assert.deepEqual(result.report.report.artifactRelativePaths, [fixture.archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      [
        'artifact-checksum',
        'web-index',
        'web-assets',
        'docs-index',
        'docs-404',
        'docs-search-index',
        'public-doc-boundary',
      ],
    );
    assert.equal(existsSync(result.report.reportPath), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects archives that leak internal documentation into public docs', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-internal-docs-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-02';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName),
        createTarRecord({
          name: `${archiveBaseName}/docs/dist/reports/private.html`,
          content: '<html><body>internal report</body></html>\n',
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /must not include internal documentation path/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects internal documentation directory entries', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-internal-dir-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-04';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName),
        createTarRecord({
          name: `${archiveBaseName}/docs/dist/reports/`,
          content: '',
          type: '5',
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /must not include internal documentation path/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects duplicate normalized archive entries', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-duplicate-entry-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-05';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName),
        createTarRecord({
          name: `${archiveBaseName}/web/dist/index.html`,
          content: '<html><body>duplicate index</body></html>\n',
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /duplicate archive entry/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects symlink archive entries', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-symlink-entry-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-06';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName),
        createTarRecord({
          name: `${archiveBaseName}/docs/dist/linked-index.html`,
          content: 'docs/dist/index.html',
          type: '2',
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /unsupported archive entry type/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects stale manifest checksums before recording evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-web-smoke-checksum-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-03';
  const archiveBaseName = `agent-studio-web-assets-${releaseTag}`;

  try {
    const fixture = writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: buildPassingArchiveRecords(archiveBaseName),
    });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    manifest.artifacts[0].sha256 = '0'.repeat(64);
    writeFileSync(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /checksum mismatch/i,
    );
    assert.equal(
      existsSync(path.join(releaseAssetsDir, 'web', 'release-smoke-report.json')),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
