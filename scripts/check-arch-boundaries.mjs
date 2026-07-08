import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const allPackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-clawstudio-'))
  .map((entry) => entry.name);

const packageNameByDir = new Map(
  allPackages.map((dirName) => [dirName, `@sdkwork/${dirName.replace(/^sdkwork-/, '')}`]),
);

const WEB = '@sdkwork/clawstudio-web';
const DESKTOP = '@sdkwork/clawstudio-desktop';
const SHELL = '@sdkwork/clawstudio-shell';
const COMMONS = '@sdkwork/clawstudio-commons';
const CORE = '@sdkwork/clawstudio-core';
const INFRA = '@sdkwork/clawstudio-infrastructure';
const TYPES = '@sdkwork/clawstudio-types';
const UI = '@sdkwork/clawstudio-ui';
const I18N = '@sdkwork/clawstudio-i18n';
const DISTRIBUTION = '@sdkwork/clawstudio-distribution';

const sharedPackages = new Set([
  WEB,
  DESKTOP,
  SHELL,
  COMMONS,
  CORE,
  INFRA,
  TYPES,
  UI,
  I18N,
  DISTRIBUTION,
]);

const featurePackages = [...packageNameByDir.values()].filter((pkg) => !sharedPackages.has(pkg));
const webForbiddenSourceDirs = [
  'services',
  'store',
  'stores',
  'hooks',
  'platform',
  'platform-impl',
];
const structureExpectations = [
  [SHELL, ['application', 'components']],
  [COMMONS, ['components', 'hooks', 'lib']],
  [DESKTOP, ['desktop']],
  [DISTRIBUTION, ['manifests', 'providers']],
  [CORE, ['hooks', 'services', 'stores']],
  [INFRA, ['config', 'http', 'i18n', 'platform', 'services', 'updates']],
];
const forbiddenCoreServiceExports = [
  'apiKeyService',
  'appStoreService',
  'channelService',
  'chatService',
  'clawService',
  'communityService',
  'deviceService',
  'fileDialogService',
  'i18nService',
  'installerService',
  'mySkillService',
  'settingsService',
  'taskService',
];
const allowedFeatureDependencies = new Map([
  ['@sdkwork/clawstudio-chat', new Set(['@sdkwork/clawstudio-settings'])],
  ['@sdkwork/clawstudio-settings', new Set(['@sdkwork/clawstudio-account'])],
]);
const allowedPackageExportKeys = new Map([
  [CORE, new Set(['./sdk'])],
]);
const allowedPackageSubpathImports = new Set([
  '@sdkwork/clawstudio-core/sdk',
]);
const sourceLayoutExpectations = [
  {
    package: WEB,
    allowedFiles: new Set(['App.tsx', 'externalModules.d.ts', 'index.ts', 'main.tsx', 'vite-env.d.ts']),
    allowedDirs: new Set(),
  },
  {
    package: DESKTOP,
    allowedFiles: new Set(['index.ts', 'main.tsx', 'vite-env.d.ts']),
    allowedDirs: new Set(['desktop']),
  },
  {
    package: SHELL,
    allowedFiles: new Set(['index.ts']),
    allowedDirs: new Set(['application', 'components', 'styles']),
  },
];

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(item.name)) {
      out.push(full);
    }
  }
  return out;
}

function getImports(file) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = [];
  const pattern = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    imports.push(match[1] || match[2]);
  }

  return imports;
}

function resolveLocalImportTarget(fromFile, importPath) {
  const absoluteImportBase = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    absoluteImportBase,
    `${absoluteImportBase}.ts`,
    `${absoluteImportBase}.tsx`,
    path.join(absoluteImportBase, 'index.ts'),
    path.join(absoluteImportBase, 'index.tsx'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function isAllowedLocalServiceImport(fromFile, importPath) {
  const target = resolveLocalImportTarget(fromFile, importPath);
  if (!target) {
    return false;
  }

  if (fs.statSync(target).isDirectory()) {
    return target.includes(`${path.sep}services`);
  }

  return /[\\/]services(?:[\\/][^\\/]+)*[\\/]index\.(ts|tsx)$/.test(target);
}

function toPkgName(importPath) {
  const [scope, name] = importPath.split('/');
  return `${scope}/${name}`;
}

function isRootPackageImport(importPath) {
  return importPath === toPkgName(importPath) || allowedPackageSubpathImports.has(importPath);
}

function isAllowed(fromPkg, toPkg) {
  if (fromPkg === WEB) {
    return [WEB, SHELL].includes(toPkg);
  }

  if (fromPkg === DESKTOP) {
    return [DESKTOP, SHELL, DISTRIBUTION, INFRA].includes(toPkg);
  }

  if (fromPkg === SHELL) {
    return [SHELL, COMMONS, CORE, I18N, UI, ...featurePackages].includes(toPkg);
  }

  if (fromPkg === COMMONS) {
    return [COMMONS, CORE, I18N, UI].includes(toPkg);
  }

  if (fromPkg === DISTRIBUTION) {
    return toPkg === DISTRIBUTION;
  }

  if (fromPkg === CORE) {
    return [CORE, INFRA, I18N, TYPES].includes(toPkg);
  }

  if (fromPkg === INFRA) {
    return [INFRA, I18N, TYPES].includes(toPkg);
  }

  if (fromPkg === TYPES || fromPkg === UI || fromPkg === I18N) {
    return toPkg === fromPkg;
  }

  if (featurePackages.includes(fromPkg)) {
    return (
      [fromPkg, COMMONS, CORE, INFRA, I18N, TYPES, UI].includes(toPkg) ||
      allowedFeatureDependencies.get(fromPkg)?.has(toPkg) === true
    );
  }

  return false;
}

const structureViolations = [];
const webShellViolations = [];
const staleImportViolations = [];
const packageExportViolations = [];
const businessBarrelViolations = [];
const localServiceBarrelViolations = [];
const rootImportViolations = [];
const dependencyViolations = [];
const sourceLayoutViolations = [];

for (const expectation of sourceLayoutExpectations) {
  const dirName = expectation.package.replace('@sdkwork/', 'sdkwork-');
  const srcDir = path.join(packagesDir, dirName, 'src');
  if (!fs.existsSync(srcDir)) {
    continue;
  }

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const kind = entry.isDirectory() ? 'dir' : 'file';
    const allowed = entry.isDirectory()
      ? expectation.allowedDirs.has(entry.name)
      : expectation.allowedFiles.has(entry.name);

    if (!allowed) {
      sourceLayoutViolations.push({
        package: expectation.package,
        entry: path.relative(root, path.join(srcDir, entry.name)),
        kind,
      });
    }
  }
}

for (const [pkgName, requiredDirs] of structureExpectations) {
  const dirName = pkgName.replace('@sdkwork/', 'sdkwork-');
  const srcDir = path.join(packagesDir, dirName, 'src');

  for (const requiredDir of requiredDirs) {
    const targetDir = path.join(srcDir, requiredDir);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      structureViolations.push({
        package: pkgName,
        missingDir: path.relative(root, targetDir),
      });
    }
  }
}

{
  const webSrcDir = path.join(packagesDir, 'sdkwork-clawstudio-web', 'src');
  for (const forbiddenDir of webForbiddenSourceDirs) {
    const dir = path.join(webSrcDir, forbiddenDir);
    if (!fs.existsSync(dir)) continue;

    const files = listSourceFiles(dir);
    if (files.length > 0) {
      webShellViolations.push({
        dir: path.relative(root, dir),
        files: files.map((file) => path.relative(root, file)),
      });
    }
  }
}

for (const [dirName, pkgName] of packageNameByDir.entries()) {
  const packageJsonPath = path.join(packagesDir, dirName, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const exportsField = packageJson.exports;

  if (exportsField && typeof exportsField !== 'string') {
    const exportKeys = Object.keys(exportsField);
    const allowedExportKeys = allowedPackageExportKeys.get(pkgName) ?? new Set();
    const nonRootExports = exportKeys.filter(
      (key) => key !== '.' && !allowedExportKeys.has(key),
    );

    if (nonRootExports.length > 0) {
      packageExportViolations.push({
        package: pkgName,
        exportKeys: nonRootExports,
      });
    }
  }

  const srcDir = path.join(packagesDir, dirName, 'src');
  for (const file of listSourceFiles(srcDir)) {
    const source = fs.readFileSync(file, 'utf8');

    if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
      staleImportViolations.push(path.relative(root, file));
    }

    const imports = getImports(file);
    for (const importPath of imports) {
      if (!importPath.startsWith('@sdkwork/clawstudio-')) {
        continue;
      }

      const targetPkg = toPkgName(importPath);
      if (pkgName !== targetPkg && !isRootPackageImport(importPath)) {
        rootImportViolations.push({
          file: path.relative(root, file),
          from: pkgName,
          to: targetPkg,
          importPath,
        });
      }

      if (!isAllowed(pkgName, targetPkg)) {
        dependencyViolations.push({
          file: path.relative(root, file),
          from: pkgName,
          to: targetPkg,
          importPath,
        });
      }
    }

    const isTestFile = /\.test\.(ts|tsx)$/.test(file);
    const isServiceSource = file.includes(`${path.sep}src${path.sep}services${path.sep}`);
    const isBarrelFile = /(?:^|[\\/])index\.(ts|tsx)$/.test(file);

    if (!isTestFile && !isServiceSource && !isBarrelFile) {
      for (const importPath of imports) {
        if (
          /^(\.\.\/|\.\/)+services\/.+/.test(importPath) &&
          !isAllowedLocalServiceImport(file, importPath)
        ) {
          localServiceBarrelViolations.push({
            file: path.relative(root, file),
            importPath,
          });
        }
      }
    }
  }
}

{
  const coreIndexPath = path.join(packagesDir, 'sdkwork-clawstudio-core', 'src', 'index.ts');
  const coreIndexSource = fs.readFileSync(coreIndexPath, 'utf8');

  for (const serviceName of forbiddenCoreServiceExports) {
    if (coreIndexSource.includes(`/services/${serviceName}`)) {
      businessBarrelViolations.push(serviceName);
    }
  }
}

if (
  structureViolations.length > 0 ||
  webShellViolations.length > 0 ||
  staleImportViolations.length > 0 ||
  packageExportViolations.length > 0 ||
  businessBarrelViolations.length > 0 ||
  localServiceBarrelViolations.length > 0 ||
  sourceLayoutViolations.length > 0 ||
  rootImportViolations.length > 0 ||
  dependencyViolations.length > 0
) {
  if (sourceLayoutViolations.length > 0) {
    console.error('Host and shell source layout violations found:\n');
    for (const violation of sourceLayoutViolations) {
      console.error(
        `- ${violation.package}\n  ${violation.kind}: ${violation.entry}\n`,
      );
    }
  }

  if (structureViolations.length > 0) {
    console.error('Package structure violations found:\n');
    for (const violation of structureViolations) {
      console.error(`- ${violation.package}\n  missing: ${violation.missingDir}\n`);
    }
  }

  if (webShellViolations.length > 0) {
    console.error('Web host boundary violations found:\n');
    for (const violation of webShellViolations) {
      console.error(`- ${violation.dir}`);
      for (const file of violation.files) {
        console.error(`  file: ${file}`);
      }
      console.error('');
    }
  }

  if (staleImportViolations.length > 0) {
    console.error('Stale claw-studio bridge references found:\n');
    for (const file of staleImportViolations) {
      console.error(`- ${file}`);
    }
    console.error('');
  }

  if (packageExportViolations.length > 0) {
    console.error('Package root export violations found:\n');
    for (const violation of packageExportViolations) {
      console.error(`- ${violation.package}\n  exports: ${violation.exportKeys.join(', ')}\n`);
    }
  }

  if (businessBarrelViolations.length > 0) {
    console.error('Core package barrel exposes feature-local services:\n');
    for (const serviceName of businessBarrelViolations) {
      console.error(`- @sdkwork/clawstudio-core should not export services/${serviceName}`);
    }
    console.error('');
  }

  if (localServiceBarrelViolations.length > 0) {
    console.error('Local service barrel violations found:\n');
    for (const violation of localServiceBarrelViolations) {
      console.error(`- ${violation.file}\n  import: ${violation.importPath}\n`);
    }
  }

  if (dependencyViolations.length > 0) {
    console.error('Architecture boundary violations found:\n');
    for (const violation of dependencyViolations) {
      console.error(
        `- ${violation.file}\n  ${violation.from} -> ${violation.to}\n  import: ${violation.importPath}\n`,
      );
    }
  }

  if (rootImportViolations.length > 0) {
    console.error('Cross-package root import violations found:\n');
    for (const violation of rootImportViolations) {
      console.error(
        `- ${violation.file}\n  ${violation.from} -> ${violation.to}\n  import: ${violation.importPath}\n`,
      );
    }
  }

  process.exit(1);
}

console.log('Architecture boundary check passed.');
