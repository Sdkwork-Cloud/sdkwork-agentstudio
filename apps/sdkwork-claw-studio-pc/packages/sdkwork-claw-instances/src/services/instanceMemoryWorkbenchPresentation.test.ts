import assert from 'node:assert/strict';
import type { OpenClawDreamingConfigSnapshot } from '@sdkwork/claw-core';
import type { InstanceWorkbenchMemoryEntry } from '../types/index.ts';
import {
  buildInstanceMemoryWorkbenchState,
  buildOpenClawDreamingSaveInput,
  createOpenClawDreamingFormState,
  isDreamDiaryMemoryEntry,
} from './instanceMemoryWorkbenchPresentation.ts';

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

function createDreamingConfig(
  overrides: Partial<OpenClawDreamingConfigSnapshot> = {},
): OpenClawDreamingConfigSnapshot {
  return {
    enabled: false,
    frequency: '',
    ...overrides,
  };
}

function createMemoryEntry(
  overrides: Partial<InstanceWorkbenchMemoryEntry> = {},
): InstanceWorkbenchMemoryEntry {
  return {
    id: 'memory-entry',
    title: 'Memory Runtime',
    type: 'fact',
    summary: 'Runtime memory snapshot',
    source: 'system',
    updatedAt: '2026-04-07T03:05:00.000Z',
    retention: 'rolling',
    tokens: 42,
    ...overrides,
  };
}

await runTest('createOpenClawDreamingFormState copies the managed dreaming snapshot into an editable draft', () => {
  const draft = createOpenClawDreamingFormState(
    createDreamingConfig({
      enabled: true,
      frequency: '0 3 * * *',
    }),
  );

  assert.deepEqual(draft, {
    enabled: true,
    frequency: '0 3 * * *',
  });
});

await runTest('buildOpenClawDreamingSaveInput trims frequency and omits a blank cadence', () => {
  assert.deepEqual(
    buildOpenClawDreamingSaveInput({
      enabled: true,
      frequency: ' 0 3 * * * ',
    }),
    {
      enabled: true,
      frequency: '0 3 * * *',
    },
  );

  assert.deepEqual(
    buildOpenClawDreamingSaveInput({
      enabled: false,
      frequency: '   ',
    }),
    {
      enabled: false,
    },
  );
});

await runTest('buildInstanceMemoryWorkbenchState keeps the memory section non-empty when dreaming config exists without runtime memory entries', () => {
  const state = buildInstanceMemoryWorkbenchState({
    configDreaming: createDreamingConfig({
      enabled: true,
      frequency: '0 3 * * *',
    }),
    memories: [],
  });

  assert.equal(state.hasDreamingConfigPanel, true);
  assert.equal(state.hasMemoryEntries, false);
  assert.equal(state.isEmpty, false);
});

await runTest('buildInstanceMemoryWorkbenchState exposes Dream Diary entries that have readable content', () => {
  const dreamDiary = createMemoryEntry({
    id: 'memory-dream-diary',
    title: 'Dream Diary',
    type: 'dream',
    summary: 'dreams.md. Consolidated deployment runbooks into a single operator playbook.',
    content:
      '# Dream Diary\n\n## 2026-04-07\nConsolidated deployment runbooks into a single operator playbook.',
  });

  const state = buildInstanceMemoryWorkbenchState({
    configDreaming: createDreamingConfig(),
    memories: [
      createMemoryEntry(),
      dreamDiary,
    ],
  });

  assert.equal(state.hasMemoryEntries, true);
  assert.equal(state.dreamDiaryEntries.length, 1);
  assert.equal(state.dreamDiaryEntries[0]?.id, 'memory-dream-diary');
  assert.equal(isDreamDiaryMemoryEntry(dreamDiary), true);
});
