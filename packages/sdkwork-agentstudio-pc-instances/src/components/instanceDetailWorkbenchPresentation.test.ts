import assert from 'node:assert/strict';
import {
  buildInstanceWorkbenchResourceMetrics,
  buildInstanceWorkbenchSummaryMetrics,
  buildTaskScheduleSummary,
  getCapabilityTone,
  getDangerBadge,
  getManagementEntryTone,
  getRuntimeStatusTone,
  getStatusBadge,
  workbenchSections,
} from './instanceDetailWorkbenchPresentation.ts';

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

await runTest(
  'workbenchSections preserves the current Instance Detail section order and translation keys',
  () => {
    assert.deepEqual(
      workbenchSections.map((section) => section.id),
      [
        'overview',
        'channels',
        'cronTasks',
        'llmProviders',
        'agents',
        'skills',
        'files',
        'memory',
        'tools',
        'config',
      ],
    );
    assert.equal(
      workbenchSections[0]?.labelKey,
      'instances.detail.instanceWorkbench.sidebar.overview',
    );
    assert.equal(
      workbenchSections[3]?.sectionDescriptionKey,
      'instances.detail.instanceWorkbench.sections.llmProviders.description',
    );
  },
);

await runTest(
  'buildInstanceWorkbenchSummaryMetrics preserves the current summary card order and values',
  () => {
    assert.deepEqual(
      buildInstanceWorkbenchSummaryMetrics({
        healthScore: 96,
        connectedChannelCount: 4,
        activeTaskCount: 2,
        readyToolCount: 7,
        agents: [{}, {}],
        installedSkillCount: 9,
      } as any),
      [
        {
          id: 'healthScore',
          labelKey: 'instances.detail.instanceWorkbench.summary.healthScore',
          value: '96%',
        },
        {
          id: 'connectedChannels',
          labelKey: 'instances.detail.instanceWorkbench.summary.connectedChannels',
          value: '4',
        },
        {
          id: 'activeTasks',
          labelKey: 'instances.detail.instanceWorkbench.summary.activeTasks',
          value: '2',
        },
        {
          id: 'readyTools',
          labelKey: 'instances.detail.instanceWorkbench.summary.readyTools',
          value: '7',
        },
        {
          id: 'agents',
          labelKey: 'instances.detail.instanceWorkbench.summary.agents',
          value: '2',
        },
        {
          id: 'skills',
          labelKey: 'instances.detail.instanceWorkbench.summary.skills',
          value: '9',
        },
      ],
    );
  },
);

await runTest(
  'buildInstanceWorkbenchResourceMetrics preserves cpu and memory sidebar cards',
  () => {
    assert.deepEqual(
      buildInstanceWorkbenchResourceMetrics({
        cpu: 38,
        memory: 61,
        totalMemory: '32 GB',
      } as any),
      [
        {
          id: 'cpuLoad',
          labelKey: 'instances.detail.instanceWorkbench.summary.cpuLoad',
          value: '38%',
        },
        {
          id: 'memoryPressure',
          labelKey: 'instances.detail.instanceWorkbench.summary.memoryPressure',
          value: '61%',
          detail: '32 GB',
        },
      ],
    );
  },
);

await runTest(
  'Instance Detail workbench presentation helpers keep runtime and status badge tone mapping stable',
  () => {
    assert.equal(
      getRuntimeStatusTone('healthy'),
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    );
    assert.equal(
      getRuntimeStatusTone('attention'),
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    );
    assert.equal(
      getRuntimeStatusTone('offline'),
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    );
    assert.equal(
      getRuntimeStatusTone('degraded'),
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    );

    assert.equal(
      getStatusBadge('connected'),
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    );
    assert.equal(
      getStatusBadge('configurationRequired'),
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    );
    assert.equal(
      getStatusBadge('idle'),
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    );
    assert.equal(
      getDangerBadge('failed'),
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    );
    assert.equal(
      getDangerBadge('ready'),
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    );
  },
);

await runTest(
  'buildTaskScheduleSummary keeps interval, datetime, and fallback summary formatting stable',
  () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key;

    assert.equal(
      buildTaskScheduleSummary(t, {
        scheduleMode: 'interval',
        scheduleConfig: {
          intervalValue: 2,
          intervalUnit: 'hour',
        },
      } as any),
      'tasks.page.scheduleSummary.interval:{"value":2,"unit":"tasks.page.intervalUnits.hours"}',
    );

    assert.equal(
      buildTaskScheduleSummary(t, {
        scheduleMode: 'datetime',
        scheduleConfig: {
          scheduledDate: '2026-04-09',
          scheduledTime: '10:30',
        },
      } as any),
      'tasks.page.scheduleSummary.datetime:{"date":"2026-04-09","time":"10:30"}',
    );

    assert.equal(
      buildTaskScheduleSummary(t, {
        scheduleMode: 'cron',
        scheduleConfig: {},
        cronExpression: '0 0 * * *',
        schedule: 'cron',
      } as any),
      '0 0 * * *',
    );
  },
);

await runTest(
  'Instance Detail capability and management entry tones keep overview presentation mapping stable',
  () => {
    assert.equal(
      getCapabilityTone('ready'),
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    );
    assert.equal(
      getCapabilityTone('degraded'),
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    );
    assert.equal(
      getCapabilityTone('planned'),
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    );
    assert.equal(
      getCapabilityTone('offline'),
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    );

    assert.equal(
      getManagementEntryTone('success'),
      'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    );
    assert.equal(
      getManagementEntryTone('warning'),
      'border-amber-200/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
    );
    assert.equal(
      getManagementEntryTone('neutral'),
      'border-zinc-200/70 bg-zinc-950/[0.02] dark:border-zinc-800 dark:bg-white/[0.03]',
    );
  },
);
