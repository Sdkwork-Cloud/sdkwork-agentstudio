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

let providerFormatServiceModule:
  | typeof import('./openClawProviderFormatService.ts')
  | undefined;

try {
  providerFormatServiceModule = await import('./openClawProviderFormatService.ts');
} catch {
  providerFormatServiceModule = undefined;
}

await runTest(
  'openClawProviderFormatService exposes shared provider endpoint and api-key normalization helpers',
  () => {
    assert.ok(providerFormatServiceModule, 'Expected openClawProviderFormatService.ts to exist');
    assert.equal(
      typeof providerFormatServiceModule?.normalizeOpenClawProviderEndpoint,
      'function',
    );
    assert.equal(
      typeof providerFormatServiceModule?.describeOpenClawSecretSource,
      'function',
    );
    assert.equal(
      typeof providerFormatServiceModule?.presentOpenClawProviderApiKeySource,
      'function',
    );
    assert.equal(
      typeof providerFormatServiceModule?.normalizeOpenClawProviderApiKeySource,
      'function',
    );
    assert.equal(
      typeof providerFormatServiceModule?.serializeOpenClawProviderApiKeySource,
      'function',
    );
  },
);

await runTest(
  'openClawProviderFormatService normalizes provider endpoints and user-facing api-key sources through one authority',
  () => {
    assert.equal(
      providerFormatServiceModule?.normalizeOpenClawProviderEndpoint(
        ' https://api.openai.com/v1/ ',
      ),
      'https://api.openai.com/v1',
    );
    assert.equal(
      providerFormatServiceModule?.describeOpenClawSecretSource('${OPENAI_API_KEY}'),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      providerFormatServiceModule?.presentOpenClawProviderApiKeySource('  sk-live-secret  '),
      'sk-live-secret',
    );
    assert.equal(
      providerFormatServiceModule?.presentOpenClawProviderApiKeySource('${OPENAI_API_KEY}'),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      providerFormatServiceModule?.presentOpenClawProviderApiKeySource('   '),
      'not-configured',
    );
    assert.equal(
      providerFormatServiceModule?.normalizeOpenClawProviderApiKeySource(
        '  ${OPENAI_API_KEY}  ',
      ),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      providerFormatServiceModule?.normalizeOpenClawProviderApiKeySource(
        '  env:OPENAI_API_KEY  ',
      ),
      'env:OPENAI_API_KEY',
    );
    assert.equal(
      providerFormatServiceModule?.serializeOpenClawProviderApiKeySource(
        '  env:OPENAI_API_KEY  ',
      ),
      '${OPENAI_API_KEY}',
    );
    assert.equal(
      providerFormatServiceModule?.serializeOpenClawProviderApiKeySource(
        '  ${OPENAI_API_KEY}  ',
      ),
      '${OPENAI_API_KEY}',
    );
    assert.equal(
      providerFormatServiceModule?.serializeOpenClawProviderApiKeySource(
        '  sk-live-secret  ',
      ),
      'sk-live-secret',
    );
  },
);
