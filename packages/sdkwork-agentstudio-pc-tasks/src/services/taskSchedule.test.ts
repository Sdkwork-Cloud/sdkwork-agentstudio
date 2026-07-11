import assert from 'node:assert/strict';
import {
  buildCreateTaskInput,
  collectTaskFormErrors,
  createDefaultTaskFormValues,
  serializeTaskSchedule,
} from './taskSchedule.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('serializeTaskSchedule creates interval schedules for minutes, hours, and days', () => {
  const minuteValues = {
    ...createDefaultTaskFormValues(),
    scheduleMode: 'interval' as const,
    intervalValue: '30',
    intervalUnit: 'minute' as const,
  };
  const hourValues = {
    ...createDefaultTaskFormValues(),
    scheduleMode: 'interval' as const,
    intervalValue: '2',
    intervalUnit: 'hour' as const,
  };
  const dayValues = {
    ...createDefaultTaskFormValues(),
    scheduleMode: 'interval' as const,
    intervalValue: '3',
    intervalUnit: 'day' as const,
  };

  assert.deepEqual(serializeTaskSchedule(minuteValues), {
    schedule: '@every 30m',
    cronExpression: '*/30 * * * *',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 30,
      intervalUnit: 'minute',
    },
  });
  assert.deepEqual(serializeTaskSchedule(hourValues), {
    schedule: '@every 2h',
    cronExpression: '0 */2 * * *',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 2,
      intervalUnit: 'hour',
    },
  });
  assert.deepEqual(serializeTaskSchedule(dayValues), {
    schedule: '@every 3d',
    cronExpression: '0 0 */3 * *',
    scheduleMode: 'interval',
    scheduleConfig: {
      intervalValue: 3,
      intervalUnit: 'day',
    },
  });
});

runTest('serializeTaskSchedule creates a fixed date/time schedule', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    scheduleMode: 'datetime' as const,
    scheduledDate: '2026-03-21',
    scheduledTime: '09:15',
  };

  assert.deepEqual(serializeTaskSchedule(values), {
    schedule: 'at 2026-03-21 09:15',
    cronExpression: '15 9 21 3 *',
    scheduleMode: 'datetime',
    scheduleConfig: {
      scheduledDate: '2026-03-21',
      scheduledTime: '09:15',
    },
  });
});

runTest('serializeTaskSchedule preserves raw cron expressions', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    scheduleMode: 'cron' as const,
    cronExpression: '15 9 * * 1',
  };

  assert.deepEqual(serializeTaskSchedule(values), {
    schedule: '15 9 * * 1',
    cronExpression: '15 9 * * 1',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '15 9 * * 1',
    },
  });
});

runTest('collectTaskFormErrors reports missing required fields', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: ' ',
    prompt: '',
    scheduleMode: 'interval' as const,
    intervalValue: '',
  };

  assert.deepEqual(collectTaskFormErrors(values), {
    name: 'required',
    prompt: 'required',
    intervalValue: 'required',
  });
});

runTest('buildCreateTaskInput maps enabled tasks into payload fields', () => {
  const values = {
    ...createDefaultTaskFormValues(),
    name: 'Morning Brief',
    description: 'Daily summary',
    prompt: 'Summarize the last 24 hours.',
    actionType: 'message' as const,
    enabled: false,
    scheduleMode: 'cron' as const,
    cronExpression: '0 9 * * *',
  };

  assert.deepEqual(buildCreateTaskInput(values), {
    name: 'Morning Brief',
    description: 'Daily summary',
    prompt: 'Summarize the last 24 hours.',
    actionType: 'skill',
    status: 'paused',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: undefined,
    deliveryMode: 'publishSummary',
    deliveryChannel: undefined,
    recipient: undefined,
    schedule: '0 9 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 9 * * *',
    },
    cronExpression: '0 9 * * *',
  });
});
