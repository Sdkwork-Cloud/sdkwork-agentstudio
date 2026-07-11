import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('workspace packages expose root exports only', () => {
  const violations: string[] = [];
  const packageDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-agentstudio-pc-'));

  for (const packageDir of packageDirs) {
    const packageJsonPath = path.join(packagesDir, packageDir.name, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string;
      exports?: string | Record<string, string>;
    };

    if (!packageJson.name?.startsWith('@sdkwork/agentstudio-pc-')) {
      continue;
    }

    if (!packageJson.exports || typeof packageJson.exports === 'string') {
      continue;
    }

    const exportKeys = Object.keys(packageJson.exports);
    const nonRootExports = exportKeys.filter((key) => key !== '.');

    if (nonRootExports.length > 0) {
      violations.push(
        `${packageDir.name}: ${nonRootExports.join(', ')}`,
      );
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found package subpath exports:\n${violations.join('\n')}`,
  );
});
