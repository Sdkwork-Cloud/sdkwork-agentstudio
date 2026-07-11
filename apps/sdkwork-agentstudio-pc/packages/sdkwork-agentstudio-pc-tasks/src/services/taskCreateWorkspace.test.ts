import assert from 'node:assert/strict';
import { collectTaskFormErrors, createDefaultTaskFormValues } from './taskSchedule.ts';
import { buildTaskCreateWorkspaceState } from './taskCreateWorkspace.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('workspace state treats prompt and schedule as part of basic info', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: 'Morning Brief',
  };

  const state = buildTaskCreateWorkspaceState(values, collectTaskFormErrors(values));

  assert.deepEqual(state.sections, [
    {
      id: 'basicInfo',
      status: 'attention',
      completedRequired: 2,
      totalRequired: 3,
    },
    {
      id: 'execution',
      status: 'complete',
      completedRequired: 3,
      totalRequired: 3,
    },
  ]);
  assert.deepEqual(state.readiness.blockingFields, ['prompt']);
  assert.equal(state.basicInfo.showScheduleAdvanced, false);
});

runTest('workspace state exposes cron editing as advanced schedule config in basic info', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: 'Weekly digest',
    prompt: 'Summarize the last week.',
    scheduleMode: 'cron' as const,
    cronExpression: '0 8 * * 1',
  };

  const state = buildTaskCreateWorkspaceState(values, collectTaskFormErrors(values));

  assert.equal(state.readiness.ready, true);
  assert.equal(state.basicInfo.showScheduleAdvanced, true);
  assert.deepEqual(state.basicInfo.scheduleFieldIds, []);
  assert.deepEqual(state.basicInfo.advancedFieldIds, ['cronExpression']);
});

runTest('workspace state keeps execution focused on runtime and delivery configuration', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: 'Board update',
    prompt: 'Prepare the board update.',
    scheduleMode: 'datetime' as const,
    scheduledDate: '2026-03-20',
    scheduledTime: '09:15',
  };

  const state = buildTaskCreateWorkspaceState(values, collectTaskFormErrors(values));

  assert.deepEqual(state.basicInfo.scheduleFieldIds, ['scheduledDate', 'scheduledTime']);
  assert.deepEqual(state.execution.runtimeFieldIds, [
    'sessionMode',
    'wakeUpMode',
    'executionContent',
    'timeoutSeconds',
  ]);
  assert.deepEqual(state.execution.deliveryFieldIds, [
    'deliveryMode',
    'deliveryChannel',
    'recipient',
  ]);
});

runTest('workspace state marks execution as needing attention when advanced runtime fields are invalid', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: 'Board update',
    prompt: 'Prepare the board update.',
    timeoutSeconds: '0',
  };

  const state = buildTaskCreateWorkspaceState(values, collectTaskFormErrors(values));
  const execution = state.sections.find((section) => section.id === 'execution');

  assert.equal(execution?.status, 'attention');
  assert.deepEqual(state.readiness.blockingFields, ['timeoutSeconds']);
});
