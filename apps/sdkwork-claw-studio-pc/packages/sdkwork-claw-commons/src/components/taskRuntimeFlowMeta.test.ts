import assert from 'node:assert/strict';
import {
  formatTaskFlowLinkedTaskCleanupAfter,
  formatTaskFlowDetailPayload,
  formatTaskFlowLinkedTaskResult,
  formatTaskFlowRequesterOrigin,
  formatTaskFlowTaskSummary,
  formatTaskFlowActivity,
  getTaskFlowLinkedTaskSourceId,
  getTaskFlowLinkedTaskParentTaskId,
  getTaskFlowLinkedTaskRequesterSession,
  getTaskFlowLinkedTaskSummary,
  getTaskFlowBlockedSummary,
  getTaskFlowCardSummary,
  isActiveRuntimeStatus,
} from './taskRuntimeFlowMeta.ts';

function runTest(name: string, fn: () => void) {
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

await runTest('task runtime flow summary prefers the upstream goal before falling back to legacy summary text', () => {
  assert.equal(
    getTaskFlowCardSummary(
      {
        id: 'flow-1',
        goal: 'Review the release package',
        summary: 'Legacy summary',
        raw: {},
      },
      'No flow summary was provided for this record.',
    ),
    'Review the release package',
  );

  assert.equal(
    getTaskFlowCardSummary(
      {
        id: 'flow-2',
        goal: '   ',
        summary: 'Legacy summary',
        raw: {},
      },
      'No flow summary was provided for this record.',
    ),
    'Legacy summary',
  );

  assert.equal(
    getTaskFlowCardSummary(
      {
        id: 'flow-3',
        raw: {},
      },
      'No flow summary was provided for this record.',
    ),
    'No flow summary was provided for this record.',
  );
});

await runTest('task runtime flow activity avoids misleading 0/0 output when upstream counts are absent', () => {
  assert.equal(
    formatTaskFlowActivity({
      id: 'flow-1',
      raw: {},
    }),
    '-',
  );

  assert.equal(
    formatTaskFlowActivity({
      id: 'flow-2',
      activeTaskCount: 2,
      taskCount: 5,
      raw: {},
    }),
    '2/5',
  );
});

await runTest('task runtime flow detail payload summaries stay honest about structured state and wait data', () => {
  assert.equal(formatTaskFlowDetailPayload(undefined), '-');
  assert.equal(formatTaskFlowDetailPayload('approval'), 'approval');
  assert.equal(formatTaskFlowDetailPayload(['approval', 'timer']), 'array(2)');
  assert.equal(
    formatTaskFlowDetailPayload({
      retryAfterMs: 3_000,
      phase: 'approval',
    }),
    'phase, retryAfterMs',
  );
});

await runTest('task runtime flow detail summaries expose blocked and aggregate task pressure', () => {
  assert.equal(
    getTaskFlowBlockedSummary({
      summary: 'Awaiting release-manager approval',
      taskId: 'task-approve-1',
    }),
    'Awaiting release-manager approval',
  );
  assert.equal(
    getTaskFlowBlockedSummary({
      taskId: 'task-approve-1',
    }),
    'blocked by task-approve-1',
  );
  assert.equal(getTaskFlowBlockedSummary(undefined), null);

  assert.equal(
    formatTaskFlowTaskSummary({
      active: 1,
      total: 3,
      failures: 1,
      terminal: 2,
    }),
    '1 active / 3 total / 1 failures / 2 terminal',
  );
  assert.equal(formatTaskFlowTaskSummary(undefined), '-');
});

await runTest('task runtime requester-origin summary keeps delivery source semantics readable without leaking raw JSON', () => {
  assert.equal(
    formatTaskFlowRequesterOrigin({
      channel: 'slack',
      to: 'channel:ops',
      accountId: 'ops-bot',
      threadId: '171234',
    }),
    'slack -> channel:ops @ops-bot #171234',
  );
  assert.equal(
    formatTaskFlowRequesterOrigin({
      channel: 'telegram',
      to: '-1001234567890',
    }),
    'telegram -> -1001234567890',
  );
  assert.equal(
    formatTaskFlowRequesterOrigin({
      accountId: 'ops-bot',
      threadId: '171234',
    }),
    '@ops-bot #171234',
  );
  assert.equal(formatTaskFlowRequesterOrigin(undefined), '-');
});

await runTest('task runtime linked-task summary prefers upstream terminal and progress summaries before falling back to labels', () => {
  assert.equal(
    getTaskFlowLinkedTaskSummary({
      terminalSummary: 'Needs manual approval.',
      progressSummary: 'Waiting on release-manager.',
      label: 'Approval',
      title: 'Request release approval',
    }),
    'Needs manual approval.',
  );
  assert.equal(
    getTaskFlowLinkedTaskSummary({
      progressSummary: 'Waiting on release-manager.',
      label: 'Approval',
      title: 'Request release approval',
    }),
    'Waiting on release-manager.',
  );
  assert.equal(
    getTaskFlowLinkedTaskSummary({
      label: 'Approval',
      title: 'Request release approval',
    }),
    'Approval',
  );
  assert.equal(
    getTaskFlowLinkedTaskSummary({
      title: 'Request release approval',
    }),
    'Request release approval',
  );
  assert.equal(getTaskFlowLinkedTaskSummary(undefined), '-');
});

await runTest('task runtime linked-task result formatting stays compact when upstream task outcomes are missing', () => {
  assert.equal(
    formatTaskFlowLinkedTaskResult({
      terminalOutcome: 'blocked',
    }),
    'blocked',
  );
  assert.equal(formatTaskFlowLinkedTaskResult(undefined), '-');
});

await runTest('task runtime linked-task requester-session helper avoids duplicating the child execution session', () => {
  assert.equal(
    getTaskFlowLinkedTaskRequesterSession({
      childSessionKey: 'agent:release-review:child',
      sessionKey: 'thread:ops-room',
    }),
    'thread:ops-room',
  );
  assert.equal(
    getTaskFlowLinkedTaskRequesterSession({
      childSessionKey: 'agent:release-review:child',
      sessionKey: 'agent:release-review:child',
    }),
    null,
  );
  assert.equal(
    getTaskFlowLinkedTaskRequesterSession({
      sessionKey: 'thread:ops-room',
    }),
    'thread:ops-room',
  );
  assert.equal(getTaskFlowLinkedTaskRequesterSession(undefined), null);
});

await runTest('task runtime linked-task parent-task helper keeps upstream task lineage visible without leaking blanks', () => {
  assert.equal(
    getTaskFlowLinkedTaskParentTaskId({
      parentTaskId: 'task-plan-1',
    }),
    'task-plan-1',
  );
  assert.equal(
    getTaskFlowLinkedTaskParentTaskId({
      parentTaskId: '   ',
    }),
    '-',
  );
  assert.equal(getTaskFlowLinkedTaskParentTaskId(undefined), '-');
});

await runTest('task runtime linked-task cleanup-after helper keeps upstream retention timing visible without leaking blanks', () => {
  assert.equal(
    formatTaskFlowLinkedTaskCleanupAfter({
      cleanupAfter: '2026-04-07T10:30:00.000Z',
    }),
    '2026-04-07T10:30:00.000Z',
  );
  assert.equal(
    formatTaskFlowLinkedTaskCleanupAfter({
      cleanupAfter: '   ',
    }),
    '-',
  );
  assert.equal(formatTaskFlowLinkedTaskCleanupAfter(undefined), '-');
});

await runTest('task runtime linked-task source-id helper keeps upstream provenance visible without leaking blanks', () => {
  assert.equal(
    getTaskFlowLinkedTaskSourceId({
      sourceId: 'release-review-cron',
    }),
    'release-review-cron',
  );
  assert.equal(
    getTaskFlowLinkedTaskSourceId({
      sourceId: '   ',
    }),
    '-',
  );
  assert.equal(getTaskFlowLinkedTaskSourceId(undefined), '-');
});

await runTest('task runtime activity classification treats waiting task-flow states as active pressure', () => {
  assert.equal(isActiveRuntimeStatus('running'), true);
  assert.equal(isActiveRuntimeStatus('blocked'), true);
  assert.equal(isActiveRuntimeStatus('waiting'), true);
  assert.equal(isActiveRuntimeStatus('succeeded'), false);
  assert.equal(isActiveRuntimeStatus('cancelled'), false);
});
