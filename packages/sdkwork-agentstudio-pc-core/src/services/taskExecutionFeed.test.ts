import assert from 'node:assert/strict';
import type { Task, TaskExecutionHistoryEntry } from './taskService.ts';
import { buildTaskExecutionFeed, isTaskExecutionFeedReady } from './taskExecutionFeed.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id || 'task-1',
    name: overrides.name || 'Morning Briefing',
    prompt: overrides.prompt || 'Summarize the overnight changes.',
    schedule: overrides.schedule || '0 9 * * *',
    scheduleMode: overrides.scheduleMode || 'cron',
    scheduleConfig: overrides.scheduleConfig || {
      cronExpression: '0 9 * * *',
    },
    cronExpression: overrides.cronExpression || '0 9 * * *',
    actionType: overrides.actionType || 'agentTurn',
    status: overrides.status || 'active',
    sessionMode: overrides.sessionMode || 'isolated',
    wakeUpMode: overrides.wakeUpMode || 'immediate',
    executionContent: overrides.executionContent || 'runAssistantTask',
    deliveryMode: overrides.deliveryMode || 'none',
    ...overrides,
  };
}

function createExecution(
  overrides: Partial<TaskExecutionHistoryEntry> = {},
): TaskExecutionHistoryEntry {
  return {
    id: overrides.id || 'exec-1',
    taskId: overrides.taskId || 'task-1',
    status: overrides.status || 'success',
    trigger: overrides.trigger || 'schedule',
    startedAt: overrides.startedAt || '2026-04-17T08:00:00.000Z',
    finishedAt: overrides.finishedAt || '2026-04-17T08:02:00.000Z',
    summary: overrides.summary || 'Completed successfully.',
    details: overrides.details,
  };
}

runTest('buildTaskExecutionFeed flattens task histories and sorts newest runs first', () => {
  const tasks = [
    createTask({
      id: 'task-1',
      name: 'Morning Briefing',
      status: 'active',
      schedule: '0 9 * * *',
    }),
    createTask({
      id: 'task-2',
      name: 'Nightly Audit',
      status: 'paused',
      schedule: '0 1 * * *',
    }),
  ];
  const feed = buildTaskExecutionFeed(tasks, {
    'task-1': [
      createExecution({
        id: 'exec-1',
        taskId: 'task-1',
        startedAt: '2026-04-17T07:00:00.000Z',
        summary: 'Morning run finished.',
      }),
    ],
    'task-2': [
      createExecution({
        id: 'exec-2',
        taskId: 'task-2',
        status: 'failed',
        startedAt: '2026-04-17T09:30:00.000Z',
        finishedAt: '2026-04-17T09:31:00.000Z',
        summary: 'Nightly audit failed.',
      }),
      createExecution({
        id: 'exec-3',
        taskId: 'task-2',
        status: 'running',
        startedAt: '2026-04-16T23:30:00.000Z',
        finishedAt: undefined,
        summary: 'Nightly audit is running.',
      }),
    ],
  });

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ['exec-2', 'exec-1', 'exec-3'],
  );
  assert.equal(feed[0]?.taskName, 'Nightly Audit');
  assert.equal(feed[0]?.taskStatus, 'paused');
  assert.equal(feed[0]?.taskSchedule, '0 1 * * *');
  assert.equal(feed[1]?.taskName, 'Morning Briefing');
});

runTest('buildTaskExecutionFeed skips unknown task ids and preserves task metadata', () => {
  const feed = buildTaskExecutionFeed(
    [
      createTask({
        id: 'task-1',
        name: 'Morning Briefing',
        status: 'failed',
        schedule: '@every 30m',
      }),
    ],
    {
      orphaned: [
        createExecution({
          id: 'exec-orphan',
          taskId: 'orphaned',
          startedAt: '2026-04-17T10:00:00.000Z',
        }),
      ],
      'task-1': [
        createExecution({
          id: 'exec-1',
          taskId: 'task-1',
          startedAt: '2026-04-17T06:00:00.000Z',
          summary: 'Detected a delivery error.',
        }),
      ],
    },
  );

  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.id, 'exec-1');
  assert.equal(feed[0]?.taskStatus, 'failed');
  assert.equal(feed[0]?.taskSchedule, '@every 30m');
});

runTest('isTaskExecutionFeedReady stays false until every visible task has a loaded history bucket', () => {
  const tasks = [
    createTask({ id: 'task-1', name: 'Morning Briefing' }),
    createTask({ id: 'task-2', name: 'Nightly Audit' }),
  ];

  assert.equal(
    isTaskExecutionFeedReady(tasks, {
      'task-1': [],
    }),
    false,
  );

  assert.equal(
    isTaskExecutionFeedReady(tasks, {
      'task-1': [],
      'task-2': [createExecution({ taskId: 'task-2' })],
    }),
    true,
  );

  assert.equal(isTaskExecutionFeedReady([], {}), true);
});
