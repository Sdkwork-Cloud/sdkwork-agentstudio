import assert from 'node:assert/strict';

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

let secretFormatServiceModule:
  | typeof import('./openClawSecretFormatService.ts')
  | undefined;

try {
  secretFormatServiceModule = await import('./openClawSecretFormatService.ts');
} catch {
  secretFormatServiceModule = undefined;
}

await runTest(
  'openClawSecretFormatService exposes shared secret-source normalization and serialization helpers',
  () => {
    assert.ok(secretFormatServiceModule, 'Expected openClawSecretFormatService.ts to exist');
    assert.equal(typeof secretFormatServiceModule?.describeOpenClawSecretSource, 'function');
    assert.equal(typeof secretFormatServiceModule?.normalizeOpenClawSecretSource, 'function');
    assert.equal(typeof secretFormatServiceModule?.serializeOpenClawSecretSource, 'function');
    assert.equal(typeof secretFormatServiceModule?.presentOpenClawSecretSource, 'function');
  },
);

await runTest(
  'openClawSecretFormatService canonicalizes env placeholders into env-prefixed edit values and ${VAR} write values',
  () => {
    assert.equal(
      secretFormatServiceModule?.normalizeOpenClawSecretSource('  ${OPENAI_API_KEY}  '),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      secretFormatServiceModule?.normalizeOpenClawSecretSource('  env:OPENAI_API_KEY  '),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      secretFormatServiceModule?.serializeOpenClawSecretSource(' env:OPENAI_API_KEY '),
      '${OPENAI_API_KEY}',
    );
    assert.equal(
      secretFormatServiceModule?.serializeOpenClawSecretSource(' ${OPENAI_API_KEY} '),
      '${OPENAI_API_KEY}',
    );
    assert.equal(
      secretFormatServiceModule?.presentOpenClawSecretSource('  sk-live-secret  '),
      'sk-live-secret',
    );
    assert.equal(
      secretFormatServiceModule?.presentOpenClawSecretSource('   '),
      'not-configured',
    );
  },
);
