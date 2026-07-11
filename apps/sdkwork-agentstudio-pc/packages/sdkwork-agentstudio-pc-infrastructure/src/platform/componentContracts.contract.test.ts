import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'desktop component contracts stop baking kernel ids into the generic component catalog contract',
  async () => {
    const contractsSource = await readFile(
      new URL('./contracts/components.ts', import.meta.url),
      'utf8',
    );
    const librarySource = await readFile(
      new URL('./componentLibrary.ts', import.meta.url),
      'utf8',
    );
    const indexSource = await readFile(new URL('./index.ts', import.meta.url), 'utf8');

    assert.match(
      contractsSource,
      /export type KnownRuntimeBundledComponentId =\s*never;/,
    );
    assert.match(
      contractsSource,
      /export type RuntimeBundledComponentId =\s*\|\s*KnownRuntimeBundledComponentId\s*\|\s*\(string & \{\}\);/,
    );
    assert.doesNotMatch(
      contractsSource,
      /'openclaw'|'zeroclaw'|'ironclaw'|'hermes'/,
    );

    assert.match(librarySource, /KnownRuntimeBundledComponentId,/);
    assert.match(
      librarySource,
      /export const BUNDLED_COMPONENT_IDS: KnownRuntimeBundledComponentId\[] = \[\];/,
    );
    assert.match(
      librarySource,
      /export function isBundledComponentId\(value: string\): value is KnownRuntimeBundledComponentId/,
    );

    assert.match(indexSource, /KnownRuntimeBundledComponentId,/);
  },
);
