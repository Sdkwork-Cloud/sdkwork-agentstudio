import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const allPackageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-clawstudio-'))
  .map((entry) => entry.name);

const shared = new Set([
  'sdkwork-clawstudio-web',
  'sdkwork-clawstudio-desktop',
  'sdkwork-clawstudio-host-core',
  'sdkwork-clawstudio-host-studio',
  'sdkwork-clawstudio-shell',
  'sdkwork-clawstudio-commons',
  'sdkwork-clawstudio-core',
  'sdkwork-clawstudio-infrastructure',
  'sdkwork-clawstudio-types',
  'sdkwork-clawstudio-i18n',
  'sdkwork-clawstudio-ui',
  'sdkwork-clawstudio-distribution',
  'sdkwork-clawstudio-server',
]);

const featureDirs = allPackageDirs.filter((dir) => !shared.has(dir));
const knownVersions = {};

for (const dir of allPackageDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const entries = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };

  for (const [name, version] of Object.entries(entries)) {
    if (typeof version !== 'string' || version.startsWith('workspace:')) continue;
    if (!knownVersions[name]) knownVersions[name] = version;
  }
}

const fallbackVersions = {
  '@types/react': '^19.2.2',
  '@types/react-dom': '^19.2.2',
};

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(item.name)) out.push(full);
  }
  return out;
}

function parseImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  const pattern = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = pattern.exec(text))) {
    out.push(match[1] || match[2]);
  }

  return out;
}

function normalize(dep) {
  if (dep.startsWith('.') || dep.startsWith('/')) return null;
  if (dep.startsWith('@sdkwork/')) {
    const [scope, name] = dep.split('/');
    return `${scope}/${name}`;
  }
  if (dep.startsWith('@tauri-apps/api/')) return '@tauri-apps/api';
  if (dep.startsWith('motion/')) return 'motion';
  if (dep.startsWith('react-syntax-highlighter/')) return 'react-syntax-highlighter';
  if (dep.startsWith('@tiptap/')) {
    const [scope, name] = dep.split('/');
    return `${scope}/${name}`;
  }
  if (dep.startsWith('@tanstack/')) {
    const [scope, name] = dep.split('/');
    return `${scope}/${name}`;
  }
  if (dep.startsWith('@types/')) {
    const [scope, name] = dep.split('/');
    return `${scope}/${name}`;
  }
  return dep.split('/')[0];
}

function writeIndex(file, exportsList) {
  const unique = [...new Set(exportsList)].sort();
  fs.writeFileSync(file, unique.length === 0 ? 'export {};\n' : `${unique.map((entry) => `export * from '${entry}';`).join('\n')}\n`);
}

function writeIndexIfDirExists(dir, file, exportsList) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return;
  }

  writeIndex(file, exportsList);
}

function collectRootExports(srcDir) {
  if (!fs.existsSync(srcDir)) {
    return [];
  }

  const exportsList = [];
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      if (!/\.(ts|tsx)$/.test(entry.name) || /(?:^|[\\/])index\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      if (/\.test\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      exportsList.push(`./${entry.name.replace(/\.(ts|tsx)$/, '')}`);
      continue;
    }

    if (!entry.isDirectory() || entry.name === 'components' || entry.name === 'pages') {
      continue;
    }

    const hasIndex = ['index.ts', 'index.tsx'].some((fileName) =>
      fs.existsSync(path.join(srcDir, entry.name, fileName)),
    );
    if (hasIndex) {
      exportsList.push(`./${entry.name}`);
    }
  }

  return exportsList;
}

for (const dir of featureDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const srcDir = path.join(packagesDir, dir, 'src');
  const files = listSourceFiles(srcDir);

  const deps = new Set();
  for (const file of files) {
    for (const importPath of parseImports(file)) {
      const normalized = normalize(importPath);
      if (normalized) deps.add(normalized);
    }
  }

  deps.add('@types/react');
  deps.add('@types/react-dom');

  const dependencyMap = {};
  for (const dep of [...deps].sort()) {
    if (dep.startsWith('@sdkwork/')) dependencyMap[dep] = 'workspace:*';
    else if (knownVersions[dep]) dependencyMap[dep] = knownVersions[dep];
    else if (fallbackVersions[dep]) dependencyMap[dep] = fallbackVersions[dep];
  }

  pkg.dependencies = dependencyMap;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const componentsDir = path.join(srcDir, 'components');
  const componentExports = listSourceFiles(componentsDir)
    .filter((file) => !/(?:^|[\\/])index\.(ts|tsx)$/.test(file))
    .map((file) => `./${path.relative(componentsDir, file).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '')}`);

  const servicesDir = path.join(srcDir, 'services');
  const serviceExports = listSourceFiles(servicesDir)
    .filter((file) => file.endsWith('.ts') && !/(?:^|[\\/])index\.ts$/.test(file))
    .map((file) => `./${path.relative(servicesDir, file).replace(/\\/g, '/').replace(/\.ts$/, '')}`);

  writeIndexIfDirExists(componentsDir, path.join(srcDir, 'components', 'index.ts'), componentExports);
  writeIndexIfDirExists(servicesDir, path.join(srcDir, 'services', 'index.ts'), serviceExports);
  writeIndex(path.join(srcDir, 'index.ts'), collectRootExports(srcDir));
}

console.log('SDKWork feature package dependencies and index exports synchronized.');
