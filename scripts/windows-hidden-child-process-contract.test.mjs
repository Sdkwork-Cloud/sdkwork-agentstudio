import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertHiddenWindowsChildProcess(relativePath, pattern, message) {
  assert.match(read(relativePath), pattern, message);
}

assertHiddenWindowsChildProcess(
  'scripts/run-vite-host.mjs',
  /spawn\(plan\.command, plan\.args,[\s\S]*windowsHide:\s*true/,
  'run-vite-host must not open a new Windows console window when launching Vite',
);

assertHiddenWindowsChildProcess(
  'scripts/run-vitepress.mjs',
  /spawn\(process\.execPath, \[vitepressCli, \.\.\.process\.argv\.slice\(2\)\],[\s\S]*windowsHide:\s*true/,
  'run-vitepress must not open a new Windows console window when launching VitePress',
);

assertHiddenWindowsChildProcess(
  'scripts/run-node-typescript-check.mjs',
  /spawnSync\(process\.execPath, createNodeTypeScriptArgs\(scriptPath\),[\s\S]*windowsHide:\s*true/,
  'run-node-typescript-check must not open Windows console windows for checked scripts',
);

assertHiddenWindowsChildProcess(
  'scripts/prepare-shared-sdk-packages.mjs',
  /spawnSync\(resolveSpawnCommand\(command\), args,[\s\S]*windowsHide:\s*true/,
  'prepare-shared-sdk-packages must not open Windows console windows for package preparation commands',
);

assertHiddenWindowsChildProcess(
  'scripts/prepare-shared-sdk-git-sources.mjs',
  /spawnSync\('where\.exe', \['git'\],[\s\S]*windowsHide:\s*true/,
  'prepare-shared-sdk-git-sources git discovery must not open Windows console windows',
);

assertHiddenWindowsChildProcess(
  'scripts/prepare-shared-sdk-git-sources.mjs',
  /spawnSync\(resolveSpawnCommand\(command\), args,[\s\S]*windowsHide:\s*true/,
  'prepare-shared-sdk-git-sources command runner must not open Windows console windows',
);

assertHiddenWindowsChildProcess(
  'scripts/sync-bundled-components.mjs',
  /spawnSync\(command, commandArgs,[\s\S]*windowsHide:\s*true/,
  'sync-bundled-components command runner must not open Windows console windows',
);

const pnpmWrapperSource = read('sdkwork-run-pnpm.cmd');

assert.match(
  pnpmWrapperSource,
  /setlocal EnableDelayedExpansion/,
  'sdkwork-run-pnpm must use delayed expansion so failed pnpm commands keep their live exit code',
);
assert.doesNotMatch(
  pnpmWrapperSource,
  /exit \/b %errorlevel%/i,
  'sdkwork-run-pnpm must not use parse-time %errorlevel% expansion after command calls',
);
assert.match(
  pnpmWrapperSource,
  /exit \/b !errorlevel!/i,
  'sdkwork-run-pnpm must return the live errorlevel from invoked pnpm commands',
);

console.log('ok - Windows child-process windows are hidden and batch wrappers preserve exit codes');
