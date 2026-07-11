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

let configDocumentServiceModule:
  | typeof import('./openClawConfigDocumentService.ts')
  | undefined;
let configServiceModule:
  | typeof import('./openClawConfigService.ts')
  | undefined;

try {
  configDocumentServiceModule = await import('./openClawConfigDocumentService.ts');
} catch {
  configDocumentServiceModule = undefined;
}

try {
  configServiceModule = await import('./openClawConfigService.ts');
} catch {
  configServiceModule = undefined;
}

await runTest(
  'openClawConfigDocumentService exposes parse, analyze, and serialize helpers',
  () => {
    assert.ok(
      configDocumentServiceModule,
      'Expected openClawConfigDocumentService.ts to exist',
    );
    assert.equal(typeof configDocumentServiceModule?.parseOpenClawConfigDocument, 'function');
    assert.equal(typeof configDocumentServiceModule?.analyzeOpenClawConfigDocument, 'function');
    assert.equal(
      typeof configDocumentServiceModule?.serializeOpenClawConfigDocument,
      'function',
    );
  },
);

await runTest(
  'openClawConfigService re-exports mutateOpenClawConfigDocument for document-level config edits',
  () => {
    assert.ok(configServiceModule, 'Expected openClawConfigService.ts to load');
    assert.equal(typeof configServiceModule?.mutateOpenClawConfigDocument, 'function');
  },
);

await runTest(
  'openClawConfigDocumentService prefixes JSON5 syntax failures with openclaw context',
  () => {
    const parsed = configDocumentServiceModule?.parseOpenClawConfigDocument('{ agents: { ');
    assert.equal(parsed?.parsed, null);
    assert.match(parsed?.parseError || '', /openclaw\.json|Invalid openclaw\.json JSON5/i);
  },
);

await runTest(
  'openClawConfigDocumentService analyzes top-level sections with previews',
  () => {
    const analysis = configDocumentServiceModule?.analyzeOpenClawConfigDocument(`{
  agents: {
    defaults: {
      model: {
        primary: "openai/gpt-5.4",
      },
    },
  },
  channels: [],
}`);

    assert.equal(analysis?.parseError, null);
    assert.deepEqual(
      analysis?.sections.map((section) => ({
        key: section.key,
        kind: section.kind,
        entryCount: section.entryCount,
      })),
      [
        { key: 'agents', kind: 'object', entryCount: 1 },
        { key: 'channels', kind: 'array', entryCount: 0 },
      ],
    );
    assert.equal(analysis?.sections[0]?.preview.includes('defaults'), true);
  },
);
