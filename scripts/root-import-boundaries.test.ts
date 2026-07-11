import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function getImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const imports: string[] = [];
  const importPattern = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match: RegExpExecArray | null = null;
  while ((match = importPattern.exec(source))) {
    const importPath = match[1] || match[2];
    if (importPath?.startsWith('@sdkwork/agentstudio-pc-')) {
      imports.push(importPath);
    }
  }

  return imports;
}

function toPackageName(importPath: string) {
  const parts = importPath.split('/');
  return `${parts[0]}/${parts[1]}`;
}

function getCurrentPackageName(file: string) {
  const relativePath = path.relative(packagesDir, file);
  const [packageDir] = relativePath.split(path.sep);
  return `@sdkwork/${packageDir.replace(/^sdkwork-/, '')}`;
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('cross-package imports use package roots only', () => {
  const packageDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-agentstudio-pc-'))
    .map((entry) => entry.name);

  const violations: string[] = [];

  for (const packageDir of packageDirs) {
    const srcDir = path.join(packagesDir, packageDir, 'src');
    const files = listSourceFiles(srcDir);

    for (const file of files) {
      const fromPackage = getCurrentPackageName(file);

      for (const importPath of getImports(file)) {
        const targetPackage = toPackageName(importPath);
        const isCrossPackage = fromPackage !== targetPackage;
        const isRootImport = importPath === targetPackage;

        if (isCrossPackage && !isRootImport) {
          violations.push(
            `${path.relative(root, file)} -> ${importPath}`,
          );
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found cross-package subpath imports:\n${violations.join('\n')}`,
  );
});
