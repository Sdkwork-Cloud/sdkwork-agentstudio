import assert from 'node:assert/strict';
import type { Task, TaskExecutionHistoryEntry } from './taskService.ts';
import { buildTaskCardState } from './taskListPresentation.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Daily Summary',
    description: 'Collect the daily operator summary.',
    prompt: 'Summarize the last 24 hours for the ops team.',
    schedule: '@every 1d',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 1,
      intervalUnit: 'day',
    },
    cronExpression: '0 0 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 90,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'telegram',
    recipient: 'ops-room',
    lastRun: '2 hours ago',
    nextRun: 'in 22 hours',
    ...overrides,
  };
}

function createExecution(
  overrides: Partial<TaskExecutionHistoryEntry> = {},
): TaskExecutionHistoryEntry {
  return {
    id: 'run-1',
    taskId: 'task-1',
    status: 'success',
    trigger: 'schedule',
    startedAt: 'Today 08:00',
    finishedAt: 'Today 08:01',
    summary: 'Everything completed successfully.',
    details: 'Delivery succeeded.',
    ...overrides,
  };
}

runTest('active tasks with successful executions get a healthy card state', () => {
  const state = buildTaskCardState(createTask(), [createExecution()]);

  assert.equal(state.tone, 'healthy');
  assert.equal(state.latestExecution?.status, 'success');
  assert.equal(state.canRunNow, true);
  assert.equal(state.summaryText, 'Collect the daily operator summary.');
  assert.equal(state.latestExecutionSummary, 'Everything completed successfully.');
});

runTest('paused tasks keep a paused card state even if they have no latest execution', () => {
  const state = buildTaskCardState(
    createTask({
      status: 'paused',
      nextRun: '-',
    }),
    [],
  );

  assert.equal(state.tone, 'paused');
  assert.equal(state.latestExecution, null);
  assert.equal(state.nextRunLabel, '-');
  assert.equal(state.latestExecutionSummary, null);
});

runTest('failed tasks surface execution failure as the dominant visual state', () => {
  const state = buildTaskCardState(
    createTask({
      status: 'failed',
    }),
    [
      createExecution({
        status: 'failed',
        summary: 'Delivery failed because the channel is offline.',
      }),
    ],
  );

  assert.equal(state.tone, 'danger');
  assert.equal(state.latestExecution?.status, 'failed');
  assert.equal(state.promptExcerpt.endsWith('...'), false);
  assert.equal(state.latestExecutionSummary, 'Delivery failed because the channel is offline.');
});

runTest('active tasks still surface the danger tone when the latest execution failed', () => {
  const state = buildTaskCardState(createTask(), [
    createExecution({
      status: 'failed',
      summary: 'The task failed on its latest scheduled run.',
    }),
  ]);

  assert.equal(state.tone, 'danger');
  assert.equal(state.latestExecution?.status, 'failed');
});

runTest('tasks without a description fall back to the prompt excerpt for row summary text', () => {
  const state = buildTaskCardState(
    createTask({
      description: '',
      prompt:
        'Summarize the last 24 hours for the ops team and highlight any channel delivery regressions that still need attention.',
    }),
    [],
  );

  assert.equal(
    state.summaryText,
    'Summarize the last 24 hours for the ops team and highlight any channel delivery regressions that still need attention.',
  );
});
