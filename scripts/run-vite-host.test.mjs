import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createViteHostPlan,
  prepareViteHostEnvironment,
  resolveViteExecutablePlan,
} from './run-vite-host.mjs';

const modulePath = path.resolve(import.meta.dirname, 'run-vite-host.mjs');
const defaultViteInvocation = ({ platform }) => ({
  command: platform === 'win32' ? 'vite.cmd' : 'vite',
  argsPrefix: [],
  shell: platform === 'win32',
});

const servePlan = createViteHostPlan({
  argv: ['serve', '--host', '0.0.0.0', '--port', '3001'],
  env: {},
  platform: 'linux',
  resolveViteInvocation: defaultViteInvocation,
});

assert.equal(servePlan.command, 'vite');
assert.deepEqual(servePlan.args, ['serve', '--mode', 'development', '--host', '0.0.0.0', '--port', '3001']);
assert.equal(servePlan.env.SDKWORK_VITE_MODE, 'development');

const buildPlan = createViteHostPlan({
  argv: ['build'],
  env: {},
  platform: 'linux',
  resolveViteInvocation: defaultViteInvocation,
});

assert.equal(buildPlan.command, 'vite');
assert.deepEqual(buildPlan.args, ['build', '--mode', 'production']);
assert.equal(buildPlan.env.SDKWORK_VITE_MODE, 'production');

const explicitModePlan = createViteHostPlan({
  argv: ['build', '--mode', 'test'],
  env: { SDKWORK_VITE_MODE: 'production' },
  platform: 'win32',
  resolveViteInvocation: defaultViteInvocation,
});

assert.equal(explicitModePlan.command, 'vite.cmd');
assert.deepEqual(explicitModePlan.args, ['build', '--mode', 'test', '--configLoader', 'native']);
assert.equal(explicitModePlan.env.SDKWORK_VITE_MODE, 'test');

const explicitConfigLoaderPlan = createViteHostPlan({
  argv: ['build', '--configLoader', 'runner'],
  env: {},
  platform: 'win32',
  resolveViteInvocation: defaultViteInvocation,
});

assert.deepEqual(explicitConfigLoaderPlan.args, ['build', '--mode', 'production', '--configLoader', 'runner']);

let preparedWorkspaceRootDir = null;
await prepareViteHostEnvironment({
  workspaceRootDir: '/tmp/agent-studio',
  repairImpl: async ({ workspaceRootDir }) => {
    preparedWorkspaceRootDir = workspaceRootDir;
  },
});
assert.equal(preparedWorkspaceRootDir, '/tmp/agent-studio');

assert.throws(
  () => createViteHostPlan({
    argv: ['build', '--mode'],
    env: {},
    platform: 'linux',
    resolveViteInvocation: () => ({
      command: 'vite',
      argsPrefix: [],
      shell: false,
    }),
  }),
  /Missing value for --mode/,
);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'run-vite-host-test-'));
try {
  const workspaceRootDir = path.join(tempRoot, 'workspace');
  const viteStoreDir = path.join(
    workspaceRootDir,
    'node_modules',
    '.pnpm',
    'vite@8.0.3_hash',
    'node_modules',
    'vite',
  );
  await mkdir(path.join(viteStoreDir, 'node_modules'), { recursive: true });
  await mkdir(path.join(viteStoreDir, 'dist', 'node'), { recursive: true });
  await mkdir(path.join(workspaceRootDir, 'node_modules', '.pnpm', 'node_modules'), {
    recursive: true,
  });
  await writeFile(
    path.join(viteStoreDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'vite',
        version: '8.0.3',
        type: 'module',
        bin: {
          vite: 'bin/vite.js',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(viteStoreDir, 'dist', 'node', 'cli.js'), '#!/usr/bin/env node\n');

  const viteExecutablePlan = resolveViteExecutablePlan({
    cwd: path.join(workspaceRootDir, 'packages', 'sdkwork-agentstudio-pc-web'),
    workspaceRootDir,
    platform: 'win32',
    nodeExecutable: 'node.exe',
  });

  assert.equal(viteExecutablePlan.command, 'node.exe');
  assert.deepEqual(viteExecutablePlan.argsPrefix, [path.join(viteStoreDir, 'dist', 'node', 'cli.js')]);
  assert.equal(viteExecutablePlan.shell, false);

  const pnpmBackedBuildPlan = createViteHostPlan({
    argv: ['build'],
    env: {},
    cwd: path.join(workspaceRootDir, 'packages', 'sdkwork-agentstudio-pc-web'),
    workspaceRootDir,
    platform: 'win32',
  });
  assert.match(
    pnpmBackedBuildPlan.env.NODE_PATH ?? '',
    /node_modules\\vite\\node_modules/u,
  );
  assert.match(
    pnpmBackedBuildPlan.env.NODE_PATH ?? '',
    /node_modules\\\.pnpm\\node_modules/u,
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

assert.match(
  readFileSync(modulePath, 'utf8'),
  /async function runCli\(\) \{\s*await prepareViteHostEnvironment\(\);/s,
);
assert.match(
  readFileSync(modulePath, 'utf8'),
  /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*runCli\(\)\.catch\(\(error\) => \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\);\s*\}/s,
);

console.log('ok - vite host runner resolves explicit and default modes for serve and build commands');
