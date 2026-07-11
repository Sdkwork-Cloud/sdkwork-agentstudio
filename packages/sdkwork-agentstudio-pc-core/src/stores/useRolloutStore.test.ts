import assert from 'node:assert/strict';
import type {
  ManageRolloutListResult,
  ManageRolloutPreview,
  ManageRolloutRecord,
} from '@sdkwork/agentstudio-pc-infrastructure';
import { STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID } from '@sdkwork/agentstudio-pc-types';
import { createRolloutStore } from './useRolloutStore.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRolloutRecord(
  overrides: Partial<ManageRolloutRecord> = {},
): ManageRolloutRecord {
  return {
    id: 'rollout-a',
    phase: 'ready',
    attempt: 1,
    targetCount: 2,
    updatedAt: 1_743_200_005_000,
    ...overrides,
  };
}

function createRolloutListResult(
  overrides: Partial<ManageRolloutListResult> = {},
): ManageRolloutListResult {
  return {
    items: [
      createRolloutRecord(),
      createRolloutRecord({
        id: 'rollout-b',
        phase: 'failed',
      }),
    ],
    total: 2,
    ...overrides,
  };
}

function createRolloutPreview(
  overrides: Partial<ManageRolloutPreview> = {},
): ManageRolloutPreview {
  return {
    rolloutId: 'rollout-a',
    phase: 'ready',
    attempt: 1,
    summary: {
      totalTargets: 2,
      admissibleTargets: 1,
      degradedTargets: 0,
      blockedTargets: 1,
      predictedWaveCount: 1,
    },
    targets: [
      {
        nodeId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        preflightOutcome: 'admissible',
        desiredStateRevision: 10,
        desiredStateHash: 'rev-10',
      },
      {
        nodeId: 'managed-remote',
        preflightOutcome: 'blockedByPolicy',
        blockedReason: 'manual approval required',
        desiredStateRevision: null,
        desiredStateHash: null,
      },
    ],
    generatedAt: 1_743_200_005_500,
    ...overrides,
  };
}

await runTest(
  'useRolloutStore loads rollouts, previews blocked targets, and refreshes after start',
  async () => {
    const calls: string[] = [];
    const store = createRolloutStore({
      list: async () => {
        calls.push('list');
        return createRolloutListResult();
      },
      preview: async (rolloutId) => {
        calls.push(`preview:${rolloutId}`);
        return createRolloutPreview({ rolloutId });
      },
      start: async (rolloutId) => {
        calls.push(`start:${rolloutId}`);
        return createRolloutRecord({
          id: rolloutId,
          phase: 'promoting',
        });
      },
      summarizePhases: (result) => ({
        active: result.items.filter((item) => item.phase === 'ready').length,
        failed: result.items.filter((item) => item.phase === 'failed').length,
        completed: 0,
        paused: 0,
        drafts: 0,
      }),
      listTargetFailures: (preview) =>
        preview.targets.filter((target) => target.preflightOutcome.startsWith('blocked')),
    });

    await store.getState().load();
    const preview = await store.getState().previewRollout('rollout-a');
    const started = await store.getState().startRollout('rollout-a');

    assert.deepEqual(calls, ['list', 'preview:rollout-a', 'start:rollout-a', 'list']);
    assert.equal(store.getState().status, 'ready');
    assert.equal(store.getState().total, 2);
    assert.equal(store.getState().phaseCounts.active, 1);
    assert.equal(store.getState().phaseCounts.failed, 1);
    assert.equal(preview?.summary.blockedTargets, 1);
    assert.equal(store.getState().previewFailures[0]?.nodeId, 'managed-remote');
    assert.equal(started?.phase, 'promoting');
    assert.equal(store.getState().lastStartedRolloutId, 'rollout-a');
  },
);

