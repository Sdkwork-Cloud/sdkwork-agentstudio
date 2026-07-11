import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const requiredPackages = [
  ['packages/sdkwork-agentstudio-pc-web', '@sdkwork/agentstudio-pc-web'],
  ['packages/sdkwork-agentstudio-pc-desktop', '@sdkwork/agentstudio-pc-desktop'],
  ['packages/sdkwork-agentstudio-pc-server', '@sdkwork/agentstudio-pc-server'],
  ['packages/sdkwork-agentstudio-pc-shell', '@sdkwork/agentstudio-pc-shell'],
  ['packages/sdkwork-agentstudio-pc-commons', '@sdkwork/agentstudio-pc-commons'],
  ['packages/sdkwork-agentstudio-pc-ui', '@sdkwork/agentstudio-pc-ui'],
  ['packages/sdkwork-agentstudio-pc-core', '@sdkwork/agentstudio-pc-core'],
  ['packages/sdkwork-agentstudio-pc-host-core', '@sdkwork/agentstudio-pc-host-core'],
  ['packages/sdkwork-agentstudio-pc-i18n', '@sdkwork/agentstudio-pc-i18n'],
  ['packages/sdkwork-agentstudio-pc-types', '@sdkwork/agentstudio-pc-types'],
  ['packages/sdkwork-agentstudio-pc-distribution', '@sdkwork/agentstudio-pc-distribution'],
  ['packages/sdkwork-agentstudio-pc-account', '@sdkwork/agentstudio-pc-account'],
  ['packages/sdkwork-agentstudio-pc-agent', '@sdkwork/agentstudio-pc-agent'],
  ['packages/sdkwork-agentstudio-pc-auth', '@sdkwork/agentstudio-pc-auth'],
  ['packages/sdkwork-agentstudio-pc-center', '@sdkwork/agentstudio-pc-center'],
  ['packages/sdkwork-agentstudio-pc-channels', '@sdkwork/agentstudio-pc-channels'],
  ['packages/sdkwork-agentstudio-pc-chat', '@sdkwork/agentstudio-pc-chat'],
  ['packages/sdkwork-agentstudio-pc-community', '@sdkwork/agentstudio-pc-community'],
  ['packages/sdkwork-agentstudio-pc-dashboard', '@sdkwork/agentstudio-pc-dashboard'],
  ['packages/sdkwork-agentstudio-pc-devices', '@sdkwork/agentstudio-pc-devices'],
  ['packages/sdkwork-agentstudio-pc-docs', '@sdkwork/agentstudio-pc-docs'],
  ['packages/sdkwork-agentstudio-pc-extensions', '@sdkwork/agentstudio-pc-extensions'],
  ['packages/sdkwork-agentstudio-pc-instances', '@sdkwork/agentstudio-pc-instances'],
  ['packages/sdkwork-agentstudio-pc-settings', '@sdkwork/agentstudio-pc-settings'],
  ['packages/sdkwork-agentstudio-pc-tasks', '@sdkwork/agentstudio-pc-tasks'],
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
    errors.push('Missing pnpm\u2019s workspace config: pnpm-workspace.yaml');
    return;
  }

  const source = fs.readFileSync(workspaceConfig, 'utf8');
  if (!source.includes("'packages/sdkwork-agentstudio-pc-*'")) {
    errors.push("pnpm-workspace.yaml must include only the sdkwork-claw workspace glob.");
  }
  if (source.includes("'packages/*'")) {
    errors.push("pnpm-workspace.yaml must not include the legacy packages/* workspace glob.");
  }
  if (source.includes('agent-studio-')) {
    errors.push('pnpm-workspace.yaml must not include legacy agent-studio package globs.');
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
      if (/@sdkwork\/agent-studio-/.test(source) || /(?:\.\.\/)+agent-studio-/.test(source)) {
        errors.push(`Legacy agent-studio bridge reference remains in ${path.relative(root, current)}`);
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
      if (/@sdkwork\/agent-studio-/.test(source) || /(?:\.\.\/)+agent-studio-/.test(source)) {
        errors.push(`Legacy agent-studio bridge reference remains in ${path.relative(root, full)}`);
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
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('agent-studio-'))
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
      if (dependencyName.startsWith('@sdkwork/agentstudio-pc-studio-')) {
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
