import assert from 'node:assert/strict';
import {
  buildOpenClawCronTaskPayload,
  type CronTaskCreateInput,
} from './cronTaskPayload.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createInput(overrides: Partial<CronTaskCreateInput> = {}): CronTaskCreateInput {
  return {
    name: 'Morning brief',
    description: 'Summarize overnight updates.',
    prompt: 'Summarize overnight updates.',
    schedule: '0 7 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 7 * * *',
    },
    cronExpression: '0 7 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 600,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'telegram',
    recipient: 'channel:daily-brief',
    ...overrides,
  };
}

runTest('buildOpenClawCronTaskPayload maps isolated assistant tasks into OpenClaw cron.add payloads', () => {
  assert.deepEqual(buildOpenClawCronTaskPayload(createInput()), {
    name: 'Morning brief',
    description: 'Summarize overnight updates.',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '0 7 * * *',
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: 'Summarize overnight updates.',
      timeoutSeconds: 600,
    },
    delivery: {
      mode: 'announce',
      channel: 'telegram',
      to: 'channel:daily-brief',
    },
  });
});

runTest('buildOpenClawCronTaskPayload maps main-session prompt jobs into systemEvent payloads', () => {
  assert.deepEqual(
    buildOpenClawCronTaskPayload(
      createInput({
        name: 'Main session reminder',
        actionType: 'message',
        sessionMode: 'main',
        wakeUpMode: 'nextCycle',
        executionContent: 'sendPromptMessage',
        deliveryMode: 'none',
        deliveryChannel: undefined,
        recipient: undefined,
      }),
    ),
    {
      name: 'Main session reminder',
      description: 'Summarize overnight updates.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 7 * * *',
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        text: 'Summarize overnight updates.',
      },
    },
  );
});

runTest('buildOpenClawCronTaskPayload rejects unsupported OpenClaw payload/session combinations', () => {
  assert.throws(
    () =>
      buildOpenClawCronTaskPayload(
        createInput({
          sessionMode: 'main',
          executionContent: 'runAssistantTask',
        }),
      ),
    /Main session jobs require systemEvent payloads/,
  );

  assert.throws(
    () =>
      buildOpenClawCronTaskPayload(
        createInput({
          sessionMode: 'isolated',
          executionContent: 'sendPromptMessage',
        }),
      ),
    /Isolated jobs require agentTurn payloads/,
  );
});

runTest('buildOpenClawCronTaskPayload maps advanced OpenClaw cron capabilities for custom sessions and webhooks', () => {
  assert.deepEqual(
    buildOpenClawCronTaskPayload(
      createInput({
        name: 'Project monitor',
        scheduleConfig: {
          cronExpression: '0 7 * * *',
          cronTimezone: 'Asia/Shanghai',
          staggerMs: 30000,
        },
        sessionMode: 'custom',
        customSessionId: 'project-alpha-monitor',
        deleteAfterRun: true,
        agentId: 'ops',
        model: 'openai/gpt-5.4',
        thinking: 'high',
        lightContext: true,
        deliveryMode: 'webhook',
        deliveryChannel: undefined,
        recipient: 'https://hooks.example.com/openclaw/cron',
        deliveryBestEffort: true,
      }),
    ),
    {
      name: 'Project monitor',
      description: 'Summarize overnight updates.',
      enabled: true,
      deleteAfterRun: true,
      agentId: 'ops',
      schedule: {
        kind: 'cron',
        expr: '0 7 * * *',
        tz: 'Asia/Shanghai',
        staggerMs: 30000,
      },
      sessionTarget: 'session:project-alpha-monitor',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Summarize overnight updates.',
        model: 'openai/gpt-5.4',
        thinking: 'high',
        timeoutSeconds: 600,
        lightContext: true,
      },
      delivery: {
        mode: 'webhook',
        to: 'https://hooks.example.com/openclaw/cron',
        bestEffort: true,
      },
    },
  );
});

runTest('buildOpenClawCronTaskPayload writes explicit agent-turn tool allowlists into the native payload', () => {
  assert.deepEqual(
    buildOpenClawCronTaskPayload(
      createInput({
        toolAllowlist: ['exec', 'group:filesystem', 'read'],
      }),
    ),
    {
      name: 'Morning brief',
      description: 'Summarize overnight updates.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 7 * * *',
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Summarize overnight updates.',
        timeoutSeconds: 600,
        tools: ['exec', 'group:filesystem', 'read'],
      },
      delivery: {
        mode: 'announce',
        channel: 'telegram',
        to: 'channel:daily-brief',
      },
    },
  );
});

runTest('buildOpenClawCronTaskPayload preserves advanced nested OpenClaw fields when editing simplified fields', () => {
  const originalDefinition = {
    id: 'job-1',
    createdAtMs: 100,
    updatedAtMs: 200,
    state: {
      nextRunAtMs: 300,
    },
    schedule: {
      kind: 'cron',
      expr: '0 7 * * *',
      tz: 'Asia/Shanghai',
      staggerMs: 45000,
    },
    payload: {
      kind: 'agentTurn',
      message: 'Summarize overnight updates.',
      model: 'openai/gpt-5.4',
      thinking: 'medium',
      timeoutSeconds: 600,
      lightContext: true,
      tools: ['exec', 'group:filesystem'],
      fallbacks: ['openai/gpt-5.3'],
    },
    delivery: {
      mode: 'announce',
      channel: 'telegram',
      to: 'channel:daily-brief',
      accountId: 'bot-default',
      bestEffort: true,
    },
  };

  assert.deepEqual(
    buildOpenClawCronTaskPayload(
      createInput({
        name: 'Morning brief updated',
        scheduleConfig: {
          cronExpression: '0 7 * * *',
          cronTimezone: 'Asia/Shanghai',
          staggerMs: 45000,
        },
        model: 'openai/gpt-5.4',
        thinking: 'medium',
        lightContext: true,
        deliveryBestEffort: true,
      }),
      originalDefinition,
    ),
    {
      name: 'Morning brief updated',
      description: 'Summarize overnight updates.',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 7 * * *',
        tz: 'Asia/Shanghai',
        staggerMs: 45000,
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: 'Summarize overnight updates.',
        model: 'openai/gpt-5.4',
        thinking: 'medium',
        timeoutSeconds: 600,
        lightContext: true,
        tools: ['exec', 'group:filesystem'],
        fallbacks: ['openai/gpt-5.3'],
      },
      delivery: {
        mode: 'announce',
        channel: 'telegram',
        to: 'channel:daily-brief',
        accountId: 'bot-default',
        bestEffort: true,
      },
    },
  );
});
