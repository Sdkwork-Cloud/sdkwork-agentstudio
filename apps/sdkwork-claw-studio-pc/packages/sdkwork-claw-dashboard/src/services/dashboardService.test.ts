import assert from 'node:assert/strict';
import type {
  Agent,
  ProviderUsageRecord,
  Skill,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioWorkbenchChannelRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';
import type { DashboardAnalyticsQuery } from '../types';
import { createDashboardService } from './dashboardService.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function buildUsageRecord(
  projectId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  amount: number,
  createdAtMs: number,
): ProviderUsageRecord {
  return {
    id: `${projectId}-${model}-${createdAtMs}`,
    apiKeyId: projectId,
    apiKeyName: projectId,
    model,
    reasoningEffort: 'medium',
    endpoint: '/v1/chat/completions',
    type: 'standard',
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    cachedTokens: 0,
    costUsd: amount,
    ttftMs: 120,
    durationMs: 860,
    startedAt: new Date(createdAtMs).toISOString(),
    userAgent: 'dashboard-service-test',
  };
}

function buildUsagePage(items: ProviderUsageRecord[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length || 1,
    hasMore: false,
  };
}

function buildInstanceRecord(
  overrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceRecord {
  return {
    id: 'instance-default',
    name: 'Default Instance',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '1.0.0',
    typeLabel: 'Server',
    host: '127.0.0.1',
    port: 28789,
    baseUrl: null,
    websocketUrl: null,
    cpu: 4,
    memory: 32,
    totalMemory: '64 GB',
    uptime: '2d',
    capabilities: ['chat', 'models', 'tasks'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '28789',
      sandbox: false,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      authToken: 'token-default',
    },
    createdAt: Date.UTC(2026, 2, 1),
    updatedAt: Date.UTC(2026, 2, 1),
    lastSeenAt: Date.UTC(2026, 2, 1),
    ...overrides,
  };
}

function buildTask(
  overrides: Partial<StudioWorkbenchTaskRecord> = {},
): StudioWorkbenchTaskRecord {
  return {
    id: 'task-default',
    name: 'Task Default',
    description: '',
    prompt: 'Say hello',
    schedule: '0 * * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 * * * *',
    },
    cronExpression: '0 * * * *',
    actionType: 'message',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'sendPromptMessage',
    deliveryMode: 'none',
    latestExecution: null,
    ...overrides,
  };
}

function buildChannel(
  overrides: Partial<StudioWorkbenchChannelRecord> = {},
): StudioWorkbenchChannelRecord {
  return {
    id: 'channel-default',
    name: 'Channel Default',
    description: '',
    status: 'connected',
    enabled: true,
    configurationMode: 'required',
    fieldCount: 1,
    configuredFieldCount: 1,
    setupSteps: [],
    ...overrides,
  };
}

function buildSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-default',
    name: 'Skill Default',
    description: '',
    author: 'sdkwork',
    rating: 5,
    downloads: 10,
    category: 'automation',
    ...overrides,
  };
}

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-default',
    name: 'Agent Default',
    description: 'Operations agent',
    avatar: 'robot',
    systemPrompt: 'Help with operations.',
    creator: 'sdkwork',
    ...overrides,
  };
}

function buildInstanceDetail(
  instance: StudioInstanceRecord,
  options: {
    tasks?: StudioWorkbenchTaskRecord[];
    channels?: StudioWorkbenchChannelRecord[];
    skills?: Skill[];
    agents?: Agent[];
  } = {},
): StudioInstanceDetailRecord {
  const tasks = options.tasks ?? [];
  const channels = options.channels ?? [];
  const skills = options.skills ?? [];
  const agents = options.agents ?? [];

  return {
    instance,
    config: { ...instance.config },
    logs: 'instance log line',
    health: {
      score: 92,
      status: 'healthy',
      checks: [],
      evaluatedAt: Date.UTC(2026, 2, 1),
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: true,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'claw-studio',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: instance.transportKind,
      endpoints: [],
    },
    observability: {
      status: 'ready',
      logAvailable: true,
      logPreview: ['instance log line'],
      metricsSource: 'runtime',
      lastSeenAt: Date.UTC(2026, 2, 1),
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    workbench: {
      channels,
      cronTasks: {
        tasks,
        taskExecutionsById: {},
      },
      llmProviders: [],
      agents: agents.map((agent) => ({
        agent,
        focusAreas: ['Automation'],
        automationFitScore: 88,
      })),
      skills,
      files: [],
      memory: [],
      tools: [],
    },
  };
}

function createService(options: {
  usageRecords?: ProviderUsageRecord[];
  usageError?: Error;
  instances?: StudioInstanceRecord[];
  detailsById?: Record<string, StudioInstanceDetailRecord | null>;
  commerceSnapshot?: any;
  commerceError?: Error;
} = {}) {
  const detailsById = options.detailsById ?? {};

  return createDashboardService({
    studioApi: {
      listInstances: async () => options.instances ?? [],
      getInstanceDetail: async (id) => detailsById[id] ?? null,
    },
    usageRecordsApi: {
      listProviderUsageRecords: async () => {
        if (options.usageError) {
          throw options.usageError;
        }

        return buildUsagePage(options.usageRecords ?? []);
      },
    },
    dashboardCommerceApi: {
      getCommerceSnapshot: async (query: DashboardAnalyticsQuery = {}) => {
        if (options.commerceError) {
          throw options.commerceError;
        }

        return (
          options.commerceSnapshot ?? {
            businessSummary: {
              todayRevenue: 0,
              weekRevenue: 0,
              monthRevenue: 0,
              yearRevenue: 0,
              todayOrders: 0,
              weekOrders: 0,
              monthOrders: 0,
              yearOrders: 0,
              averageOrderValue: 0,
              conversionRate: 0,
              revenueDelta: 0,
            },
            revenueAnalytics: {
              granularity: query.granularity ?? 'day',
              rangeMode: query.rangeMode ?? 'seven_days',
              totalRevenue: 0,
              dailyRevenue: 0,
              projectedMonthlyRevenue: 0,
              totalOrders: 0,
              averageOrderValue: 0,
              peakRevenueLabel: '--',
              peakRevenueValue: 0,
              deltaPercentage: 0,
              revenueTrend: [],
              productBreakdown: [],
            },
            recentRevenueRecords: [],
            productPerformance: [],
          }
        );
      },
    },
  });
}

await runTest('dashboardService builds token analytics for the dashboard snapshot from real usage records', async () => {
  const dashboardService = createService({
    usageRecords: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 100, 40, 0.14, Date.UTC(2026, 2, 12, 10)),
      buildUsageRecord('project-alpha', 'gpt-5.4', 60, 20, 0.08, Date.UTC(2026, 2, 12, 15)),
      buildUsageRecord(
        'project-beta',
        'claude-sonnet-4.5',
        90,
        30,
        0.12,
        Date.UTC(2026, 2, 14, 9),
      ),
      buildUsageRecord(
        'project-beta',
        'claude-sonnet-4.5',
        110,
        50,
        0.16,
        Date.UTC(2026, 2, 18, 11),
      ),
    ],
  });

  const daySnapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });
  const hourSnapshot = await dashboardService.getSnapshot({
    granularity: 'hour',
    rangeMode: 'month',
    monthKey: '2026-03',
  });
  const customSnapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'custom',
    customStart: '2026-03-01',
    customEnd: '2026-03-18',
  });

  assert.ok(daySnapshot.businessSummary);
  assert.ok(daySnapshot.revenueAnalytics);
  assert.ok(daySnapshot.activityFeed);
  assert.equal(daySnapshot.tokenAnalytics.granularity, 'day');
  assert.equal(daySnapshot.tokenAnalytics.rangeMode, 'seven_days');
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.length, 7);
  assert.equal(daySnapshot.tokenAnalytics.totalTokens, 500);
  assert.equal(daySnapshot.tokenAnalytics.inputTokens, 360);
  assert.equal(daySnapshot.tokenAnalytics.outputTokens, 140);
  assert.equal(daySnapshot.tokenAnalytics.cacheCreationTokens, 0);
  assert.equal(daySnapshot.tokenAnalytics.cacheReadTokens, 0);
  assert.equal(daySnapshot.tokenAnalytics.actualAmount, 0.5);
  assert.equal(daySnapshot.tokenAnalytics.standardAmount, 0.5);
  assert.equal(daySnapshot.tokenAnalytics.totalRequestCount, 4);
  assert.equal(
    daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-12')
      ?.totalTokens,
    220,
  );
  assert.equal(
    daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-14')
      ?.totalTokens,
    120,
  );
  assert.equal(
    daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-18')
      ?.totalTokens,
    160,
  );
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown.length, 2);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.id, 'claude-sonnet-4.5');
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.tokens, 280);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.requestCount, 2);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.actualAmount, 0.28);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.standardAmount, 0.28);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[1]?.id, 'gpt-5.4');
  assert.equal(daySnapshot.tokenSummary.dailyRequestCount, 1);
  assert.equal(daySnapshot.tokenSummary.dailyTokenCount, 160);
  assert.equal(daySnapshot.tokenSummary.dailySpend, 0.16);
  assert.equal(daySnapshot.tokenSummary.weeklyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.weeklyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.weeklySpend, 0.5);
  assert.equal(daySnapshot.tokenSummary.monthlyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.monthlyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.monthlySpend, 0.5);
  assert.equal(daySnapshot.tokenSummary.yearlyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.yearlyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.yearlySpend, 0.5);
  assert.equal(daySnapshot.activityFeed.recentApiCalls.length, 4);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.modelName, 'claude-sonnet-4.5');
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.providerName, 'anthropic');
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.requestCount, 1);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.tokenCount, 160);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.costAmount, 0.16);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.status, 'success');
  assert.equal(
    daySnapshot.activityFeed.recentApiCalls[0]?.timestamp,
    new Date(Date.UTC(2026, 2, 18, 11)).toISOString(),
  );
  assert.equal(hourSnapshot.tokenAnalytics.granularity, 'hour');
  assert.equal(hourSnapshot.tokenAnalytics.rangeMode, 'month');
  assert.equal(hourSnapshot.tokenAnalytics.selectedMonthKey, '2026-03');
  assert.equal(
    hourSnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-18T11:00')
      ?.totalTokens,
    160,
  );
  assert.equal(customSnapshot.tokenAnalytics.rangeMode, 'custom');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.start, '2026-03-01');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.end, '2026-03-18');
  assert.equal(customSnapshot.tokenAnalytics.totalTokens, 500);
  assert.equal(customSnapshot.revenueAnalytics.totalRevenue, 0);
});

await runTest('dashboardService returns an empty token snapshot when usage records are unavailable', async () => {
  const dashboardService = createService({
    usageError: new Error('usage records offline'),
  });

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.tokenAnalytics.totalTokens, 0);
  assert.equal(snapshot.tokenAnalytics.totalRequestCount, 0);
  assert.equal(snapshot.tokenAnalytics.modelBreakdown.length, 0);
  assert.equal(snapshot.tokenAnalytics.instanceBreakdown.length, 0);
  assert.equal(snapshot.tokenSummary.dailyRequestCount, 0);
  assert.equal(snapshot.tokenSummary.dailyTokenCount, 0);
  assert.equal(snapshot.tokenSummary.dailySpend, 0);
  assert.equal(snapshot.activityFeed.recentApiCalls.length, 0);
});

await runTest('dashboardService surfaces commerce data from the shared commerce wrapper', async () => {
  const dashboardService = createService({
    usageRecords: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 100, 40, 0.14, Date.UTC(2026, 2, 24, 9)),
    ],
    commerceSnapshot: {
      businessSummary: {
        todayRevenue: 120,
        weekRevenue: 200,
        monthRevenue: 240,
        yearRevenue: 240,
        todayOrders: 1,
        weekOrders: 3,
        monthOrders: 4,
        yearOrders: 4,
        averageOrderValue: 66.67,
        conversionRate: 33.3,
        revenueDelta: 400,
      },
      revenueAnalytics: {
        granularity: 'day',
        rangeMode: 'seven_days',
        totalRevenue: 200,
        dailyRevenue: 28.57,
        projectedMonthlyRevenue: 857.1,
        totalOrders: 3,
        averageOrderValue: 66.67,
        peakRevenueLabel: '03-24',
        peakRevenueValue: 120,
        deltaPercentage: 400,
        revenueTrend: [
          {
            label: '03-24',
            bucketKey: '2026-03-24',
            revenue: 120,
            orders: 1,
            averageOrderValue: 120,
          },
        ],
        productBreakdown: [
          {
            id: '11',
            productName: 'VIP Membership',
            orders: 1,
            revenue: 120,
            share: 60,
            dailyRevenue: 17.14,
          },
        ],
      },
      recentRevenueRecords: [
        {
          id: 'record-1',
          timestamp: '2026-03-24T09:00:00Z',
          productName: 'VIP Membership',
          orderNo: 'SN-001',
          revenueAmount: 120,
          channel: 'app',
          status: 'completed',
        },
      ],
      productPerformance: [
        {
          id: '11',
          productName: 'VIP Membership',
          revenue: 120,
          orders: 1,
          share: 60,
          trendDelta: 200,
        },
      ],
    },
  });

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.businessSummary.todayRevenue, 120);
  assert.equal(snapshot.revenueAnalytics.productBreakdown[0]?.productName, 'VIP Membership');
  assert.equal(snapshot.activityFeed.recentRevenueRecords[0]?.status, 'completed');
  assert.equal(snapshot.activityFeed.productPerformance[0]?.productName, 'VIP Membership');
});

await runTest('dashboardService keeps token analytics available when commerce loading fails', async () => {
  const dashboardService = createService({
    usageRecords: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 100, 40, 0.14, Date.UTC(2026, 2, 24, 9)),
    ],
    commerceError: new Error('commerce unavailable'),
  });

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.tokenAnalytics.totalTokens, 140);
  assert.equal(snapshot.revenueAnalytics.totalRevenue, 0);
  assert.deepEqual(snapshot.activityFeed.recentRevenueRecords, []);
  assert.deepEqual(snapshot.activityFeed.productPerformance, []);
});

await runTest('dashboardService aggregates per-instance workbench data from studio detail records', async () => {
  const detailCalls: string[] = [];
  const instanceAlpha = buildInstanceRecord({
    id: 'instance-alpha',
    name: 'Instance Alpha',
    host: '127.0.0.1',
  });
  const instanceBeta = buildInstanceRecord({
    id: 'instance-beta',
    name: 'Instance Beta',
    host: '127.0.0.2',
    status: 'offline',
  });

  const dashboardService = createDashboardService({
    studioApi: {
      listInstances: async () => [instanceAlpha, instanceBeta],
      getInstanceDetail: async (id) => {
        detailCalls.push(id);

        if (id === instanceAlpha.id) {
          return buildInstanceDetail(instanceAlpha, {
            tasks: [buildTask({ id: 'alpha-task', name: 'Alpha Task' })],
            channels: [buildChannel({ id: 'alpha-channel', name: 'Alpha Channel' })],
            skills: [buildSkill({ id: 'alpha-skill', name: 'Alpha Skill' })],
            agents: [buildAgent({ id: 'alpha-agent', name: 'Alpha Agent' })],
          });
        }

        if (id === instanceBeta.id) {
          return buildInstanceDetail(instanceBeta, {
            tasks: [buildTask({ id: 'beta-task', name: 'Beta Task', status: 'paused' })],
            channels: [
              buildChannel({
                id: 'beta-channel',
                name: 'Beta Channel',
                status: 'disconnected',
                enabled: false,
              }),
            ],
            skills: [buildSkill({ id: 'beta-skill', name: 'Beta Skill' })],
            agents: [buildAgent({ id: 'beta-agent', name: 'Beta Agent' })],
          });
        }

        return null;
      },
    },
    usageRecordsApi: {
      listProviderUsageRecords: async () => buildUsagePage([]),
    },
  });

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.deepEqual(detailCalls, ['instance-alpha', 'instance-beta']);
  assert.equal(snapshot.totalInstanceCount, 2);
  assert.equal(snapshot.activeInstanceCount, 1);
  assert.equal(snapshot.activeAutomationCount, 1);
  assert.equal(snapshot.pausedAutomationCount, 1);
  assert.equal(snapshot.connectedChannelCount, 1);
  assert.equal(snapshot.installedSkillCount, 2);
  assert.equal(snapshot.instances.length, 2);
  assert.equal(snapshot.agents.length, 2);
  assert.equal(snapshot.tasks.length, 2);
  assert.equal(snapshot.channels.length, 2);
  assert.equal(snapshot.installedSkills.length, 2);
});
