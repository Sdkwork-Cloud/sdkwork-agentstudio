import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  remapWorktreeWorkspaceImport,
  resolveWorkspacePackageAliases,
  resolveWorkspacePackageEntry,
  shouldEnableWorktreeWorkspaceResolver,
  shouldAttemptWorkspaceResolverRemap,
} from './viteWorkspaceResolver.ts';

const packagesRoot = path.resolve(process.cwd(), 'packages');
const currentWorkspaceRoot = path.resolve(process.cwd());
const retiredGenericAppSdkPackage = `@sdkwork/${'app'}-sdk`;
const canonicalWorkspaceRoot = currentWorkspaceRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? path.resolve(currentWorkspaceRoot, '..', '..')
  : currentWorkspaceRoot;
const expectedCorePcReactAppRoot = path.resolve(
  canonicalWorkspaceRoot,
  '../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts',
);
const expectedCorePcReactRuntimeRoot = path.resolve(
  currentWorkspaceRoot,
  'scripts/shims/core-pc-react-runtime-node.ts',
);
const worktreeRoot = path.resolve(
  canonicalWorkspaceRoot,
  '.worktrees/codex-openclaw-gateway-webchat',
);

test('resolveWorkspacePackageEntry maps @sdkwork workspace packages into the current workspace', () => {
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/claw-infrastructure', packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/index.ts'),
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/claw-i18n', packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts'),
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/core-pc-react', packagesRoot),
    null,
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/core-pc-react/app', packagesRoot),
    expectedCorePcReactAppRoot,
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/craw-chat-backend-sdk', packagesRoot),
    null,
  );
  assert.equal(resolveWorkspacePackageEntry('@sdkwork/craw-chat-sdk', packagesRoot), null);
  assert.equal(resolveWorkspacePackageEntry('react', packagesRoot), null);
});

test('resolveWorkspacePackageAliases creates direct aliases for local @sdkwork/claw-* packages', () => {
  const aliases = resolveWorkspacePackageAliases(packagesRoot);
  const infrastructureAlias = aliases.find((entry) => entry.find === '@sdkwork/claw-infrastructure');
  const i18nAlias = aliases.find((entry) => entry.find === '@sdkwork/claw-i18n');
  const corePcReactAppAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/app');
  const corePcReactEnvAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/env');
  const corePcReactImAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/im');
  const corePcReactRuntimeAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/runtime');

  assert.ok(infrastructureAlias);
  assert.equal(
    infrastructureAlias?.replacement,
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/index.ts'),
  );
  assert.ok(i18nAlias);
  assert.equal(
    i18nAlias?.replacement,
    path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts'),
  );
  assert.ok(corePcReactAppAlias);
  assert.equal(
    corePcReactAppAlias?.replacement,
    expectedCorePcReactAppRoot,
  );
  assert.ok(corePcReactEnvAlias);
  assert.ok(corePcReactRuntimeAlias);
  assert.equal(
    corePcReactRuntimeAlias?.replacement,
    expectedCorePcReactRuntimeRoot,
  );
  assert.equal(corePcReactImAlias, undefined);
  assert.equal(
    aliases.some((entry) => entry.find === '@sdkwork/core-pc-react'),
    false,
  );
  assert.equal(
    aliases.some((entry) => entry.find === '@sdkwork/craw-chat-backend-sdk'),
    false,
  );
  assert.equal(
    aliases.some((entry) => entry.find === '@sdkwork/craw-chat-sdk'),
    false,
  );
  assert.equal(
    aliases.some((entry) => entry.find === retiredGenericAppSdkPackage),
    false,
  );
});

test('remapWorktreeWorkspaceImport remaps absolute worktree package paths into the current workspace', () => {
  const worktreeSource = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts',
  );

  assert.equal(
    remapWorktreeWorkspaceImport(worktreeSource, undefined, packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/platform/webStudio.ts'),
  );
});

test('remapWorktreeWorkspaceImport remaps relative imports when the importer comes from a worktree package', () => {
  const worktreeImporter = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/services/fileDialogService.ts',
  );

  assert.equal(
    remapWorktreeWorkspaceImport('../platform/index.ts', worktreeImporter, packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/platform/index.ts'),
  );
});

test('remapWorktreeWorkspaceImport resolves extensionless relative imports to existing source files', () => {
  const worktreeImporter = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-web/src/main.tsx',
  );

  assert.equal(
    remapWorktreeWorkspaceImport('./App', worktreeImporter, packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-web/src/App.tsx'),
  );
  assert.equal(
    remapWorktreeWorkspaceImport('./application/app/AppRoot', path.resolve(worktreeRoot, 'packages/sdkwork-claw-shell/src/index.ts'), packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-shell/src/application/app/AppRoot.tsx'),
  );
});

test('remapWorktreeWorkspaceImport preserves Vite /@fs/ prefixes and query suffixes', () => {
  const worktreeSource = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-i18n/src/index.ts',
  ).replace(/\\/g, '/');

  assert.equal(
    remapWorktreeWorkspaceImport(`/@fs/${worktreeSource}?v=worktree`, undefined, packagesRoot),
    `${path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts')}?v=worktree`,
  );
});

test('shouldAttemptWorkspaceResolverRemap fast-rejects imports that cannot target the workspace remap paths', () => {
  const worktreeImporter = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/services/fileDialogService.ts',
  );

  assert.equal(shouldAttemptWorkspaceResolverRemap('react', undefined), false);
  assert.equal(shouldAttemptWorkspaceResolverRemap('@radix-ui/react-dialog', undefined), false);
  assert.equal(shouldAttemptWorkspaceResolverRemap('@sdkwork/claw-infrastructure', undefined), false);
  assert.equal(
    shouldAttemptWorkspaceResolverRemap(
      path.resolve(worktreeRoot, 'packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts'),
      undefined,
      packagesRoot,
    ),
    true,
  );
  assert.equal(
    shouldAttemptWorkspaceResolverRemap('../platform/index.ts', worktreeImporter, packagesRoot),
    true,
  );
  assert.equal(
    shouldAttemptWorkspaceResolverRemap(
      '../platform/index.ts',
      path.resolve(packagesRoot, 'sdkwork-claw-web/src/App.tsx'),
      packagesRoot,
    ),
    false,
  );
});

test('shouldEnableWorktreeWorkspaceResolver only enables the worktree remap plugin when the workspace or env requires it', () => {
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(canonicalWorkspaceRoot, {}),
    false,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(worktreeRoot, {}),
    true,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(currentWorkspaceRoot, {
      SDKWORK_ENABLE_WORKTREE_RESOLVER: 'true',
    }),
    true,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(worktreeRoot, {
      SDKWORK_ENABLE_WORKTREE_RESOLVER: 'false',
    }),
    false,
  );
});
