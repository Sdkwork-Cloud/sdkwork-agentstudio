import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function walkFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }

      files.push(...walkFiles(absolutePath));
      continue;
    }

    if (absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx')) {
      files.push(absolutePath);
    }
  }

  return files;
}

runTest('feature packages use the shared DateInput instead of direct type="date" wiring', () => {
  const packagesRoot = path.join(root, 'packages');
  const violations: string[] = [];

  for (const filePath of walkFiles(packagesRoot)) {
    const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');

    if (relativePath.startsWith('packages/sdkwork-agentstudio-pc-ui/')) {
      continue;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const matches = source.matchAll(/type=(['"])date\1/g);

    for (const match of matches) {
      const startIndex = match.index ?? 0;
      const lineNumber = source.slice(0, startIndex).split('\n').length;
      violations.push(`${relativePath}:${lineNumber} contains direct date input wiring`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Direct date input usage remains outside @sdkwork/agentstudio-pc-ui:\n${violations.join('\n')}`,
  );
});
