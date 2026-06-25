import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = path.resolve(import.meta.dirname, 'ts-extension-loader.mjs');
const loader = await import(pathToFileURL(modulePath).href);
const workspaceRootHelperPath = path.resolve(import.meta.dirname, 'workspace-root.mjs');
const workspaceRootHelper = await import(pathToFileURL(workspaceRootHelperPath).href);

assert.equal(typeof loader.resolveSharedSdkSourceAliasPath, 'function');
assert.equal(typeof loader.resolveWorkspacePackageSourceAliasPath, 'function');
assert.equal(typeof loader.load, 'function');
assert.equal(typeof workspaceRootHelper.resolveWorkspaceRootDir, 'function');
assert.equal(typeof workspaceRootHelper.resolveCanonicalWorkspaceRootDir, 'function');

const workspaceRoot = workspaceRootHelper.resolveWorkspaceRootDir(
  path.resolve(import.meta.dirname, '..'),
);
const canonicalWorkspaceRoot = workspaceRootHelper.resolveCanonicalWorkspaceRootDir(
  path.resolve(import.meta.dirname, '..'),
);
const packageDir = path.resolve(import.meta.dirname, '..', 'packages', 'sdkwork-claw-web');

assert.equal(
  workspaceRootHelper.resolveWorkspaceRootDir(packageDir),
  path.resolve(import.meta.dirname, '..'),
  'worktree package directories must resolve to the nearest workspace root instead of the outer checkout',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/iam-app-sdk', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-iam/sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi/src/index.ts',
  ),
  'source mode must redirect @sdkwork/iam-app-sdk to the sibling SDK source entry',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/messaging-app-sdk', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-messaging/sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/generated/server-openapi/src/index.ts',
  ),
  'source mode must redirect @sdkwork/messaging-app-sdk to the sibling SDK source entry',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/sdk-common/http', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/http/index.ts',
  ),
  'source mode must redirect @sdkwork/sdk-common subpaths to sibling source entries',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/iam-app-sdk', { SDKWORK_SHARED_SDK_MODE: 'git' }),
  null,
  'git mode must keep installed package resolution instead of forcing source aliases',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/unknown-package', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  null,
  'non-shared-sdk packages must not be remapped by the loader',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/claw-infrastructure'),
  path.resolve(
    workspaceRoot,
    'packages/sdkwork-claw-infrastructure/src/index.ts',
  ),
  'workspace package resolution must map @sdkwork/claw-* packages to their source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/claw-core'),
  path.resolve(
    workspaceRoot,
    'packages/sdkwork-claw-core/src/node.ts',
  ),
  'workspace package resolution must respect package root exports for Node-safe entries',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath(
    '@sdkwork/claw-core',
    pathToFileURL(
      path.resolve(
        workspaceRoot,
        'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigToolsSection.test.tsx',
      ),
    ).href,
  ),
  path.resolve(
    workspaceRoot,
    'packages/sdkwork-claw-core/src/index.ts',
  ),
  'workspace package resolution must prefer browser root exports for tsx component entrypoints',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath(
    '@sdkwork/claw-core',
    pathToFileURL(
      path.resolve(
        workspaceRoot,
        'packages/sdkwork-claw-commons/src/hooks/useKeyboardShortcuts.ts',
      ),
    ).href,
  ),
  path.resolve(
    workspaceRoot,
    'packages/sdkwork-claw-core/src/index.ts',
  ),
  'workspace package resolution must prefer browser root exports for browser hook sources',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/core-pc-react'),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-core/sdkwork-core-pc-react/src/index.ts',
  ),
  'workspace package resolution must map sibling workspace package roots to their source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/core-pc-react/app'),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts',
  ),
  'workspace package resolution must map sibling workspace package subpaths to their source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/core-pc-react/runtime'),
  path.resolve(
    workspaceRoot,
    'scripts/shims/core-pc-react-runtime-node.ts',
  ),
  'workspace package resolution must route core-pc-react runtime through the local Node-safe shim',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/auth-runtime-pc-react'),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/index.ts',
  ),
  'workspace package resolution must map appbase PC auth runtime to its source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/iam-runtime'),
  path.resolve(
    canonicalWorkspaceRoot,
    '../sdkwork-iam/apps/sdkwork-iam-common/packages/sdkwork-iam-runtime/src/index.ts',
  ),
  'workspace package resolution must keep appbase internal IAM runtime available for appbase wrappers',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/sdkwork-im-sdk'),
  null,
  'workspace package resolution must not shadow the sdkwork-im SDK package with a claw host shim',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/sdkwork-im-backend-sdk'),
  null,
  'workspace package resolution must not remap sdkwork-im backend sdk imports through the claw studio workspace',
);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-ts-loader-'));
const tempTsxPath = path.join(tempDir, 'fixture.tsx');

try {
  fs.writeFileSync(tempTsxPath, 'export const Fixture = () => <div>fixture</div>;\n');
  const loadedModule = await loader.load(pathToFileURL(tempTsxPath).href, {}, () => {
    throw new Error('tsx fixture should be transpiled by the loader');
  });

  assert.equal(loadedModule.format, 'module');
  assert.equal(loadedModule.shortCircuit, true);
  assert.match(loadedModule.source, /react\/jsx-runtime/);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('ok - ts extension loader remaps shared SDK packages to source entries in source mode');

