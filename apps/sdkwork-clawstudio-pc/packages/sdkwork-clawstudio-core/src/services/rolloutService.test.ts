import assert from 'node:assert/strict';
import type {
  ManageRolloutListResult,
  ManageRolloutPreview,
  ManageRolloutRecord,
} from '@sdkwork/clawstudio-infrastructure';
import { STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID } from '@sdkwork/clawstudio-types';

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
    attempt: 2,
    targetCount: 3,
    updatedAt: 1_743_200_001_000,
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
        updatedAt: 1_743_200_002_000,
      }),
      createRolloutRecord({
        id: 'rollout-c',
        phase: 'completed',
        updatedAt: 1_743_200_003_000,
      }),
    ],
    total: 3,
    ...overrides,
  };
}

function createRolloutPreview(
  overrides: Partial<ManageRolloutPreview> = {},
): ManageRolloutPreview {
  return {
    rolloutId: 'rollout-a',
    phase: 'ready',
    attempt: 2,
    summary: {
      totalTargets: 3,
      admissibleTargets: 2,
      degradedTargets: 0,
      blockedTargets: 1,
      predictedWaveCount: 2,
    },
    targets: [
      {
        nodeId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        preflightOutcome: 'admissible',
        desiredStateRevision: 8,
        desiredStateHash: 'rev-8-a',
        waveId: 'wave-1',
      },
      {
        nodeId: 'managed-remote',
        preflightOutcome: 'blockedByCapability',
        blockedReason: 'missing capability: runtime.apply',
        desiredStateRevision: null,
        desiredStateHash: null,
        waveId: 'wave-1',
      },
      {
        nodeId: 'attached-remote',
        preflightOutcome: 'admissible',
        desiredStateRevision: 9,
        desiredStateHash: 'rev-9-a',
        waveId: 'wave-2',
      },
    ],
    candidateRevisionSummary: {
      totalTargets: 3,
      minDesiredStateRevision: 8,
      maxDesiredStateRevision: 9,
    },
    generatedAt: 1_743_200_004_000,
    ...overrides,
  };
}

await runTest(
  'rolloutService lists rollout summaries, derives phase counts, and identifies blocked preview targets',
  async () => {
    const { createRolloutService } = await import('./rolloutService.ts');

    const previewRequests: Array<Record<string, unknown>> = [];
    const service = createRolloutService({
      getManagePlatform: () => ({
        listRollouts: async () => createRolloutListResult(),
        previewRollout: async (input) => {
          previewRequests.push(input as Record<string, unknown>);
          return createRolloutPreview();
        },
        startRollout: async (rolloutId) =>
          createRolloutRecord({
            id: rolloutId,
            phase: 'promoting',
          }),
      }),
    });

    const rollouts = await service.list();
    const phaseCounts = service.summarizePhases(rollouts);
    const preview = await service.preview('rollout-a');
    const blockedTargets = service.listTargetFailures(preview);
    const started = await service.start('rollout-a');

    assert.equal(Array.isArray(rollouts.items), true);
    assert.equal(rollouts.total, 3);
    assert.deepEqual(phaseCounts, {
      active: 1,
      failed: 1,
      completed: 1,
      paused: 0,
      drafts: 0,
    });
    assert.equal(preview.summary.blockedTargets, 1);
    assert.deepEqual(previewRequests, [
      {
        rolloutId: 'rollout-a',
        includeTargets: true,
        forceRecompute: false,
      },
    ]);
    assert.deepEqual(
      blockedTargets.map((target) => ({
        nodeId: target.nodeId,
        blockedReason: target.blockedReason ?? null,
      })),
      [
        {
          nodeId: 'managed-remote',
          blockedReason: 'missing capability: runtime.apply',
        },
      ],
    );
    assert.equal(started.phase, 'promoting');
  },
);

