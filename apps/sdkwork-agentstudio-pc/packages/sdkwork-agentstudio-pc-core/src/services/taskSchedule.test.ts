import assert from 'node:assert/strict';
import { buildTaskFormValuesFromTask } from './taskFormMapping.ts';
import {
  buildCreateTaskInput,
  createDefaultTaskFormValues,
  isTaskThinkingLevel,
} from './taskSchedule.ts';
import type { Task } from './taskService.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('isTaskThinkingLevel only accepts supported thinking levels', () => {
  assert.equal(isTaskThinkingLevel('high'), true);
  assert.equal(isTaskThinkingLevel('minimal'), true);
  assert.equal(isTaskThinkingLevel('inherit'), false);
  assert.equal(isTaskThinkingLevel(''), false);
});

runTest('buildCreateTaskInput preserves custom session and thinking selections', () => {
  const values = createDefaultTaskFormValues();

  values.name = 'Project monitor';
  values.prompt = 'Summarize overnight updates.';
  values.scheduleMode = 'cron';
  values.cronExpression = '0 7 * * *';
  values.sessionMode = 'custom';
  values.customSessionId = 'project-alpha-monitor';
  values.thinking = 'high';
  values.deliveryMode = 'webhook';
  values.recipient = 'https://hooks.example.com/openclaw/cron';

  const payload = buildCreateTaskInput(values);

  assert.equal(payload.sessionMode, 'custom');
  assert.equal(payload.customSessionId, 'project-alpha-monitor');
  assert.equal(payload.thinking, 'high');
  assert.equal(payload.deliveryMode, 'webhook');
  assert.equal(payload.recipient, 'https://hooks.example.com/openclaw/cron');
});

runTest('buildCreateTaskInput normalizes multi-line task tool allowlists into unique tokens', () => {
  const values = createDefaultTaskFormValues();

  values.name = 'Restricted monitor';
  values.prompt = 'Summarize overnight updates.';
  values.scheduleMode = 'cron';
  values.cronExpression = '0 7 * * *';
  values.sessionMode = 'isolated';
  values.executionContent = 'runAssistantTask';
  values.toolAllowlist = 'exec\n group:filesystem \nexec\nread\n';

  const payload = buildCreateTaskInput(values);

  assert.deepEqual(payload.toolAllowlist, ['exec', 'group:filesystem', 'read']);
});

runTest('buildTaskFormValuesFromTask reads task tool allowlists from raw OpenClaw definitions', () => {
  const task: Task = {
    id: 'job-ops-daily',
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    prompt: 'Summarize operations updates.',
    schedule: '0 9 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 9 * * *',
    },
    cronExpression: '0 9 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'custom',
    customSessionId: 'project-alpha-monitor',
    wakeUpMode: 'nextCycle',
    executionContent: 'runAssistantTask',
    deliveryMode: 'webhook',
    recipient: 'https://hooks.example.com/openclaw/cron',
    rawDefinition: {
      payload: {
        kind: 'agentTurn',
        message: 'Summarize operations updates.',
        tools: ['exec', 'group:filesystem'],
      },
    },
  };

  const values = buildTaskFormValuesFromTask(task);

  assert.equal(values.toolAllowlist, 'exec\ngroup:filesystem');
});
