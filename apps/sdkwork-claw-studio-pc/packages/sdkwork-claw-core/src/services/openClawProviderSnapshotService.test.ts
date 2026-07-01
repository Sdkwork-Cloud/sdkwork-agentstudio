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

let providerSnapshotServiceModule:
  | typeof import('./openClawProviderSnapshotService.ts')
  | undefined;

try {
  providerSnapshotServiceModule = await import('./openClawProviderSnapshotService.ts');
} catch {
  providerSnapshotServiceModule = undefined;
}

await runTest(
  'openClawProviderSnapshotService exposes the config-root snapshot builder',
  () => {
    assert.ok(
      providerSnapshotServiceModule,
      'Expected openClawProviderSnapshotService.ts to exist',
    );
    assert.equal(
      typeof providerSnapshotServiceModule?.buildOpenClawProviderSnapshotsFromConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawProviderSnapshotService builds canonical provider snapshots from config root',
  () => {
    const snapshots = providerSnapshotServiceModule?.buildOpenClawProviderSnapshotsFromConfigRoot(
      {
        models: {
          providers: {
            'api-router-openai': {
              baseUrl: ' https://router.example.com/v1 ',
              apiKey: ' ${OPENAI_API_KEY} ',
              request: {
                headers: {
                  ' OpenAI-Organization ': ' org_live ',
                },
                auth: {
                  mode: 'authorization-bearer',
                  token: ' ${OPENAI_API_KEY} ',
                },
              },
              models: [
                {
                  id: ' gpt-5.4 ',
                  name: ' GPT-5.4 ',
                },
                {
                  id: ' o4-mini ',
                  name: ' o4-mini ',
                  reasoning: true,
                },
                {
                  id: ' text-embedding-3-small ',
                  name: ' text-embedding-3-small ',
                },
              ],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: 'api-router-openai/gpt-5.4',
              fallbacks: ['api-router-openai/o4-mini'],
            },
            models: {
              'openai/gpt-5.4': {
                params: {
                  temperature: 0.3,
                  topP: 0.9,
                  maxTokens: 4096,
                  timeoutMs: 45000,
                  streaming: true,
                },
              },
            },
          },
        },
      },
      { lastCheckedAt: '2026-04-19T12:34:56.000Z' },
    );

    assert.deepEqual(snapshots, [
      {
        id: 'openai',
        providerKey: 'openai',
        name: 'Openai',
        provider: 'openai',
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        status: 'ready',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-small',
        description: 'Openai provider configured through Claw Studio and OpenClaw.',
        icon: 'OA',
        lastCheckedAt: '2026-04-19T12:34:56.000Z',
        capabilities: ['chat', 'reasoning', 'embedding'],
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
            role: 'primary',
            contextWindow: '128K',
          },
          {
            id: 'o4-mini',
            name: 'o4-mini',
            role: 'reasoning',
            contextWindow: '200K',
          },
          {
            id: 'text-embedding-3-small',
            name: 'text-embedding-3-small',
            role: 'embedding',
            contextWindow: '8K',
          },
        ],
        config: {
          temperature: 0.3,
          topP: 0.9,
          maxTokens: 4096,
          timeoutMs: 45000,
          streaming: true,
          request: {
            headers: {
              'OpenAI-Organization': 'org_live',
            },
            auth: {
              mode: 'authorization-bearer',
              token: '${OPENAI_API_KEY}',
            },
          },
        },
      },
    ]);
  },
);

await runTest(
  'openClawProviderSnapshotService returns no snapshots for non-object config roots',
  () => {
    assert.deepEqual(
      providerSnapshotServiceModule?.buildOpenClawProviderSnapshotsFromConfigRoot(null),
      [],
    );
    assert.deepEqual(
      providerSnapshotServiceModule?.buildOpenClawProviderSnapshotsFromConfigRoot([]),
      [],
    );
  },
);
