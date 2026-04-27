import assert from 'node:assert/strict';
import path from 'node:path';

import { normalizeCargoInvocationArgs } from './run-cargo.mjs';

const workspaceRoot = 'D:\\workspace\\claw-studio';

assert.deepEqual(
  normalizeCargoInvocationArgs([
    'test',
    '--manifest-path',
    'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
    '--target-dir',
    'target/check-desktop',
    'embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor',
    '--',
    '--test-threads=1',
  ], { cwd: workspaceRoot }),
  [
    'test',
    '--manifest-path',
    path.resolve(workspaceRoot, 'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'),
    '--target-dir',
    path.resolve(workspaceRoot, 'target/check-desktop'),
    'embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor',
    '--',
    '--test-threads=1',
  ],
  'run-cargo must absolutize manifest and target paths before Cargo resolves local path dependencies',
);

assert.deepEqual(
  normalizeCargoInvocationArgs([
    'test',
    '--manifest-path=packages/sdkwork-claw-server/src-host/Cargo.toml',
    '--target-dir=target/check-server',
  ], { cwd: workspaceRoot }),
  [
    'test',
    `--manifest-path=${path.resolve(workspaceRoot, 'packages/sdkwork-claw-server/src-host/Cargo.toml')}`,
    `--target-dir=${path.resolve(workspaceRoot, 'target/check-server')}`,
  ],
  'run-cargo must support equals-style Cargo path arguments',
);

assert.deepEqual(
  normalizeCargoInvocationArgs([
    'test',
    '--',
    '--manifest-path',
    'not-a-cargo-manifest-argument',
  ], { cwd: workspaceRoot }),
  [
    'test',
    '--',
    '--manifest-path',
    'not-a-cargo-manifest-argument',
  ],
  'run-cargo must not rewrite test-binary arguments after the Cargo argument separator',
);

console.log('ok - run-cargo normalizes Cargo path arguments before spawning cargo');
