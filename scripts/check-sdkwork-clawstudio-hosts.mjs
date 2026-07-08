import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relPath) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    errors.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function assertIncludes(relPath, pattern, label) {
  const source = read(relPath);
  if (source && !source.includes(pattern)) {
    errors.push(`Missing ${label} in ${relPath}`);
  }
}

function assertIncludesOneOf(relPath, patterns, label) {
  const source = read(relPath);
  if (!source) {
    return;
  }

  if (patterns.some((pattern) => source.includes(pattern))) {
    return;
  }

  errors.push(`Missing ${label} in ${relPath}`);
}

function assertAnyIncludes(relPaths, pattern, label) {
  const sources = relPaths.map((relPath) => ({
    relPath,
    source: read(relPath),
  }));
  if (sources.some(({ source }) => source.includes(pattern))) {
    return;
  }
  errors.push(`Missing ${label} in any of: ${relPaths.join(', ')}`);
}

function assertTopLevelSourceLayout(relDir, { allowedFiles = [], allowedDirs = [], label }) {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) {
    errors.push(`Missing ${label}: ${relDir}`);
    return;
  }

  const allowedFileSet = new Set(allowedFiles);
  const allowedDirSet = new Set(allowedDirs);

  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!allowedDirSet.has(entry.name)) {
        errors.push(`Unexpected directory in ${label}: ${path.join(relDir, entry.name)}`);
      }
      continue;
    }

    if (!allowedFileSet.has(entry.name)) {
      errors.push(`Unexpected file in ${label}: ${path.join(relDir, entry.name)}`);
    }
  }
}

function assertNoForbiddenDirs(relDir, forbiddenDirs, label) {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) {
    errors.push(`Missing ${label}: ${relDir}`);
    return;
  }

  const forbiddenSet = new Set(forbiddenDirs);
  const stack = [absDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }

      if (forbiddenSet.has(entry.name)) {
        errors.push(`Forbidden directory in ${label}: ${path.relative(root, full)}`);
      }

      stack.push(full);
    }
  }
}

assertIncludes('packages/sdkwork-clawstudio-web/src/App.tsx', '@sdkwork/clawstudio-shell', 'web host shell dependency');
assertIncludes('packages/sdkwork-clawstudio-web/src/main.tsx', 'bootstrapShellRuntime', 'web host shell bootstrap');
assertIncludes('packages/sdkwork-clawstudio-desktop/package.json', '@sdkwork/clawstudio-shell', 'desktop package shell dependency');
assertIncludes('packages/sdkwork-clawstudio-desktop/src/main.tsx', 'createDesktopApp', 'desktop host bootstrap entry');
assertIncludes('packages/sdkwork-clawstudio-server/package.json', '@sdkwork/clawstudio-host-core', 'server package host-core dependency');
assertIncludes('packages/sdkwork-clawstudio-host-core/package.json', '@sdkwork/clawstudio-host-core', 'host-core package name');
read('packages/sdkwork-clawstudio-server/src-host/Cargo.toml');
read('packages/sdkwork-clawstudio-host-core/src-host/Cargo.toml');
assertIncludes(
  'packages/sdkwork-clawstudio-web/vite.config.ts',
  'allow:',
  'web Vite external workspace fs allow list',
);
assertIncludesOneOf(
  'packages/sdkwork-clawstudio-web/vite.config.ts',
  [
    '../../../../..',
    "const monorepoRoot = path.resolve(canonicalWorkspaceRootDir, '../..');",
  ],
  'web Vite monorepo fs allow root',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/vite.config.ts',
  'allow:',
  'desktop Vite external workspace fs allow list',
);
assertIncludesOneOf(
  'packages/sdkwork-clawstudio-desktop/vite.config.ts',
  [
    '../../../../..',
    "const monorepoRoot = path.resolve(canonicalWorkspaceRootDir, '../..');",
  ],
  'desktop Vite monorepo fs allow root',
);
assertAnyIncludes(
  [
    'packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
    'packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  ],
  '@sdkwork/clawstudio-shell',
  'desktop host shell dependency',
);
assertIncludes('packages/sdkwork-clawstudio-shell/package.json', '@sdkwork/clawstudio-core', 'shell core dependency');
assertTopLevelSourceLayout('packages/sdkwork-clawstudio-web/src', {
  allowedFiles: ['App.tsx', 'externalModules.d.ts', 'index.ts', 'main.tsx', 'vite-env.d.ts'],
  allowedDirs: [],
  label: 'web host source root',
});
assertTopLevelSourceLayout('packages/sdkwork-clawstudio-desktop/src', {
  allowedFiles: ['index.ts', 'main.tsx', 'vite-env.d.ts'],
  allowedDirs: ['desktop'],
  label: 'desktop host source root',
});
assertTopLevelSourceLayout('packages/sdkwork-clawstudio-shell/src', {
  allowedFiles: ['index.ts'],
  allowedDirs: ['application', 'components', 'styles'],
  label: 'shell source root',
});
assertNoForbiddenDirs(
  'packages/sdkwork-clawstudio-shell/src',
  ['services', 'store', 'stores', 'hooks', 'platform', 'platform-impl'],
  'shell source tree',
);
assertNoForbiddenDirs(
  'packages/sdkwork-clawstudio-web/src',
  ['services', 'store', 'stores', 'hooks', 'platform', 'platform-impl', 'pages'],
  'web host source tree',
);
assertNoForbiddenDirs(
  'packages/sdkwork-clawstudio-desktop/src',
  ['services', 'store', 'stores', 'hooks', 'pages'],
  'desktop host source tree',
);

const featurePackageDirs = fs.existsSync(path.join(root, 'packages'))
  ? fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-clawstudio-'))
      .map((entry) => entry.name)
      .filter((name) => !['sdkwork-clawstudio-web', 'sdkwork-clawstudio-desktop', 'sdkwork-clawstudio-shell', 'sdkwork-clawstudio-commons', 'sdkwork-clawstudio-ui', 'sdkwork-clawstudio-core', 'sdkwork-clawstudio-i18n', 'sdkwork-clawstudio-types', 'sdkwork-clawstudio-distribution'].includes(name))
  : [];

for (const dir of featurePackageDirs) {
  const srcDir = path.join(root, 'packages', dir, 'src');
  if (!fs.existsSync(srcDir)) continue;

  const stack = [srcDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const source = fs.readFileSync(full, 'utf8');
      if (source.includes('@tauri-apps/api')) {
        errors.push(`Feature package must not import Tauri APIs directly: ${path.relative(root, full)}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('SDKWork Claw host check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SDKWork Claw host check passed.');
