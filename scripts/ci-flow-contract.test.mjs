import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('repository exposes a mainline CI workflow for push and pull request verification', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/ci.yml');

  const workflow = read('.github/workflows/ci.yml');
  const rustToolchain = read('rust-toolchain.toml');
  const nodeWrapperPath = path.join(rootDir, 'sdkwork-run-node');
  const pnpmWrapperPath = path.join(rootDir, 'sdkwork-run-pnpm');
  const gitSourcePreparationCount =
    workflow.match(/node scripts\/prepare-shared-sdk-git-sources\.mjs/g)?.length ?? 0;
  const sharedSdkPreparationCount =
    workflow.match(/pnpm prepare:shared-sdk/g)?.length ?? 0;
  const wrapperPathExposureCount =
    workflow.match(/Expose workspace command wrappers/g)?.length ?? 0;

  assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /pull_request:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-2022/);
  assert.match(workflow, /pnpm\/action-setup@/);
  assert.match(workflow, /actions\/setup-node@/);
  assert.equal(
    existsSync(nodeWrapperPath),
    true,
    'CI Linux runners need a POSIX sdkwork-run-node wrapper because package scripts invoke sdkwork-run-node without a .cmd extension',
  );
  assert.equal(
    existsSync(pnpmWrapperPath),
    true,
    'CI Linux runners need a POSIX sdkwork-run-pnpm wrapper because package scripts invoke sdkwork-run-pnpm without a .cmd extension',
  );
  assert.match(
    workflow,
    /Expose workspace command wrappers[\s\S]*command -v cygpath[\s\S]*chmod \+x "\$\{workspace_path\}\/sdkwork-run-node" "\$\{workspace_path\}\/sdkwork-run-pnpm"[\s\S]*printf '%s\\n' "\$GITHUB_WORKSPACE" >> "\$\{github_path_file\}"/,
    'CI must add the checked-out workspace root to PATH before running pnpm scripts that call sdkwork-run-node or sdkwork-run-pnpm',
  );
  assert.equal(
    wrapperPathExposureCount,
    2,
    'CI must expose workspace command wrappers in each job that runs pnpm lifecycle scripts',
  );
  assert.equal(gitSourcePreparationCount, 2);
  assert.match(workflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
  assert.match(
    rustToolchain,
    /channel\s*=\s*"1\.91\.1"/,
    'ci must use the same locally verified Rust toolchain as release builds',
  );
  assert.doesNotMatch(
    workflow,
    /uses:\s*dtolnay\/rust-toolchain@stable/,
    'ci must not float Rust to a future stable compiler that can change release results',
  );
  assert.match(
    workflow,
    /uses:\s*dtolnay\/rust-toolchain@1\.91\.1/,
    'ci must install the same Rust toolchain pinned by rust-toolchain.toml',
  );
  assert.match(workflow, /Prepare shared SDK sources/);
  assert.doesNotMatch(
    workflow,
    /SDKWORK_SHARED_SDK_GIT_REF:\s*main/,
    'ci workflow must not float shared SDK materialization on a remote main branch',
  );
  assert.doesNotMatch(
    workflow,
    /SDKWORK_SHARED_SDK_APP_REPO_URL:/,
    'ci workflow should resolve pinned shared SDK sources from repository config rather than ad hoc repo URL env vars',
  );
  assert.doesNotMatch(
    workflow,
    /SDKWORK_SHARED_SDK_COMMON_REPO_URL:/,
    'ci workflow should resolve pinned shared SDK sources from repository config rather than ad hoc repo URL env vars',
  );
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.equal(sharedSdkPreparationCount, 2);
  assert.match(workflow, /pkg-config/);
  assert.match(workflow, /libwayland-dev/);
  assert.match(workflow, /libxkbcommon-dev/);
  assert.match(workflow, /pnpm lint/);
  assert.match(workflow, /pnpm check:desktop/);
  assert.match(workflow, /pnpm check:server/);
  assert.match(workflow, /pnpm build/);
  assert.match(workflow, /pnpm server:build/);
  assert.match(workflow, /pnpm docs:build/);
  assert.match(
    workflow,
    /pnpm release:fixture:ready/,
    'ci workflow must prove the finalized release readiness gate has a complete default-profile success path',
  );
  assert.match(
    workflow,
    /node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-claw-desktop\/src-tauri\/Cargo\.toml/,
  );
  assert.doesNotMatch(
    workflow,
    /(^|\s)cargo test --manifest-path packages\/sdkwork-claw-desktop\/src-tauri\/Cargo\.toml/,
    'ci workflow must execute Rust checks through scripts/run-cargo.mjs so Cargo dependency resolution stays locked and diagnostic behavior stays consistent',
  );
  assert.match(workflow, /Run Windows server checks[\s\S]*pnpm check:server/);
  assert.match(workflow, /Run Windows server build[\s\S]*pnpm server:build/);
});
