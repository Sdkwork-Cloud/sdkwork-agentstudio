import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const requiredPackages = [
  ['packages/sdkwork-clawstudio-web', '@sdkwork/clawstudio-web'],
  ['packages/sdkwork-clawstudio-desktop', '@sdkwork/clawstudio-desktop'],
  ['packages/sdkwork-clawstudio-server', '@sdkwork/clawstudio-server'],
  ['packages/sdkwork-clawstudio-shell', '@sdkwork/clawstudio-shell'],
  ['packages/sdkwork-clawstudio-commons', '@sdkwork/clawstudio-commons'],
  ['packages/sdkwork-clawstudio-ui', '@sdkwork/clawstudio-ui'],
  ['packages/sdkwork-clawstudio-core', '@sdkwork/clawstudio-core'],
  ['packages/sdkwork-clawstudio-host-core', '@sdkwork/clawstudio-host-core'],
  ['packages/sdkwork-clawstudio-i18n', '@sdkwork/clawstudio-i18n'],
  ['packages/sdkwork-clawstudio-types', '@sdkwork/clawstudio-types'],
  ['packages/sdkwork-clawstudio-distribution', '@sdkwork/clawstudio-distribution'],
  ['packages/sdkwork-clawstudio-account', '@sdkwork/clawstudio-account'],
  ['packages/sdkwork-clawstudio-agent', '@sdkwork/clawstudio-agent'],
  ['packages/sdkwork-clawstudio-auth', '@sdkwork/clawstudio-auth'],
  ['packages/sdkwork-clawstudio-center', '@sdkwork/clawstudio-center'],
  ['packages/sdkwork-clawstudio-channels', '@sdkwork/clawstudio-channels'],
  ['packages/sdkwork-clawstudio-chat', '@sdkwork/clawstudio-chat'],
  ['packages/sdkwork-clawstudio-community', '@sdkwork/clawstudio-community'],
  ['packages/sdkwork-clawstudio-dashboard', '@sdkwork/clawstudio-dashboard'],
  ['packages/sdkwork-clawstudio-devices', '@sdkwork/clawstudio-devices'],
  ['packages/sdkwork-clawstudio-docs', '@sdkwork/clawstudio-docs'],
  ['packages/sdkwork-clawstudio-extensions', '@sdkwork/clawstudio-extensions'],
  ['packages/sdkwork-clawstudio-instances', '@sdkwork/clawstudio-instances'],
  ['packages/sdkwork-clawstudio-settings', '@sdkwork/clawstudio-settings'],
  ['packages/sdkwork-clawstudio-tasks', '@sdkwork/clawstudio-tasks'],
];

const errors = [];
const workspaceConfig = path.join(root, 'pnpm-workspace.yaml');

function assertExists(relPath, label) {
  if (!fs.existsSync(path.join(root, relPath))) {
    errors.push(`Missing ${label}: ${relPath}`);
  }
}

function assertWorkspaceTargetsSdkworkPackages() {
  if (!fs.existsSync(workspaceConfig)) {
    errors.push('Missing pnpm workspace config: pnpm-workspace.yaml');
    return;
  }

  const source = fs.readFileSync(workspaceConfig, 'utf8');
  if (!source.includes("'packages/sdkwork-clawstudio-*'")) {
    errors.push("pnpm-workspace.yaml must include only the sdkwork-claw workspace glob.");
  }
  if (source.includes("'packages/*'")) {
    errors.push("pnpm-workspace.yaml must not include the legacy packages/* workspace glob.");
  }
  if (source.includes('claw-studio-')) {
    errors.push('pnpm-workspace.yaml must not include legacy claw-studio package globs.');
  }
}

function assertPackageName(relPath, expectedName) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    errors.push(`Missing package.json: ${relPath}`);
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (pkg.name !== expectedName) {
    errors.push(`Unexpected package name in ${relPath}: expected ${expectedName}, got ${pkg.name ?? '<missing>'}`);
  }
}

function scanForLegacyBridgeReferences(absPath) {
  if (!fs.existsSync(absPath)) {
    return;
  }

  const stack = [absPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isFile()) {
      const source = fs.readFileSync(current, 'utf8');
      if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
        errors.push(`Legacy claw-studio bridge reference remains in ${path.relative(root, current)}`);
      }
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (!/\.(ts|tsx|json)$/.test(entry.name)) {
        continue;
      }

      const source = fs.readFileSync(full, 'utf8');
      if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
        errors.push(`Legacy claw-studio bridge reference remains in ${path.relative(root, full)}`);
      }
    }
  }
}

function assertNoLegacyPackageDirs() {
  if (!fs.existsSync(packagesDir)) {
    return;
  }

  const legacyDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('claw-studio-'))
    .map((entry) => entry.name)
    .sort();

  for (const dirName of legacyDirs) {
    errors.push(`Legacy package directory must be removed: packages/${dirName}`);
  }
}

function scanPackageManifestForLegacyDeps(relPath) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const section of sections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== 'object') {
      continue;
    }

    for (const dependencyName of Object.keys(deps)) {
      if (dependencyName.startsWith('@sdkwork/clawstudio-studio-')) {
        errors.push(`Legacy dependency ${dependencyName} remains in ${relPath}`);
      }
    }
  }
}

assertWorkspaceTargetsSdkworkPackages();
assertNoLegacyPackageDirs();

for (const [dir, pkgName] of requiredPackages) {
  assertExists(dir, 'package directory');
  const packageJsonPath = path.join(dir, 'package.json');
  assertPackageName(packageJsonPath, pkgName);
  scanPackageManifestForLegacyDeps(packageJsonPath);
  scanForLegacyBridgeReferences(path.join(root, dir, 'src'));
  scanForLegacyBridgeReferences(path.join(root, dir, 'tsconfig.json'));
  scanForLegacyBridgeReferences(path.join(root, dir, 'vite.config.ts'));
}

if (errors.length > 0) {
  console.error('SDKWork Claw structure check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SDKWork Claw structure check passed.');
