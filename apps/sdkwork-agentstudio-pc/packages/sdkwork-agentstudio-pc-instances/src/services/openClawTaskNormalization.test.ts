import assert from 'node:assert/strict';

function runTest(name: string, fn: () => void | Promise<void>) {
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

let taskNormalizationModule:
  | typeof import('./openClawTaskNormalization.ts')
  | undefined;

try {
  taskNormalizationModule = await import('./openClawTaskNormalization.ts');
} catch {
  taskNormalizationModule = undefined;
}

await runTest(
  'openClawTaskNormalization exposes shared task normalization and merge helpers',
  () => {
    assert.ok(taskNormalizationModule, 'Expected openClawTaskNormalization.ts to exist');
    assert.equal(typeof taskNormalizationModule?.normalizeWorkbenchTaskExecution, 'function');
    assert.equal(typeof taskNormalizationModule?.normalizeWorkbenchTask, 'function');
    assert.equal(typeof taskNormalizationModule?.normalizeWorkbenchTaskCollection, 'function');
    assert.equal(typeof taskNormalizationModule?.cloneWorkbenchTask, 'function');
    assert.equal(typeof taskNormalizationModule?.mergeWorkbenchTasks, 'function');
  },
);

await runTest(
  'normalizeWorkbenchTask normalizes ids, agent refs, latest execution defaults, and deep-clones rawDefinition',
  () => {
    const rawDefinition = {
      schedule: {
        expr: '0 9 * * *',
      },
    };

    const normalized = taskNormalizationModule?.normalizeWorkbenchTask({
      id: 'ops-daily',
      name: '  ',
      description: '  Daily runbook  ',
      prompt: '  Summarize incidents  ',
      schedule: ' 0 9 * * * ',
      scheduleMode: 'cron',
      scheduleConfig: {
        cronExpression: '0 9 * * *',
      },
      actionType: 'skill',
      status: 'active',
      sessionMode: 'isolated',
      wakeUpMode: 'immediate',
      executionContent: 'runAssistantTask',
      deliveryMode: 'publishSummary',
      deliveryLabel: ' Slack ',
      deliveryChannel: ' C001 ',
      recipient: ' channel:C001 ',
      agentId: 'Ops Lead',
      model: ' gpt-5.4 ',
      thinking: 'medium',
      latestExecution: {
        startedAt: '2025-03-19T01:00:00.000Z',
        status: 'success',
        trigger: 'unexpected',
        summary: '  ',
      },
      rawDefinition,
    });

    assert.ok(normalized);
    assert.equal(normalized?.id, 'ops-daily');
    assert.equal(normalized?.name, 'Ops Daily');
    assert.equal(normalized?.description, 'Daily runbook');
    assert.equal(normalized?.prompt, 'Summarize incidents');
    assert.equal(normalized?.schedule, '0 9 * * *');
    assert.equal(normalized?.agentId, 'ops-lead');
    assert.equal(normalized?.model, 'gpt-5.4');
    assert.equal(normalized?.deliveryLabel, 'Slack');
    assert.equal(normalized?.deliveryChannel, 'C001');
    assert.equal(normalized?.recipient, 'channel:C001');
    assert.equal(normalized?.latestExecution?.id, 'ops-daily-latest');
    assert.equal(normalized?.latestExecution?.taskId, 'ops-daily');
    assert.equal(normalized?.latestExecution?.trigger, 'schedule');
    assert.equal(normalized?.latestExecution?.summary, 'Task execution recorded.');
    assert.notEqual(normalized?.rawDefinition, rawDefinition);
    assert.deepEqual(normalized?.rawDefinition, rawDefinition);
  },
);

await runTest(
  'normalizeWorkbenchTaskCollection merges duplicate tasks, preserves first-seen order, and respects explicit null latestExecution',
  () => {
    const collection = taskNormalizationModule?.normalizeWorkbenchTaskCollection([
      {
        id: 'ops-daily',
        name: 'Ops Daily',
        prompt: 'Base prompt',
        schedule: '0 9 * * *',
        scheduleMode: 'cron',
        scheduleConfig: {
          cronExpression: '0 9 * * *',
        },
        actionType: 'skill',
        status: 'active',
        sessionMode: 'isolated',
        wakeUpMode: 'immediate',
        executionContent: 'runAssistantTask',
        deliveryMode: 'publishSummary',
        latestExecution: {
          id: 'ops-daily-run-1',
          taskId: 'ops-daily',
          status: 'success',
          trigger: 'schedule',
          startedAt: '2025-03-19T01:00:00.000Z',
          summary: 'Completed.',
        },
        rawDefinition: {
          source: 'base',
        },
      },
      {
        id: 'ops-daily',
        description: 'Merged from live gateway snapshot',
        scheduleConfig: {
          timezone: 'Asia/Shanghai',
        },
        status: 'paused',
        sessionMode: 'current',
        thinking: 'xhigh',
        latestExecution: null,
      },
      {
        id: 'ops-hourly',
        name: 'Ops Hourly',
        schedule: '0 * * * *',
        scheduleMode: 'cron',
        scheduleConfig: {
          cronExpression: '0 * * * *',
        },
        actionType: 'skill',
        status: 'active',
        sessionMode: 'isolated',
        wakeUpMode: 'immediate',
        executionContent: 'runAssistantTask',
        deliveryMode: 'none',
      },
      {
        latestExecution: {
          startedAt: '2025-03-19T02:00:00.000Z',
          status: 'success',
        },
      },
    ] as any[]);

    assert.deepEqual(
      collection?.map((task) => task.id),
      ['ops-daily', 'ops-hourly'],
    );
    assert.equal(collection?.[0]?.description, 'Merged from live gateway snapshot');
    assert.deepEqual(collection?.[0]?.scheduleConfig, {
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Shanghai',
    });
    assert.equal(collection?.[0]?.status, 'paused');
    assert.equal(collection?.[0]?.sessionMode, 'current');
    assert.equal(collection?.[0]?.thinking, 'xhigh');
    assert.equal(collection?.[0]?.latestExecution, null);
    assert.deepEqual(collection?.[0]?.rawDefinition, {
      source: 'base',
    });
  },
);

await runTest(
  'mergeWorkbenchTasks keeps base enums when overrides are invalid and deep-clones the resulting latest execution',
  () => {
    const merged = taskNormalizationModule?.mergeWorkbenchTasks(
      {
        id: 'ops-daily',
        name: 'Ops Daily',
        schedule: '0 9 * * *',
        scheduleMode: 'cron',
        scheduleConfig: {
          cronExpression: '0 9 * * *',
        },
        actionType: 'skill',
        status: 'active',
        sessionMode: 'isolated',
        wakeUpMode: 'immediate',
        executionContent: 'runAssistantTask',
        deliveryMode: 'publishSummary',
        latestExecution: {
          id: 'ops-daily-run-1',
          taskId: 'ops-daily',
          status: 'success',
          trigger: 'manual',
          startedAt: '2025-03-19T01:00:00.000Z',
          summary: 'Completed.',
        },
      } as any,
      {
        id: 'ops-daily',
        scheduleMode: 'invalid',
        actionType: 'invalid',
        status: 'invalid',
        sessionMode: 'invalid',
        wakeUpMode: 'invalid',
        executionContent: 'invalid',
        deliveryMode: 'invalid',
        latestExecution: {
          id: 'ops-daily-run-2',
          taskId: 'ops-daily',
          status: 'running',
          trigger: 'manual',
          startedAt: '2025-03-19T02:00:00.000Z',
          summary: 'Queued.',
        },
      } as any,
    );

    assert.equal(merged?.scheduleMode, 'cron');
    assert.equal(merged?.actionType, 'skill');
    assert.equal(merged?.status, 'active');
    assert.equal(merged?.sessionMode, 'isolated');
    assert.equal(merged?.wakeUpMode, 'immediate');
    assert.equal(merged?.executionContent, 'runAssistantTask');
    assert.equal(merged?.deliveryMode, 'publishSummary');
    assert.deepEqual(merged?.latestExecution, {
      id: 'ops-daily-run-2',
      taskId: 'ops-daily',
      status: 'running',
      trigger: 'manual',
      startedAt: '2025-03-19T02:00:00.000Z',
      finishedAt: undefined,
      summary: 'Queued.',
      details: undefined,
    });

    const cloned = taskNormalizationModule?.cloneWorkbenchTask(merged as any);
    assert.deepEqual(cloned, merged);
    assert.notEqual(cloned, merged);
    assert.notEqual(cloned?.latestExecution, merged?.latestExecution);
  },
);
