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
  'web studio runtime detail fallback preserves future kernel identity without hardcoded per-kernel branching',
  async () => {
    const source = await readFile(new URL('./webStudio.ts', import.meta.url), 'utf8');

    assert.match(source, /const WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS:/);
    assert.match(source, /function resolveWebStudioRuntimeLabel\(runtimeKind: string \| undefined\)/);
    assert.match(source, /title: `\$\{runtimeLabel\} runtime`/);
    assert.match(source, /This instance uses the \$\{runtimeLabel\} runtime binding\./);
    assert.doesNotMatch(source, /title: 'Custom runtime'/);
    assert.doesNotMatch(source, /input\.runtimeKind === 'openclaw'/);
    assert.doesNotMatch(source, /if \(instance\.runtimeKind === 'zeroclaw'/);
    assert.doesNotMatch(source, /if \(instance\.runtimeKind === 'ironclaw'/);
  },
);
