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

let runtimeMemorySupportModule:
  | typeof import('./openClawRuntimeMemorySupport.ts')
  | undefined;

try {
  runtimeMemorySupportModule = await import('./openClawRuntimeMemorySupport.ts');
} catch {
  runtimeMemorySupportModule = undefined;
}

await runTest(
  'openClawRuntimeMemorySupport exposes shared runtime memory summary helpers',
  () => {
    assert.ok(runtimeMemorySupportModule, 'Expected openClawRuntimeMemorySupport.ts to exist');
    assert.equal(typeof runtimeMemorySupportModule?.formatRuntimeMemoryLineRange, 'function');
    assert.equal(typeof runtimeMemorySupportModule?.extractDreamDiaryContent, 'function');
    assert.equal(typeof runtimeMemorySupportModule?.buildOpenClawRuntimeMemories, 'function');
  },
);

await runTest(
  'formatRuntimeMemoryLineRange reads alternate line keys and returns null when no bounds exist',
  () => {
    assert.equal(
      runtimeMemorySupportModule?.formatRuntimeMemoryLineRange({
        from: 12,
        to: 18,
      }),
      '12-18',
    );
    assert.equal(
      runtimeMemorySupportModule?.formatRuntimeMemoryLineRange({
        lineStart: 3,
      }),
      '3',
    );
    assert.equal(
      runtimeMemorySupportModule?.formatRuntimeMemoryLineRange({
        startLine: 7,
        endLine: 4,
      }),
      '7',
    );
    assert.equal(runtimeMemorySupportModule?.formatRuntimeMemoryLineRange({}), null);
  },
);

await runTest(
  'extractDreamDiaryContent prefers inline body fields and otherwise joins line records',
  () => {
    assert.equal(
      runtimeMemorySupportModule?.extractDreamDiaryContent({
        markdown: '# Dream\nRemember the release owner.',
        lines: ['ignored'],
      }),
      '# Dream\nRemember the release owner.',
    );
    assert.equal(
      runtimeMemorySupportModule?.extractDreamDiaryContent({
        lines: [
          'First insight',
          { text: 'Second insight' },
          { line: 'Third insight' },
        ],
      }),
      'First insight\nSecond insight\nThird insight',
    );
  },
);

await runTest(
  'buildOpenClawRuntimeMemories synthesizes runtime status, hit summaries, and dream diary content',
  () => {
    const entries = runtimeMemorySupportModule?.buildOpenClawRuntimeMemories(
      {
        provider: 'openai',
        agentId: 'ops',
        embedding: {
          ok: true,
        },
        dreaming: {
          enabled: true,
        },
      },
      {
        results: [
          {
            path: 'memory/runbooks/deploy.md',
            score: 0.91,
            text: 'Deployment uses canary rollout to reduce blast radius.',
            from: 12,
            to: 18,
          },
        ],
      } as any,
      {
        path: 'memory/dreams.md',
        updatedAt: '2026-04-08T10:00:00.000Z',
        lines: [{ text: 'Dream about consolidating the release checklist.' }],
      },
      {
        config: {
          plugins: {
            entries: {
              'memory-core': {
                config: {
                  dreaming: {
                    frequency: '0 3 * * *',
                  },
                },
              },
            },
          },
        },
      } as any,
    );

    assert.equal(entries?.[0]?.title, 'Memory Runtime');
    assert.equal(entries?.[0]?.summary.includes('Provider=openai'), true);
    assert.equal(entries?.[0]?.summary.includes('Agent=ops'), true);
    assert.equal(entries?.[0]?.summary.includes('Embedding ready'), true);
    assert.equal(entries?.[0]?.summary.includes('Dreaming enabled'), true);
    assert.equal(entries?.[0]?.summary.includes('Frequency=0 3 * * *'), true);
    assert.equal(entries?.[0]?.summary.includes('1 indexed hit available'), true);

    assert.equal(entries?.[1]?.title, 'deploy.md');
    assert.equal(entries?.[1]?.type, 'runbook');
    assert.equal(entries?.[1]?.source, 'system');
    assert.equal(entries?.[1]?.summary.includes('memory/runbooks/deploy.md'), true);
    assert.equal(entries?.[1]?.summary.includes('lines 12-18'), true);
    assert.equal(entries?.[1]?.summary.includes('score 0.91'), true);
    assert.equal(entries?.[1]?.summary.includes('Deployment uses canary rollout'), true);

    assert.equal(entries?.[2]?.title, 'Dream Diary');
    assert.equal(entries?.[2]?.type, 'dream');
    assert.equal(
      entries?.[2]?.content,
      'Dream about consolidating the release checklist.',
    );
    assert.equal(entries?.[2]?.updatedAt, '2026-04-08T10:00:00.000Z');
  },
);

await runTest(
  'buildOpenClawRuntimeMemories returns an empty collection when no runtime snapshot exists',
  () => {
    assert.deepEqual(
      runtimeMemorySupportModule?.buildOpenClawRuntimeMemories(null, null, null, null),
      [],
    );
  },
);
