import assert from 'node:assert/strict';
import type { Task } from './taskService.ts';
import { buildTaskFormValuesFromTask } from './taskFormMapping.ts';

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
    name: 'Morning Brief',
    description: 'Prepare the morning operator digest.',
    prompt: 'Summarize the last 24 hours for the team.',
    schedule: '@every 30m',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 30,
      intervalUnit: 'minute',
    },
    cronExpression: '*/30 * * * *',
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
    nextRun: 'in 30 minutes',
    ...overrides,
  };
}

runTest('buildTaskFormValuesFromTask maps interval tasks into editable form values', () => {
  const values = buildTaskFormValuesFromTask(createTask());

  assert.equal(values.name, 'Morning Brief');
  assert.equal(values.description, 'Prepare the morning operator digest.');
  assert.equal(values.enabled, true);
  assert.equal(values.scheduleMode, 'interval');
  assert.equal(values.intervalValue, '30');
  assert.equal(values.intervalUnit, 'minute');
  assert.equal(values.prompt, 'Summarize the last 24 hours for the team.');
  assert.equal(values.sessionMode, 'isolated');
  assert.equal(values.wakeUpMode, 'immediate');
  assert.equal(values.executionContent, 'runAssistantTask');
  assert.equal(values.timeoutSeconds, '90');
  assert.equal(values.deliveryMode, 'publishSummary');
  assert.equal(values.deliveryChannel, 'telegram');
  assert.equal(values.recipient, 'ops-room');
});

runTest('buildTaskFormValuesFromTask maps paused datetime message tasks correctly', () => {
  const values = buildTaskFormValuesFromTask(
    createTask({
      scheduleMode: 'datetime',
      schedule: 'at 2026-03-21 09:15',
      scheduleConfig: {
        scheduledDate: '2026-03-21',
        scheduledTime: '09:15',
      },
      cronExpression: '15 9 21 3 *',
      actionType: 'message',
      status: 'paused',
      sessionMode: 'main',
      wakeUpMode: 'nextCycle',
      executionContent: 'sendPromptMessage',
      timeoutSeconds: undefined,
      deliveryMode: 'none',
      deliveryChannel: undefined,
      recipient: undefined,
    }),
  );

  assert.equal(values.enabled, false);
  assert.equal(values.scheduleMode, 'datetime');
  assert.equal(values.scheduledDate, '2026-03-21');
  assert.equal(values.scheduledTime, '09:15');
  assert.equal(values.cronExpression, '15 9 21 3 *');
  assert.equal(values.actionType, 'message');
  assert.equal(values.sessionMode, 'main');
  assert.equal(values.wakeUpMode, 'nextCycle');
  assert.equal(values.executionContent, 'sendPromptMessage');
  assert.equal(values.timeoutSeconds, '');
  assert.equal(values.deliveryMode, 'none');
  assert.equal(values.deliveryChannel, '');
  assert.equal(values.recipient, '');
});
