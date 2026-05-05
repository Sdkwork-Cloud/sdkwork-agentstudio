import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { repairPnpmStoreFiles } from './repair-pnpm-store-files.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'repair-pnpm-store-files-test-'));

function createIntegrityAndStorePath(storeRootDir, content) {
  const hashBuffer = crypto.createHash('sha512').update(content).digest();
  const hexDigest = hashBuffer.toString('hex');
  return {
    integrity: `sha512-${hashBuffer.toString('base64')}`,
    storeFilePath: path.join(storeRootDir, 'files', hexDigest.slice(0, 2), hexDigest.slice(2)),
  };
}

async function createStorePackage(pnpmStoreDir, storeName, packageName, version, packageJsonExtras = {}) {
  const segments = packageName.startsWith('@') ? packageName.split('/') : [packageName];
  const packageRoot = path.join(pnpmStoreDir, storeName, 'node_modules', ...segments);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version,
        ...packageJsonExtras,
      },
      null,
      2,
    )}\n`,
  );
  return packageRoot;
}

try {
  const workspaceRootDir = path.join(tempRoot, 'workspace');
  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  const globalStoreRootDir = path.join(tempRoot, 'global-store', 'v10');
  await mkdir(pnpmStoreDir, { recursive: true });
  await mkdir(path.join(globalStoreRootDir, 'index', 'aa'), { recursive: true });

  const vitePackageRoot = await createStorePackage(
    pnpmStoreDir,
    'vite@8.0.3_hash',
    'vite',
    '8.0.3',
    {
      bin: {
        vite: 'bin/vite.js',
      },
    },
  );

  const picomatchPackageRoot = await createStorePackage(
    pnpmStoreDir,
    'picomatch@4.0.4',
    'picomatch',
    '4.0.4',
    {
      main: 'index.js',
    },
  );

  const viteCliContent = '#!/usr/bin/env node\nconsole.log("vite");\n';
  const picomatchIndexContent = "module.exports = require('./lib/picomatch');\n";
  const viteIntegrity = createIntegrityAndStorePath(globalStoreRootDir, viteCliContent);
  const picomatchIntegrity = createIntegrityAndStorePath(globalStoreRootDir, picomatchIndexContent);

  await mkdir(path.dirname(viteIntegrity.storeFilePath), { recursive: true });
  await mkdir(path.dirname(picomatchIntegrity.storeFilePath), { recursive: true });
  await writeFile(viteIntegrity.storeFilePath, viteCliContent);
  await writeFile(picomatchIntegrity.storeFilePath, picomatchIndexContent);

  await writeFile(
    path.join(globalStoreRootDir, 'index', 'aa', 'vite@8.0.3.json'),
    JSON.stringify(
      {
        name: 'vite',
        version: '8.0.3',
        files: {
          'bin/vite.js': {
            integrity: viteIntegrity.integrity,
            mode: 493,
            size: viteCliContent.length,
          },
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(globalStoreRootDir, 'index', 'aa', 'picomatch@4.0.4.json'),
    JSON.stringify(
      {
        name: 'picomatch',
        version: '4.0.4',
        files: {
          'index.js': {
            integrity: picomatchIntegrity.integrity,
            mode: 420,
            size: picomatchIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const report = await repairPnpmStoreFiles({
    workspaceRootDir,
    pnpmStoreDir,
    globalStoreRootDir,
    logger: () => {},
  });

  assert.equal(report.restored.length, 2);
  assert.equal(await readFile(path.join(vitePackageRoot, 'bin', 'vite.js'), 'utf8'), viteCliContent);
  assert.equal(await readFile(path.join(picomatchPackageRoot, 'index.js'), 'utf8'), picomatchIndexContent);

  const secondReport = await repairPnpmStoreFiles({
    workspaceRootDir,
    pnpmStoreDir,
    globalStoreRootDir,
    logger: () => {},
  });
  assert.equal(secondReport.restored.length, 0);

  const filesWorkspaceRootDir = path.join(tempRoot, 'workspace-files');
  const filesPnpmStoreDir = path.join(filesWorkspaceRootDir, 'node_modules', '.pnpm');
  const filesGlobalStoreRootDir = path.join(tempRoot, 'global-store-files', 'v10');
  await mkdir(filesPnpmStoreDir, { recursive: true });
  await mkdir(path.join(filesGlobalStoreRootDir, 'index', 'bb'), { recursive: true });

  const filesVitePackageRoot = await createStorePackage(
    filesPnpmStoreDir,
    'vite@8.0.3_files-hash',
    'vite',
    '8.0.3',
    {
      bin: {
        vite: 'bin/vite.js',
      },
      imports: {
        '#module-sync-enabled': {
          'module-sync': './misc/true.js',
          default: './misc/false.js',
        },
      },
      files: ['bin', 'dist', 'misc/**/*.js', 'client.d.ts', 'types'],
    },
  );

  const existingViteCliContent = '#!/usr/bin/env node\nconsole.log("vite existing");\n';
  await mkdir(path.join(filesVitePackageRoot, 'bin'), { recursive: true });
  await writeFile(path.join(filesVitePackageRoot, 'bin', 'vite.js'), existingViteCliContent);

  const viteMiscTrueContent = 'export default true;\n';
  const viteMiscFalseContent = 'export default false;\n';
  const viteMiscTrueIntegrity = createIntegrityAndStorePath(filesGlobalStoreRootDir, viteMiscTrueContent);
  const viteMiscFalseIntegrity = createIntegrityAndStorePath(filesGlobalStoreRootDir, viteMiscFalseContent);

  await mkdir(path.dirname(viteMiscTrueIntegrity.storeFilePath), { recursive: true });
  await mkdir(path.dirname(viteMiscFalseIntegrity.storeFilePath), { recursive: true });
  await writeFile(viteMiscTrueIntegrity.storeFilePath, viteMiscTrueContent);
  await writeFile(viteMiscFalseIntegrity.storeFilePath, viteMiscFalseContent);

  await writeFile(
    path.join(filesGlobalStoreRootDir, 'index', 'bb', 'vite@8.0.3.json'),
    JSON.stringify(
      {
        name: 'vite',
        version: '8.0.3',
        files: {
          'bin/vite.js': {
            integrity: viteIntegrity.integrity,
            mode: 493,
            size: viteCliContent.length,
          },
          'misc/true.js': {
            integrity: viteMiscTrueIntegrity.integrity,
            mode: 420,
            size: viteMiscTrueContent.length,
          },
          'misc/false.js': {
            integrity: viteMiscFalseIntegrity.integrity,
            mode: 420,
            size: viteMiscFalseContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const filesReport = await repairPnpmStoreFiles({
    workspaceRootDir: filesWorkspaceRootDir,
    pnpmStoreDir: filesPnpmStoreDir,
    globalStoreRootDir: filesGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    filesReport.restored.map((entry) => entry.relativePath).sort(),
    ['misc/false.js', 'misc/true.js'],
  );
  assert.equal(await readFile(path.join(filesVitePackageRoot, 'bin', 'vite.js'), 'utf8'), existingViteCliContent);
  assert.equal(await readFile(path.join(filesVitePackageRoot, 'misc', 'true.js'), 'utf8'), viteMiscTrueContent);
  assert.equal(await readFile(path.join(filesVitePackageRoot, 'misc', 'false.js'), 'utf8'), viteMiscFalseContent);

  const fallbackWorkspaceRootDir = path.join(tempRoot, 'workspace-fallback');
  const fallbackPnpmStoreDir = path.join(fallbackWorkspaceRootDir, 'node_modules', '.pnpm');
  const fallbackGlobalStoreRootDir = path.join(tempRoot, 'global-store-fallback', 'v10');
  await mkdir(fallbackPnpmStoreDir, { recursive: true });
  await mkdir(path.join(fallbackGlobalStoreRootDir, 'index', 'cc'), { recursive: true });

  const fallbackVitePackageRoot = await createStorePackage(
    fallbackPnpmStoreDir,
    'vite@8.0.3_no-metadata',
    'vite',
    '8.0.3',
    {
      imports: {
        '#module-sync-enabled': {
          'module-sync': './misc/true.js',
          default: './misc/false.js',
        },
      },
      files: ['dist', 'misc/**/*.js', 'types'],
    },
  );

  await mkdir(path.join(fallbackVitePackageRoot, 'dist'), { recursive: true });
  await mkdir(path.join(fallbackVitePackageRoot, 'types'), { recursive: true });

  const fallbackReport = await repairPnpmStoreFiles({
    workspaceRootDir: fallbackWorkspaceRootDir,
    pnpmStoreDir: fallbackPnpmStoreDir,
    globalStoreRootDir: fallbackGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    fallbackReport.restored.map((entry) => entry.relativePath).sort(),
    ['misc/false.js', 'misc/true.js'],
  );
  assert.equal(await readFile(path.join(fallbackVitePackageRoot, 'misc', 'true.js'), 'utf8'), 'export default true\n');
  assert.equal(await readFile(path.join(fallbackVitePackageRoot, 'misc', 'false.js'), 'utf8'), 'export default false\n');

  const rebuildWorkspaceRootDir = path.join(tempRoot, 'workspace-rebuild');
  const rebuildPnpmStoreDir = path.join(rebuildWorkspaceRootDir, 'node_modules', '.pnpm');
  const rebuildGlobalStoreRootDir = path.join(tempRoot, 'global-store-rebuild', 'v10');
  await mkdir(rebuildPnpmStoreDir, { recursive: true });
  await mkdir(path.join(rebuildGlobalStoreRootDir, 'index', 'dd'), { recursive: true });

  const rebuildPackageRoot = path.join(
    rebuildPnpmStoreDir,
    '@jridgewell+trace-mapping@0.3.31',
    'node_modules',
    '@jridgewell',
    'trace-mapping',
  );
  await mkdir(rebuildPackageRoot, { recursive: true });

  const traceMappingPackageJsonContent = `${JSON.stringify(
    {
      name: '@jridgewell/trace-mapping',
      version: '0.3.31',
      main: 'dist/trace-mapping.umd.js',
      module: 'dist/trace-mapping.mjs',
      types: 'dist/types/trace-mapping.d.ts',
    },
    null,
    2,
  )}\n`;
  const traceMappingModuleContent = 'export const traceMapping = true;\n';
  const traceMappingTypesContent = 'export declare const traceMapping: boolean;\n';
  const traceMappingPackageJsonIntegrity = createIntegrityAndStorePath(
    rebuildGlobalStoreRootDir,
    traceMappingPackageJsonContent,
  );
  const traceMappingModuleIntegrity = createIntegrityAndStorePath(
    rebuildGlobalStoreRootDir,
    traceMappingModuleContent,
  );
  const traceMappingTypesIntegrity = createIntegrityAndStorePath(
    rebuildGlobalStoreRootDir,
    traceMappingTypesContent,
  );

  for (const integrityRecord of [
    traceMappingPackageJsonIntegrity,
    traceMappingModuleIntegrity,
    traceMappingTypesIntegrity,
  ]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(traceMappingPackageJsonIntegrity.storeFilePath, traceMappingPackageJsonContent);
  await writeFile(traceMappingModuleIntegrity.storeFilePath, traceMappingModuleContent);
  await writeFile(traceMappingTypesIntegrity.storeFilePath, traceMappingTypesContent);

  await writeFile(
    path.join(rebuildGlobalStoreRootDir, 'index', 'dd', '@jridgewell+trace-mapping@0.3.31.json'),
    JSON.stringify(
      {
        name: '@jridgewell/trace-mapping',
        version: '0.3.31',
        files: {
          'package.json': {
            integrity: traceMappingPackageJsonIntegrity.integrity,
            mode: 420,
            size: traceMappingPackageJsonContent.length,
          },
          'dist/trace-mapping.mjs': {
            integrity: traceMappingModuleIntegrity.integrity,
            mode: 420,
            size: traceMappingModuleContent.length,
          },
          'dist/types/trace-mapping.d.ts': {
            integrity: traceMappingTypesIntegrity.integrity,
            mode: 420,
            size: traceMappingTypesContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const rebuildReport = await repairPnpmStoreFiles({
    workspaceRootDir: rebuildWorkspaceRootDir,
    pnpmStoreDir: rebuildPnpmStoreDir,
    globalStoreRootDir: rebuildGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    rebuildReport.restored
      .filter((entry) => entry.packageName === '@jridgewell/trace-mapping')
      .map((entry) => entry.relativePath)
      .sort(),
    ['dist/trace-mapping.mjs', 'dist/types/trace-mapping.d.ts', 'package.json'],
  );
  assert.equal(await readFile(path.join(rebuildPackageRoot, 'package.json'), 'utf8'), traceMappingPackageJsonContent);
  assert.equal(
    await readFile(path.join(rebuildPackageRoot, 'dist', 'trace-mapping.mjs'), 'utf8'),
    traceMappingModuleContent,
  );

  const unreadableWorkspaceRootDir = path.join(tempRoot, 'workspace-unreadable');
  const unreadablePnpmStoreDir = path.join(unreadableWorkspaceRootDir, 'node_modules', '.pnpm');
  const unreadableGlobalStoreRootDir = path.join(tempRoot, 'global-store-unreadable', 'v10');
  await mkdir(unreadablePnpmStoreDir, { recursive: true });
  await mkdir(path.join(unreadableGlobalStoreRootDir, 'index', 'ee'), { recursive: true });

  const unreadablePackageRoot = await createStorePackage(
    unreadablePnpmStoreDir,
    'broken-main@1.0.0',
    'broken-main',
    '1.0.0',
    {
      main: 'index.js',
    },
  );
  await mkdir(path.join(unreadablePackageRoot, 'index.js'), { recursive: true });

  const brokenMainPackageJsonContent = `${JSON.stringify(
    {
      name: 'broken-main',
      version: '1.0.0',
      main: 'index.js',
    },
    null,
    2,
  )}\n`;
  const brokenMainIndexContent = 'module.exports = true;\n';
  const brokenMainPackageJsonIntegrity = createIntegrityAndStorePath(
    unreadableGlobalStoreRootDir,
    brokenMainPackageJsonContent,
  );
  const brokenMainIndexIntegrity = createIntegrityAndStorePath(
    unreadableGlobalStoreRootDir,
    brokenMainIndexContent,
  );

  for (const integrityRecord of [brokenMainPackageJsonIntegrity, brokenMainIndexIntegrity]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(brokenMainPackageJsonIntegrity.storeFilePath, brokenMainPackageJsonContent);
  await writeFile(brokenMainIndexIntegrity.storeFilePath, brokenMainIndexContent);

  await writeFile(
    path.join(unreadableGlobalStoreRootDir, 'index', 'ee', 'broken-main@1.0.0.json'),
    JSON.stringify(
      {
        name: 'broken-main',
        version: '1.0.0',
        files: {
          'package.json': {
            integrity: brokenMainPackageJsonIntegrity.integrity,
            mode: 420,
            size: brokenMainPackageJsonContent.length,
          },
          'index.js': {
            integrity: brokenMainIndexIntegrity.integrity,
            mode: 420,
            size: brokenMainIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const unreadableReport = await repairPnpmStoreFiles({
    workspaceRootDir: unreadableWorkspaceRootDir,
    pnpmStoreDir: unreadablePnpmStoreDir,
    globalStoreRootDir: unreadableGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    unreadableReport.restored
      .filter((entry) => entry.packageName === 'broken-main')
      .map((entry) => entry.relativePath)
      .sort(),
    ['index.js', 'package.json'],
  );
  assert.equal(await readFile(path.join(unreadablePackageRoot, 'index.js'), 'utf8'), brokenMainIndexContent);

  const nestedWorkspaceRootDir = path.join(tempRoot, 'workspace-nested');
  const nestedPnpmStoreDir = path.join(nestedWorkspaceRootDir, 'node_modules', '.pnpm');
  const nestedGlobalStoreRootDir = path.join(tempRoot, 'global-store-nested', 'v10');
  await mkdir(nestedPnpmStoreDir, { recursive: true });
  await mkdir(path.join(nestedGlobalStoreRootDir, 'index', 'ff'), { recursive: true });

  const nestedPackageRoot = await createStorePackage(
    nestedPnpmStoreDir,
    'nested-broken@1.0.0',
    'nested-broken',
    '1.0.0',
    {
      main: 'build/index.js',
      files: ['build'],
    },
  );
  await mkdir(path.join(nestedPackageRoot, 'build'), { recursive: true });
  await writeFile(path.join(nestedPackageRoot, 'build', 'index.js'), "export * from './types.js';\n");
  await mkdir(path.join(nestedPackageRoot, 'build', 'types.js'), { recursive: true });

  const nestedPackageJsonContent = `${JSON.stringify(
    {
      name: 'nested-broken',
      version: '1.0.0',
      main: 'build/index.js',
      files: ['build'],
    },
    null,
    2,
  )}\n`;
  const nestedIndexContent = "export * from './types.js';\n";
  const nestedTypesContent = 'export const nested = true;\n';
  const nestedPackageJsonIntegrity = createIntegrityAndStorePath(
    nestedGlobalStoreRootDir,
    nestedPackageJsonContent,
  );
  const nestedIndexIntegrity = createIntegrityAndStorePath(
    nestedGlobalStoreRootDir,
    nestedIndexContent,
  );
  const nestedTypesIntegrity = createIntegrityAndStorePath(
    nestedGlobalStoreRootDir,
    nestedTypesContent,
  );

  for (const integrityRecord of [
    nestedPackageJsonIntegrity,
    nestedIndexIntegrity,
    nestedTypesIntegrity,
  ]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(nestedPackageJsonIntegrity.storeFilePath, nestedPackageJsonContent);
  await writeFile(nestedIndexIntegrity.storeFilePath, nestedIndexContent);
  await writeFile(nestedTypesIntegrity.storeFilePath, nestedTypesContent);

  await writeFile(
    path.join(nestedGlobalStoreRootDir, 'index', 'ff', 'nested-broken@1.0.0.json'),
    JSON.stringify(
      {
        name: 'nested-broken',
        version: '1.0.0',
        files: {
          'package.json': {
            integrity: nestedPackageJsonIntegrity.integrity,
            mode: 420,
            size: nestedPackageJsonContent.length,
          },
          'build/index.js': {
            integrity: nestedIndexIntegrity.integrity,
            mode: 420,
            size: nestedIndexContent.length,
          },
          'build/types.js': {
            integrity: nestedTypesIntegrity.integrity,
            mode: 420,
            size: nestedTypesContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const nestedReport = await repairPnpmStoreFiles({
    workspaceRootDir: nestedWorkspaceRootDir,
    pnpmStoreDir: nestedPnpmStoreDir,
    globalStoreRootDir: nestedGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    nestedReport.restored
      .filter((entry) => entry.packageName === 'nested-broken')
      .map((entry) => entry.relativePath)
      .sort(),
    ['build/index.js', 'build/types.js', 'package.json'],
  );
  assert.equal(
    await readFile(path.join(nestedPackageRoot, 'build', 'types.js'), 'utf8'),
    nestedTypesContent,
  );

  const tanstackWorkspaceRootDir = path.join(tempRoot, 'workspace-tanstack');
  const tanstackPnpmStoreDir = path.join(tanstackWorkspaceRootDir, 'node_modules', '.pnpm');
  const tanstackGlobalStoreRootDir = path.join(tempRoot, 'global-store-tanstack', 'v10');
  await mkdir(tanstackPnpmStoreDir, { recursive: true });
  await mkdir(path.join(tanstackGlobalStoreRootDir, 'index', 'gg'), { recursive: true });

  const tanstackPackageRoot = await createStorePackage(
    tanstackPnpmStoreDir,
    '@tanstack+react-query@5.96.2_react@19.2.4',
    '@tanstack/react-query',
    '5.96.2',
    {
      main: 'build/legacy/index.cjs',
      module: 'build/legacy/index.js',
      files: ['build', 'src'],
      exports: {
        '.': {
          import: {
            default: './build/modern/index.js',
          },
          require: {
            default: './build/modern/index.cjs',
          },
        },
      },
    },
  );
  await mkdir(path.join(tanstackPackageRoot, 'build', 'modern'), { recursive: true });
  await mkdir(path.join(tanstackPackageRoot, 'build', 'legacy'), { recursive: true });
  await writeFile(path.join(tanstackPackageRoot, 'build', 'modern', 'index.js'), "export * from './types.js';\n");
  await writeFile(path.join(tanstackPackageRoot, 'build', 'modern', 'index.cjs'), "module.exports = require('./types.js');\n");
  await writeFile(path.join(tanstackPackageRoot, 'build', 'legacy', 'index.js'), "export * from './types.js';\n");
  await writeFile(path.join(tanstackPackageRoot, 'build', 'legacy', 'index.cjs'), "module.exports = require('./types.js');\n");
  await mkdir(path.join(tanstackPackageRoot, 'build', 'modern', 'types.js'), { recursive: true });
  await mkdir(path.join(tanstackPackageRoot, 'build', 'legacy', 'types.js'), { recursive: true });

  const tanstackReport = await repairPnpmStoreFiles({
    workspaceRootDir: tanstackWorkspaceRootDir,
    pnpmStoreDir: tanstackPnpmStoreDir,
    globalStoreRootDir: tanstackGlobalStoreRootDir,
    logger: () => {},
  });

  assert.deepEqual(
    tanstackReport.restored
      .filter((entry) => entry.packageName === '@tanstack/react-query')
      .map((entry) => entry.relativePath)
      .sort(),
    ['build/legacy/types.js', 'build/modern/types.js'],
  );
  assert.equal(
    await readFile(path.join(tanstackPackageRoot, 'build', 'modern', 'types.js'), 'utf8'),
    '//# sourceMappingURL=types.js.map\n',
  );

  const backupWorkspaceRootDir = path.join(tempRoot, 'workspace-backup');
  const backupPnpmStoreDir = path.join(backupWorkspaceRootDir, 'node_modules', '.pnpm');
  const backupGlobalStoreRootDir = path.join(tempRoot, 'global-store-backup', 'v10');
  await mkdir(backupPnpmStoreDir, { recursive: true });
  await mkdir(path.join(backupGlobalStoreRootDir, 'index', 'hh'), { recursive: true });

  const backupHealthyPackageRoot = await createStorePackage(
    backupPnpmStoreDir,
    '@scope+scoped-healthy@1.0.0',
    '@scope/scoped-healthy',
    '1.0.0',
    {
      main: 'index.js',
    },
  );
  await writeFile(path.join(backupHealthyPackageRoot, 'index.js'), 'module.exports = true;\n');

  const backupPackageJsonContent = `${JSON.stringify(
    {
      name: '@scope/scoped-healthy',
      version: '1.0.0',
      main: 'index.js',
    },
    null,
    2,
  )}\n`;
  const backupIndexContent = 'module.exports = true;\n';
  const backupPackageJsonIntegrity = createIntegrityAndStorePath(
    backupGlobalStoreRootDir,
    backupPackageJsonContent,
  );
  const backupIndexIntegrity = createIntegrityAndStorePath(
    backupGlobalStoreRootDir,
    backupIndexContent,
  );

  for (const integrityRecord of [backupPackageJsonIntegrity, backupIndexIntegrity]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(backupPackageJsonIntegrity.storeFilePath, backupPackageJsonContent);
  await writeFile(backupIndexIntegrity.storeFilePath, backupIndexContent);

  await writeFile(
    path.join(backupGlobalStoreRootDir, 'index', 'hh', '@scope+scoped-healthy@1.0.0.json'),
    JSON.stringify(
      {
        name: '@scope/scoped-healthy',
        version: '1.0.0',
        files: {
          'package.json': {
            integrity: backupPackageJsonIntegrity.integrity,
            mode: 420,
            size: backupPackageJsonContent.length,
          },
          'index.js': {
            integrity: backupIndexIntegrity.integrity,
            mode: 420,
            size: backupIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const backupScopeDir = path.join(
    backupPnpmStoreDir,
    '@scope+scoped-healthy@1.0.0',
    'node_modules',
    '@scope',
  );
  const staleBackupPackageRoot = path.join(backupScopeDir, 'scoped-healthy.bak-12345');
  await mkdir(staleBackupPackageRoot, { recursive: true });
  await copyFile(
    path.join(backupHealthyPackageRoot, 'package.json'),
    path.join(staleBackupPackageRoot, 'package.json'),
  );

  const backupReport = await repairPnpmStoreFiles({
    workspaceRootDir: backupWorkspaceRootDir,
    pnpmStoreDir: backupPnpmStoreDir,
    globalStoreRootDir: backupGlobalStoreRootDir,
    logger: () => {},
  });

  assert.equal(backupReport.damagedPackages.length, 0);
  assert.equal(backupReport.restored.length, 0);
  assert.equal(await readFile(path.join(backupHealthyPackageRoot, 'index.js'), 'utf8'), backupIndexContent);

  const missingIndexWorkspaceRootDir = path.join(tempRoot, 'workspace-missing-index');
  const missingIndexPnpmStoreDir = path.join(missingIndexWorkspaceRootDir, 'node_modules', '.pnpm');
  const missingIndexGlobalStoreRootDir = path.join(tempRoot, 'global-store-missing-index', 'v10');
  await mkdir(missingIndexPnpmStoreDir, { recursive: true });
  await mkdir(missingIndexGlobalStoreRootDir, { recursive: true });

  const missingIndexPackageRoot = await createStorePackage(
    missingIndexPnpmStoreDir,
    'missing-index-package@1.0.0',
    'missing-index-package',
    '1.0.0',
    {
      main: 'index.js',
    },
  );
  await rm(path.join(missingIndexPackageRoot, 'index.js'), { force: true });

  const missingIndexReport = await repairPnpmStoreFiles({
    workspaceRootDir: missingIndexWorkspaceRootDir,
    pnpmStoreDir: missingIndexPnpmStoreDir,
    globalStoreRootDir: missingIndexGlobalStoreRootDir,
    logger: () => {},
  });

  assert.equal(missingIndexReport.damagedPackages.length, 1);
  assert.equal(missingIndexReport.restored.length, 0);
  assert.equal(missingIndexReport.skipped.length, 1);

  console.log('ok - pnpm store file repair restores missing package files from the local pnpm content store');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
