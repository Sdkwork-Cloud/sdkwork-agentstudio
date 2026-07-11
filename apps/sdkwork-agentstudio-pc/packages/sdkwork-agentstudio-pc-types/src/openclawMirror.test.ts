import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'openclawMirror runtime contract exposes configFile instead of legacy configPath',
  async () => {
    const source = await readFile(new URL('./openclawMirror.ts', import.meta.url), 'utf8');

    assert.match(source, /configFile:\s*string;/);
    assert.doesNotMatch(source, /configPath:\s*string;/);
  },
);
