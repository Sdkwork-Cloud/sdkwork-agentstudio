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
  'openClawLocalProxyProjectionService delegates proxy baseUrl normalization to the shared provider formatter authority',
  async () => {
    const source = await readFile(
      new URL('./openClawLocalProxyProjectionService.ts', import.meta.url),
      'utf8',
    );

    assert.match(
      source,
      /import\s*{\s*normalizeOpenClawProviderEndpoint\s*}\s*from\s*'\.\/openClawProviderFormatService\.ts';/,
    );
    assert.doesNotMatch(source, /function\s+normalizeLoopbackBaseUrl\s*\(/);
    assert.match(source, /normalizeOpenClawProviderEndpoint\(input\.proxyBaseUrl\)/);
    assert.match(source, /return normalized \? normalizeOpenClawProviderEndpoint\(normalized\) : null;/);
  },
);
