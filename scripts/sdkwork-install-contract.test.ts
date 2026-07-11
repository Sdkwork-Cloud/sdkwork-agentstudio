import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const removedInstallFeaturePackage = ['sdkwork', 'claw', 'install'].join('-');
const removedInstallWorkspacePath = ['packages', removedInstallFeaturePackage].join('/');
const removedInstallDependencyName = ['@sdkwork', ['claw', 'install'].join('-')].join('/');
const removedSetupPattern = new RegExp([
  ['hub', 'installer'].join('[-_ ]?'),
  ['hub', 'installer'].join(''),
  ['installer', 'hub'].join('[-_ ]?'),
  ['Hub', 'Installer'].join(''),
  ['HUB', 'INSTALLER'].join('_'),
].join('|'), 'i');
const removedInstallImportPattern = new RegExp(
  removedInstallDependencyName.replace('/', '\\/'),
);
const removedInstallPrefetchPattern = new RegExp(
  `\\['\\/install',\\s*\\(\\)\\s*=>\\s*import\\('${removedInstallDependencyName.replace('/', '\\/')}'\\)\\]`,
);

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

const scannedTextExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.md',
  '.mjs',
  '.rs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const ignoredScanDirs = new Set([
  '.git',
  '.turbo',
  'dist',
  'node_modules',
  'target',
]);

function shouldScanFile(absPath: string) {
  const ext = path.extname(absPath);
  return scannedTextExtensions.has(ext) || path.basename(absPath) === 'package.json';
}

function collectScannedFiles(relPath: string): string[] {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    return [];
  }

  const stats = fs.statSync(absPath);
  if (stats.isFile()) {
    return shouldScanFile(absPath) ? [relPath] : [];
  }

  if (!stats.isDirectory() || ignoredScanDirs.has(path.basename(absPath))) {
    return [];
  }

  return fs.readdirSync(absPath, { withFileTypes: true }).flatMap((entry) => {
    const childRelPath = path.join(relPath, entry.name);
    if (entry.isDirectory() && ignoredScanDirs.has(entry.name)) {
      return [];
    }

    return collectScannedFiles(childRelPath);
  });
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('removed install feature package stays deleted and shell remains free of install-route wiring', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-agentstudio-pc-shell/package.json',
  );
  const appRoutesSource = read('packages/sdkwork-agentstudio-pc-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read(
    'packages/sdkwork-agentstudio-pc-shell/src/application/router/routePaths.ts',
  );
  const routePrefetchSource = read(
    'packages/sdkwork-agentstudio-pc-shell/src/application/router/routePrefetch.ts',
  );
  const sidebarSource = read('packages/sdkwork-agentstudio-pc-shell/src/components/Sidebar.tsx');
  const routeSurface = read('scripts/fixtures/agent-studio-v5-route-surface.json');

  assert.ok(!exists(`${removedInstallWorkspacePath}/package.json`));
  assert.ok(!exists(`${removedInstallWorkspacePath}/src`));
  assert.ok(!shellPackage.dependencies?.[removedInstallDependencyName]);
  assert.doesNotMatch(appRoutesSource, removedInstallImportPattern);
  assert.doesNotMatch(appRoutesSource, /path="\/install"/);
  assert.doesNotMatch(routePathsSource, /INSTALL(_DETAIL)?:\s*'\/install/);
  assert.doesNotMatch(routePrefetchSource, removedInstallPrefetchPattern);
  assert.doesNotMatch(sidebarSource, /id:\s*'install'/);
  assert.doesNotMatch(sidebarSource, /to:\s*'\/install'/);
  assert.doesNotMatch(routeSurface, /"\/install"/);
  assert.doesNotMatch(routeSurface, /"\/install\/:method"/);
});

runTest('removed setup product leaves no source, script, docs, or config residue', () => {
  const scannedFiles = [
    '.env.example',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'config',
    'docs',
    'packages',
    'scripts',
  ].flatMap(collectScannedFiles);
  const matches = scannedFiles.filter((relPath) => removedSetupPattern.test(read(relPath)));

  assert.deepEqual(matches, []);
});

runTest('Agent Studio routes OpenClaw setup through docs or instance onboarding instead of the removed install page', () => {
  const clawDetailSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawDetail.tsx');
  const clawUploadSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawUpload.tsx');
  const instancesSource = read('packages/sdkwork-agentstudio-pc-instances/src/pages/Instances.tsx');
  const warmPolicySource = read(
    'packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.ts',
  );

  assert.doesNotMatch(clawDetailSource, /navigate\('\/install\?product=openclaw'\)/);
  assert.doesNotMatch(clawUploadSource, /navigate\('\/install'\)/);
  assert.doesNotMatch(instancesSource, /navigate\('\/install\?product=openclaw'\)/);
  assert.doesNotMatch(warmPolicySource, /pathname === '\/install'/);
  assert.doesNotMatch(warmPolicySource, /pathname\.startsWith\('\/install\/'\)/);
});
