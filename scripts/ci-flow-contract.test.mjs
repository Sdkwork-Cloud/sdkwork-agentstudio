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
  const gitSourcePreparationCount =
    workflow.match(/node scripts\/prepare-shared-sdk-git-sources\.mjs/g)?.length ?? 0;
  const sharedSdkPreparationCount =
    workflow.match(/pnpm prepare:shared-sdk/g)?.length ?? 0;

  assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /pull_request:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-2022/);
  assert.match(workflow, /pnpm\/action-setup@/);
  assert.match(workflow, /actions\/setup-node@/);
  assert.equal(gitSourcePreparationCount, 2);
  assert.match(workflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
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
