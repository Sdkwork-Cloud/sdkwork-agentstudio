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

let agentDocumentServiceModule:
  | typeof import('./openClawAgentDocumentService.ts')
  | undefined;

try {
  agentDocumentServiceModule = await import('./openClawAgentDocumentService.ts');
} catch {
  agentDocumentServiceModule = undefined;
}

await runTest(
  'openClawAgentDocumentService exposes agent document helpers',
  () => {
    assert.ok(
      agentDocumentServiceModule,
      'Expected openClawAgentDocumentService.ts to exist',
    );
    assert.equal(
      typeof agentDocumentServiceModule?.normalizeOpenClawAgentId,
      'function',
    );
    assert.equal(
      typeof agentDocumentServiceModule?.readOpenClawAgentModelConfig,
      'function',
    );
    assert.equal(
      typeof agentDocumentServiceModule?.writeOpenClawAgentModelConfig,
      'function',
    );
    assert.equal(
      typeof agentDocumentServiceModule?.saveOpenClawAgentToConfigRoot,
      'function',
    );
    assert.equal(
      typeof agentDocumentServiceModule?.deleteOpenClawAgentFromConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawAgentDocumentService saves agent config with normalized ids, model refs, params, and default selection',
  () => {
    const root = {
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-4.1',
          },
        },
        list: [
          {
            id: 'main',
            default: true,
            name: 'Main',
            identity: {
              emoji: '*',
            },
          },
        ],
      },
    };

    agentDocumentServiceModule?.saveOpenClawAgentToConfigRoot(root, {
      id: ' Research Crew ',
      name: 'Research Crew',
      avatar: 'R',
      isDefault: true,
      model: {
        primary: ' api-router-openai/gpt-4.1 ',
        fallbacks: [' anthropic/claude-3.7-sonnet ', ' anthropic/claude-3.7-sonnet '],
      },
      params: {
        temperature: 0.4,
        streaming: true,
        ignored: null,
      },
    });

    assert.deepEqual(root, {
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-4.1',
          },
        },
        list: [
          {
            id: 'main',
            default: false,
            name: 'Main',
            identity: {
              emoji: '*',
            },
          },
          {
            id: 'research-crew',
            name: 'Research Crew',
            identity: {
              emoji: 'R',
            },
            default: true,
            model: {
              primary: 'openai/gpt-4.1',
              fallbacks: ['anthropic/claude-3.7-sonnet'],
            },
            params: {
              temperature: 0.4,
              streaming: true,
            },
          },
        ],
      },
    });
  },
);

await runTest(
  'openClawAgentDocumentService deletes agents and preserves a single default entry',
  () => {
    const root = {
      agents: {
        list: [
          {
            id: 'main',
            default: true,
          },
          {
            id: 'research',
            default: false,
          },
        ],
      },
    };

    agentDocumentServiceModule?.deleteOpenClawAgentFromConfigRoot(root, 'main');

    assert.deepEqual(root, {
      agents: {
        list: [
          {
            id: 'research',
            default: true,
          },
        ],
      },
    });
  },
);

await runTest(
  'openClawAgentDocumentService writes canonical agent model configs without duplicate fallbacks',
  () => {
    const target: Record<string, unknown> = {};

    agentDocumentServiceModule?.writeOpenClawAgentModelConfig(target, 'model', {
      primary: ' openrouter/meta-llama/llama-3.1-8b-instruct ',
      fallbacks: [
        ' anthropic/claude-3.7-sonnet ',
        ' anthropic/claude-3.7-sonnet ',
      ],
    });

    assert.deepEqual(target, {
      model: {
        primary: 'openrouter/meta-llama/llama-3.1-8b-instruct',
        fallbacks: ['anthropic/claude-3.7-sonnet'],
      },
    });
  },
);
