import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const legacyRustToolchainPatterns = [
  /ensure-tauri-rust-toolchain/,
  /ensureTauriRustToolchain/,
  /tauri rust toolchain/i,
];
const workflowCargoBuildLikeCommandPattern =
  /(^|[\s|;&])cargo(?:\.exe)?\s+(?:build|check|test|run|clippy|doc)\b/;
const currentTestPath = path.relative(rootDir, import.meta.filename);

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function listFiles(rootPath) {
  const absoluteRootPath = path.join(rootDir, rootPath);
  const entries = readdirSync(absoluteRootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativeEntryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(relativeEntryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativeEntryPath);
    }
  }

  return files;
}

function assertFileDoesNotContainLegacyToolchainNaming(relativePath) {
  const content = read(relativePath);
  for (const pattern of legacyRustToolchainPatterns) {
    assert.doesNotMatch(
      content,
      pattern,
      `${relativePath} must use native Rust toolchain naming instead of the old Tauri-only guard name`,
    );
  }
}

assert.equal(
  existsSync(path.join(rootDir, 'scripts', 'ensure-native-rust-toolchain.mjs')),
  true,
  'native Rust toolchain guard entrypoint must exist',
);
assert.equal(
  existsSync(path.join(rootDir, 'scripts', 'ensure-native-rust-toolchain.test.mjs')),
  true,
  'native Rust toolchain guard tests must exist',
);
assert.equal(
  existsSync(path.join(rootDir, 'scripts', 'ensure-tauri-rust-toolchain.mjs')),
  false,
  'legacy Tauri-only Rust toolchain guard entrypoint must be removed',
);
assert.equal(
  existsSync(path.join(rootDir, 'scripts', 'ensure-tauri-rust-toolchain.test.mjs')),
  false,
  'legacy Tauri-only Rust toolchain guard test file must be removed',
);

const rootPackage = readJson('package.json');
assert.match(
  rootPackage.scripts?.['check:automation'] ?? '',
  /sdkwork-run-node scripts\/native-toolchain-standard-contract\.test\.mjs/,
  'automation gate must include the native toolchain standards contract',
);

for (const relativePath of [
  'package.json',
  'tauri-dev-fast.cmd',
  '.github/workflows/ci.yml',
  '.github/workflows/release-reusable.yml',
  'packages/sdkwork-agentstudio-pc-desktop/package.json',
  'packages/sdkwork-agentstudio-pc-server/package.json',
  ...listFiles('scripts').filter((relativePath) => (
    /\.(?:mjs|test\.mjs)$/u.test(relativePath)
    && relativePath !== currentTestPath
  )),
]) {
  assertFileDoesNotContainLegacyToolchainNaming(relativePath);
}

const desktopPackage = readJson('packages/sdkwork-agentstudio-pc-desktop/package.json');
for (const scriptName of ['dev:desktop', 'build:desktop', 'build:desktop:test', 'build:desktop:prod']) {
  assert.match(
    desktopPackage.scripts?.[scriptName] ?? '',
    /sdkwork-run-node \.\.\/\.\.\/scripts\/ensure-native-rust-toolchain\.mjs/,
    `desktop ${scriptName} must guard native Rust availability before invoking Tauri`,
  );
}

assert.equal(
  readJson('packages/sdkwork-agentstudio-pc-server/package.json').scripts?.dev,
  'sdkwork-run-node ../../scripts/run-cargo.mjs run --manifest-path src-host/Cargo.toml',
  'server dev must go through the shared Cargo launcher',
);
assert.match(
  rootPackage.scripts?.['check:server'] ?? '',
  /sdkwork-run-node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-agentstudio-pc-server\/src-host\/Cargo\.toml/,
  'server checks must go through the shared Cargo launcher',
);
assert.match(
  read('scripts/run-agentstudio-server-build.mjs'),
  /const runCargoScriptPath = path\.join\(rootDir, 'scripts', 'run-cargo\.mjs'\)/,
  'server release builds must reuse the shared Cargo launcher instead of maintaining a second native Cargo execution path',
);
assert.doesNotMatch(
  read('scripts/run-agentstudio-server-build.mjs'),
  /command:\s*'cargo'/,
  'server release build native plans must not spawn Cargo directly',
);

for (const workflowPath of ['.github/workflows/ci.yml', '.github/workflows/release-reusable.yml']) {
  const workflow = read(workflowPath);
  assert.match(
    workflow,
    /node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-agentstudio-pc-desktop\/src-tauri\/Cargo\.toml/,
    `${workflowPath} must route desktop Rust verification through the shared Cargo launcher`,
  );
  assert.doesNotMatch(
    workflow,
    workflowCargoBuildLikeCommandPattern,
    `${workflowPath} must not call Cargo build-like commands directly`,
  );
}

const nativeToolchainSource = read('scripts/ensure-native-rust-toolchain.mjs');
assert.match(
  nativeToolchainSource,
  /export function ensureNativeRustToolchain/,
  'native Rust toolchain module must export the native guard function',
);
assert.doesNotMatch(
  nativeToolchainSource,
  /ensureTauriRustToolchain/,
  'native Rust toolchain module must not keep compatibility exports with the old Tauri-only name',
);

console.log('ok - native Rust toolchain standards prevent legacy guard names and raw workflow Cargo checks');
