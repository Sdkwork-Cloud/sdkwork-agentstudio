import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const packageJson = readJson('package.json');
const tsconfigBasePath = path.join(root, 'tsconfig.base.json');
const hostTsconfigPaths = [
  'packages/sdkwork-claw-web/tsconfig.json',
  'packages/sdkwork-claw-desktop/tsconfig.json',
];

runTest('workspace TypeScript baseline stays valid for the active toolchain when leaf configs use baseUrl', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-ts-toolchain-contract-'));

  try {
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const answer = 42;\n');
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: path.relative(tempDir, tsconfigBasePath).replaceAll('\\', '/'),
          compilerOptions: {
            baseUrl: '.',
          },
          include: ['index.ts'],
        },
        null,
        2,
      ),
    );

    const result = spawnSync(
      process.execPath,
      ['scripts/run-workspace-tsc.mjs', '-p', path.join(tempDir, 'tsconfig.json'), '--pretty', 'false'],
      {
        cwd: root,
        stdio: 'inherit',
      },
    );

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(
      result.status,
      0,
      'workspace TypeScript baseline must compile under the active toolchain',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('automation gate executes the workspace TypeScript toolchain contract', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /node scripts\/typescript-toolchain-contract\.test\.mjs/,
    'package.json must run scripts/typescript-toolchain-contract.test.mjs from check:automation',
  );
});

runTest('host TypeScript configs do not compile through external sdkwork-core source internals', () => {
  for (const tsconfigPath of hostTsconfigPaths) {
    const tsconfig = readJson(tsconfigPath);
    const paths = tsconfig.compilerOptions?.paths ?? {};

    assert.equal(
      Object.hasOwn(paths, '@sdkwork/core-pc-react'),
      false,
      `${tsconfigPath} must consume @sdkwork/core-pc-react through the package boundary`,
    );
    assert.equal(
      Object.hasOwn(paths, '@sdkwork/core-pc-react/*'),
      false,
      `${tsconfigPath} must not force TypeScript into @sdkwork/core-pc-react subpath source internals`,
    );
  }
});
