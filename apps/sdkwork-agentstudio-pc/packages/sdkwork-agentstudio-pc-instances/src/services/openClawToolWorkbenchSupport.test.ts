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

let toolWorkbenchSupportModule:
  | typeof import('./openClawToolWorkbenchSupport.ts')
  | undefined;

try {
  toolWorkbenchSupportModule = await import('./openClawToolWorkbenchSupport.ts');
} catch {
  toolWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawToolWorkbenchSupport exposes shared tool shaping helpers',
  () => {
    assert.ok(toolWorkbenchSupportModule, 'Expected openClawToolWorkbenchSupport.ts to exist');
    assert.equal(typeof toolWorkbenchSupportModule?.inferToolCategory, 'function');
    assert.equal(typeof toolWorkbenchSupportModule?.inferToolAccess, 'function');
    assert.equal(typeof toolWorkbenchSupportModule?.mergeUniqueValues, 'function');
    assert.equal(typeof toolWorkbenchSupportModule?.mergeToolStatus, 'function');
    assert.equal(typeof toolWorkbenchSupportModule?.buildOpenClawTools, 'function');
    assert.equal(typeof toolWorkbenchSupportModule?.buildOpenClawScopedTools, 'function');
  },
);

await runTest(
  'buildOpenClawTools shapes tool records with inferred category, access, and scoped agent metadata',
  () => {
    const tools = toolWorkbenchSupportModule?.buildOpenClawTools(
      {
        agentId: 'Ops Lead',
        groups: [
          {
            id: 'filesystem',
            label: 'Filesystem',
            tools: [
              {
                id: 'read_file',
                label: 'Read File',
                description: '',
                optional: false,
              },
              {
                id: 'run_diagnostic',
                label: '',
                description: '',
                optional: true,
              },
              {
                id: 'read_file',
                label: 'Duplicate Read File',
                description: 'Should be ignored',
                optional: false,
              },
            ],
          },
        ],
      } as any,
      new Map([['ops-lead', 'Ops Lead']]),
    );

    assert.deepEqual(
      tools?.map((tool) => tool.id),
      ['read_file', 'run_diagnostic'],
    );
    assert.equal(tools?.[0]?.category, 'filesystem');
    assert.equal(tools?.[0]?.access, 'read');
    assert.equal(tools?.[0]?.status, 'ready');
    assert.deepEqual(tools?.[0]?.agentIds, ['ops-lead']);
    assert.deepEqual(tools?.[0]?.agentNames, ['Ops Lead']);

    assert.equal(tools?.[1]?.name, 'Run Diagnostic');
    assert.equal(tools?.[1]?.description, 'Run Diagnostic tool exposed by the OpenClaw gateway.');
    assert.equal(tools?.[1]?.status, 'beta');
    assert.equal(tools?.[1]?.access, 'execute');
  },
);

await runTest(
  'buildOpenClawScopedTools merges duplicate tools across catalogs and keeps unique agent ownership',
  () => {
    const tools = toolWorkbenchSupportModule?.buildOpenClawScopedTools(
      [
        {
          agentId: 'Ops Lead',
          groups: [
            {
              id: 'observability',
              label: 'Observability',
              tools: [
                {
                  id: 'list_logs',
                  label: 'List Logs',
                  optional: false,
                },
              ],
            },
          ],
        },
        {
          agentId: 'reviewer',
          groups: [
            {
              id: 'observability',
              label: 'Observability',
              tools: [
                {
                  id: 'list_logs',
                  label: 'List Logs',
                  optional: true,
                },
                {
                  id: 'patch_config',
                  label: 'Patch Config',
                  optional: false,
                },
              ],
            },
          ],
        },
      ] as any,
      [
        {
          agent: {
            id: 'ops-lead',
            name: 'Ops Lead',
          },
          focusAreas: [],
          automationFitScore: 0,
          configSource: 'runtime',
        },
        {
          agent: {
            id: 'reviewer',
            name: 'Reviewer',
          },
          focusAreas: [],
          automationFitScore: 0,
          configSource: 'runtime',
        },
      ] as any,
    );

    assert.deepEqual(
      tools?.map((tool) => tool.id),
      ['list_logs', 'patch_config'],
    );
    assert.equal(tools?.[0]?.status, 'beta');
    assert.deepEqual(tools?.[0]?.agentIds, ['ops-lead', 'reviewer']);
    assert.deepEqual(tools?.[0]?.agentNames, ['Ops Lead', 'Reviewer']);
    assert.equal(tools?.[1]?.category, 'filesystem');
    assert.equal(tools?.[1]?.access, 'write');
  },
);
