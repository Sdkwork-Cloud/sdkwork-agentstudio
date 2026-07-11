import { deepClone } from '@sdkwork/utils/compare';
import { studio } from '@sdkwork/agentstudio-pc-infrastructure';
import {
  createEmptyDashboardCommerceSnapshot,
  dashboardCommerceService,
} from '@sdkwork/agentstudio-pc-core';
import type {
  Agent,
  ProviderUsageRecord,
  ProviderUsageRecordsQuery,
  ProviderUsageRecordsResult,
  Skill,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioWorkbenchChannelRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/agentstudio-pc-types';
import type {
  DashboardActivityFeed,
  DashboardAlertItem,
  DashboardAgentSummary,
  DashboardApiCallRecord,
  DashboardAnalyticsGranularity,
  DashboardAnalyticsQuery,
  DashboardAnalyticsRangeMode,
  DashboardBusinessSummary,
  DashboardInstanceSummary,
  DashboardProductPerformanceRow,
  DashboardRevenueAnalytics,
  DashboardRevenueRecord,
  DashboardRecommendation,
  DashboardSnapshot,
  DashboardTokenAnalytics,
  DashboardTokenInstanceBreakdown,
  DashboardTokenSummary,
  DashboardTokenModelBreakdown,
  DashboardTokenTrendPoint,
} from '../types';

interface WorkspaceHealthScoreInput {
  instances: StudioInstanceRecord[];
  tasks: StudioWorkbenchTaskRecord[];
  channels: StudioWorkbenchChannelRecord[];
}

interface CapabilityCoverageScoreInput extends WorkspaceHealthScoreInput {
  agents: Agent[];
  installedSkills: Skill[];
}

interface DashboardServiceDependencies {
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  };
  usageRecordsApi: {
    listProviderUsageRecords(
      query: ProviderUsageRecordsQuery,
    ): Promise<ProviderUsageRecordsResult>;
  };
  dashboardCommerceApi: Pick<typeof dashboardCommerceService, 'getCommerceSnapshot'>;
}

export interface DashboardServiceDependencyOverrides {
  studioApi?: Partial<DashboardServiceDependencies['studioApi']>;
  usageRecordsApi?: Partial<DashboardServiceDependencies['usageRecordsApi']>;
  dashboardCommerceApi?: Partial<DashboardServiceDependencies['dashboardCommerceApi']>;
}

interface TokenAnalyticsInput {
  analyticsQuery: ResolvedAnalyticsQuery;
  usageRecords: DashboardUsageRecord[];
}

interface DashboardUsageRecord {
  project_id: string;
  model: string;
  provider: string;
  units: number;
  amount: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at_ms: number;
}

interface ResolvedAnalyticsQuery {
  granularity: DashboardAnalyticsGranularity;
  rangeMode: DashboardAnalyticsRangeMode;
  selectedMonthKey?: string;
  customRange?: {
    start: string;
    end: string;
  };
  bucketCount: number;
  bucketDates: Date[];
}

interface ModelProfile {
  id: string;
  modelName: string;
  weight: number;
  avgTokensPerRequest: number;
  actualRate: number;
  standardRate: number;
}

const REFERENCE_DATE = new Date(Date.UTC(2026, 2, 18, 12, 0, 0));
const DEFAULT_MONTH_KEY = '2026-03';
const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gpt-5.4',
    modelName: 'GPT-5.4',
    weight: 0.28,
    avgTokensPerRequest: 3600,
    actualRate: 0.0000122,
    standardRate: 0.0000139,
  },
  {
    id: 'claude-sonnet-4.5',
    modelName: 'Claude Sonnet 4.5',
    weight: 0.24,
    avgTokensPerRequest: 3100,
    actualRate: 0.0000114,
    standardRate: 0.0000128,
  },
  {
    id: 'gemini-2.5-pro',
    modelName: 'Gemini 2.5 Pro',
    weight: 0.19,
    avgTokensPerRequest: 2950,
    actualRate: 0.0000101,
    standardRate: 0.0000119,
  },
  {
    id: 'qwen2.5-coder-32b',
    modelName: 'Qwen2.5 Coder 32B',
    weight: 0.16,
    avgTokensPerRequest: 2450,
    actualRate: 0.0000068,
    standardRate: 0.0000077,
  },
  {
    id: 'deepseek-r1',
    modelName: 'DeepSeek R1',
    weight: 0.13,
    avgTokensPerRequest: 4000,
    actualRate: 0.0000086,
    standardRate: 0.0000098,
  },
];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function roundPercentage(value: number) {
  return Number(value.toFixed(1));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function cloneTask(task: StudioWorkbenchTaskRecord): StudioWorkbenchTaskRecord {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
    latestExecution: task.latestExecution ? { ...task.latestExecution } : task.latestExecution ?? null,
    rawDefinition: task.rawDefinition
      ? deepClone(task.rawDefinition) as Record<string, unknown>
      : undefined,
  };
}

function cloneChannel(channel: StudioWorkbenchChannelRecord): StudioWorkbenchChannelRecord {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
  };
}

function cloneSkill(skill: Skill): Skill {
  return {
    ...skill,
  };
}

function cloneAgent(agent: Agent): Agent {
  return {
    ...agent,
  };
}

function createEmptyUsageRecordsResult(): ProviderUsageRecordsResult {
  return {
    items: [],
    pageInfo: {
      mode: 'offset',
      page: 1,
      pageSize: 1,
      hasMore: false,
      totalItems: '0',
      totalPages: 0,
    },
  };
}

function createDefaultDependencies(): DashboardServiceDependencies {
  return {
    studioApi: {
      listInstances: () => studio.listInstances(),
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
    },
    usageRecordsApi: {
      listProviderUsageRecords: async () => createEmptyUsageRecordsResult(),
    },
    dashboardCommerceApi: {
      getCommerceSnapshot: (query) => dashboardCommerceService.getCommerceSnapshot(query),
    },
  };
}

function createUtcDate(year: number, monthIndex: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour, 0, 0));
}

function formatMonthKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function formatDayKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function formatHourKey(date: Date) {
  return `${formatDayKey(date)}T${`${date.getUTCHours()}`.padStart(2, '0')}:00`;
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return parseMonthKey(formatMonthKey(REFERENCE_DATE));
  }

  return { year, monthIndex: month - 1 };
}

function parseCustomDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return fallback;
  }

  return createUtcDate(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date.getTime());
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function startOfUtcDay(date: Date) {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcHour(date: Date) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
  );
}

function startOfUtcMonth(date: Date) {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function startOfUtcYear(date: Date) {
  return createUtcDate(date.getUTCFullYear(), 0, 1);
}

function addYears(date: Date, years: number) {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function buildDateRange(
  start: Date,
  bucketCount: number,
  granularity: DashboardAnalyticsGranularity,
) {
  return Array.from({ length: bucketCount }, (_, index) =>
    granularity === 'day' ? addDays(start, index) : addHours(start, index),
  );
}

function getBucketLabel(
  date: Date,
  granularity: DashboardAnalyticsGranularity,
) {
  if (granularity === 'day') {
    return `${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
  }

  return `${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')} ${`${date.getUTCHours()}`.padStart(2, '0')}:00`;
}

function getBucketKeyFromTimestamp(
  timestampMs: number,
  granularity: DashboardAnalyticsGranularity,
) {
  const date = new Date(timestampMs);
  return granularity === 'day' ? formatDayKey(date) : formatHourKey(date);
}

function getAnalyticsReferenceDate(records: DashboardUsageRecord[]) {
  if (records.length === 0) {
    return REFERENCE_DATE;
  }

  const latestTimestamp = records.reduce(
    (currentLatest, record) => Math.max(currentLatest, record.created_at_ms),
    0,
  );

  return new Date(latestTimestamp);
}

function toSafeNumber(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function getUsageRecordInputTokens(record: DashboardUsageRecord) {
  return Math.max(0, Math.round(toSafeNumber(record.input_tokens)));
}

function getUsageRecordOutputTokens(record: DashboardUsageRecord) {
  return Math.max(0, Math.round(toSafeNumber(record.output_tokens)));
}

function getUsageRecordTotalTokens(record: DashboardUsageRecord) {
  const explicitTotal = Math.max(0, Math.round(toSafeNumber(record.total_tokens)));
  if (explicitTotal > 0) {
    return explicitTotal;
  }

  const derivedTotal = getUsageRecordInputTokens(record) + getUsageRecordOutputTokens(record);
  if (derivedTotal > 0) {
    return derivedTotal;
  }

  return Math.max(0, Math.round(toSafeNumber(record.units)));
}

function getUsageRecordAmount(record: DashboardUsageRecord) {
  return Math.max(0, toSafeNumber(record.amount));
}

function calculateTokenShare(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return roundPercentage((value / total) * 100);
}

function getAnalyticsWindow(analyticsQuery: ResolvedAnalyticsQuery) {
  const firstBucketDate = analyticsQuery.bucketDates[0];
  const lastBucketDate =
    analyticsQuery.bucketDates[analyticsQuery.bucketDates.length - 1];

  if (!firstBucketDate || !lastBucketDate) {
    const fallbackStart =
      analyticsQuery.granularity === 'day'
        ? startOfUtcDay(REFERENCE_DATE)
        : startOfUtcHour(REFERENCE_DATE);

    return {
      startMs: fallbackStart.getTime(),
      endMs:
        (analyticsQuery.granularity === 'day'
          ? addDays(fallbackStart, 1)
          : addHours(fallbackStart, 1)
        ).getTime(),
    };
  }

  return {
    startMs: firstBucketDate.getTime(),
    endMs:
      (analyticsQuery.granularity === 'day'
        ? addDays(lastBucketDate, 1)
        : addHours(lastBucketDate, 1)
      ).getTime(),
  };
}

function filterUsageRecordsByTimeRange(
  records: DashboardUsageRecord[],
  startMs: number,
  endMs: number,
) {
  return records.filter(
    (record) => record.created_at_ms >= startMs && record.created_at_ms < endMs,
  );
}

function filterUsageRecordsForAnalytics(
  records: DashboardUsageRecord[],
  analyticsQuery: ResolvedAnalyticsQuery,
) {
  const { startMs, endMs } = getAnalyticsWindow(analyticsQuery);
  return filterUsageRecordsByTimeRange(records, startMs, endMs);
}

function summarizeUsageRecords(records: DashboardUsageRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.totalTokens += getUsageRecordTotalTokens(record);
      summary.inputTokens += getUsageRecordInputTokens(record);
      summary.outputTokens += getUsageRecordOutputTokens(record);
      summary.amount += getUsageRecordAmount(record);
      summary.requestCount += 1;

      return summary;
    },
    {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      amount: 0,
      requestCount: 0,
    },
  );
}

function inferProviderId(model: string) {
  const normalized = model.toLowerCase();

  if (normalized.includes('gpt') || normalized.includes('o4')) {
    return 'openai';
  }
  if (normalized.includes('claude')) {
    return 'anthropic';
  }
  if (normalized.includes('gemini')) {
    return 'google';
  }
  if (normalized.includes('qwen')) {
    return 'alibaba-cloud';
  }
  if (normalized.includes('deepseek')) {
    return 'deepseek';
  }

  return 'model-provider';
}

function mapUsageRecord(record: ProviderUsageRecord): DashboardUsageRecord {
  const totalTokens = Math.max(
    0,
    record.promptTokens + record.completionTokens + record.cachedTokens,
  );

  return {
    project_id: record.apiKeyId,
    model: record.model,
    provider: inferProviderId(record.model),
    units: totalTokens,
    amount: record.costUsd,
    input_tokens: record.promptTokens,
    output_tokens: record.completionTokens,
    total_tokens: totalTokens,
    created_at_ms: Date.parse(record.startedAt),
  };
}

function loadUsageRecords(
  usageRecordsApi: DashboardServiceDependencies['usageRecordsApi'],
) {
  return usageRecordsApi
    .listProviderUsageRecords({ page: 1, pageSize: 20 })
    .then((result) => result.items.map(mapUsageRecord))
    .catch(() => []);
}

function resolveAnalyticsQuery(
  query: DashboardAnalyticsQuery = {},
  referenceDate: Date = REFERENCE_DATE,
): ResolvedAnalyticsQuery {
  const granularity = query.granularity ?? 'day';
  const rangeMode = query.rangeMode ?? 'seven_days';

  if (rangeMode === 'month') {
    const selectedMonthKey = query.monthKey ?? formatMonthKey(referenceDate);
    const { year, monthIndex } = parseMonthKey(selectedMonthKey);
    const start = createUtcDate(year, monthIndex, 1);
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const bucketCount = granularity === 'day' ? lastDay : lastDay * 24;

    return {
      granularity,
      rangeMode,
      selectedMonthKey,
      bucketCount,
      bucketDates: buildDateRange(start, bucketCount, granularity),
    };
  }

  if (rangeMode === 'custom') {
    const fallbackEnd = startOfUtcDay(referenceDate);
    const fallbackStart = addDays(fallbackEnd, -17);
    const rawStart = parseCustomDate(query.customStart, fallbackStart);
    const rawEnd = parseCustomDate(query.customEnd, fallbackEnd);
    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;
    const bucketCount =
      granularity === 'day'
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1)
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)) + 24);

    return {
      granularity,
      rangeMode,
      customRange: {
        start: formatDayKey(start),
        end: formatDayKey(end),
      },
      bucketCount,
      bucketDates: buildDateRange(start, bucketCount, granularity),
    };
  }

  const dayCount = 7;
  const bucketCount = granularity === 'day' ? dayCount : dayCount * 24;
  const start =
    granularity === 'day'
      ? addDays(startOfUtcDay(referenceDate), -(dayCount - 1))
      : addHours(startOfUtcHour(referenceDate), -(bucketCount - 1));

  return {
    granularity,
    rangeMode: 'seven_days',
    bucketCount,
    bucketDates: buildDateRange(start, bucketCount, granularity),
  };
}

function scoreTaskStatus(task: StudioWorkbenchTaskRecord) {
  switch (task.status) {
    case 'active':
      return 1;
    case 'paused':
      return 0.65;
    case 'failed':
      return 0.2;
    default:
      return 0.5;
  }
}

function scoreChannelStatus(channel: StudioWorkbenchChannelRecord) {
  if (channel.status === 'connected' && channel.enabled) {
    return 1;
  }
  if (channel.status === 'disconnected') {
    return 0.45;
  }
  return 0.15;
}

function calculateResourceEfficiency(instances: StudioInstanceRecord[]) {
  const onlineInstances = instances.filter((instance) => instance.status === 'online');
  if (onlineInstances.length === 0) {
    return 45;
  }

  const averagePressure =
    onlineInstances.reduce((total, instance) => {
      return total + (instance.cpu + instance.memory) / 2;
    }, 0) / onlineInstances.length;

  return clampScore(100 - averagePressure);
}

function calculateAmount(tokens: number, rate: number) {
  return roundCurrency(tokens * rate);
}

function distributeTotal(total: number, weights: number[]) {
  const values: number[] = [];
  let allocated = 0;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      values.push(total - allocated);
      return;
    }

    const value = Math.round((total * weight) / weightTotal);
    values.push(value);
    allocated += value;
  });

  return values;
}

function calculateEstimatedRuns(
  tasks: StudioWorkbenchTaskRecord[],
  activeInstanceCount: number,
  bucketCount: number,
) {
  const taskRuns = tasks.reduce((total, task) => {
    if (task.status === 'active') {
      return total + (task.actionType === 'skill' ? 12 : 8);
    }
    if (task.status === 'paused') {
      return total + 3;
    }
    return total + 1;
  }, 0);

  return Math.max(1, taskRuns + activeInstanceCount * 6 + Math.round(bucketCount / 12));
}

function calculateDeltaPercentage(usageTrend: DashboardTokenTrendPoint[]) {
  return calculateValueDeltaPercentage(usageTrend.map((point) => point.totalTokens));
}

function calculateValueDeltaPercentage(values: number[]) {
  const windowSize = Math.max(1, Math.floor(values.length / 3));
  const firstWindow = values.slice(0, windowSize).reduce((total, value) => total + value, 0);
  const lastWindow = values.slice(-windowSize).reduce((total, value) => total + value, 0);

  if (firstWindow <= 0) {
    return 0;
  }

  return roundPercentage(((lastWindow - firstWindow) / firstWindow) * 100);
}

function toProviderName(modelName: string) {
  if (modelName.toLowerCase().includes('gpt')) {
    return 'OpenAI';
  }
  if (modelName.toLowerCase().includes('claude')) {
    return 'Anthropic';
  }
  if (modelName.toLowerCase().includes('gemini')) {
    return 'Google';
  }
  if (modelName.toLowerCase().includes('qwen')) {
    return 'Alibaba Cloud';
  }
  if (modelName.toLowerCase().includes('deepseek')) {
    return 'DeepSeek';
  }

  return 'Model Provider';
}

function calculateInstanceBaseWeight(summary: DashboardInstanceSummary, agents: Agent[]) {
  const { instance } = summary;
  const statusMultiplier =
    instance.status === 'online'
      ? 1
      : instance.status === 'starting'
        ? 0.72
        : instance.status === 'error'
          ? 0.42
          : 0.24;
  const pressureScore = (instance.cpu + instance.memory) / 2;

  return Math.max(
    1,
    (
      45 +
      summary.readinessScore * 2.2 +
      summary.activeTaskCount * 12 +
      summary.failedTaskCount * 4 +
      summary.connectedChannelCount * 7 +
      summary.installedSkillCount * 5 +
      agents.length * 1.4 +
      pressureScore * 0.65
    ) * statusMultiplier,
  );
}

export function calculateWorkspaceHealthScore({
  instances,
  tasks,
  channels,
}: WorkspaceHealthScoreInput) {
  const instanceAvailabilityScore =
    instances.length === 0
      ? 0
      : (instances.filter((instance) => instance.status === 'online').length / instances.length) *
        100;
  const automationReliabilityScore =
    tasks.length === 0
      ? 80
      : (tasks.reduce((total, task) => total + scoreTaskStatus(task), 0) / tasks.length) * 100;
  const channelReadinessScore =
    channels.length === 0
      ? 55
      : (channels.reduce((total, channel) => total + scoreChannelStatus(channel), 0) /
          channels.length) *
        100;
  const resourceEfficiencyScore = calculateResourceEfficiency(instances);

  return clampScore(
    instanceAvailabilityScore * 0.4 +
      automationReliabilityScore * 0.25 +
      channelReadinessScore * 0.2 +
      resourceEfficiencyScore * 0.15,
  );
}

export function calculateCapabilityCoverageScore({
  instances,
  tasks,
  channels,
  agents,
  installedSkills,
}: CapabilityCoverageScoreInput) {
  const skillBreadthScore = Math.min(100, installedSkills.length * 18);
  const agentBreadthScore = Math.min(100, agents.length * 22);
  const channelDeliveryScore =
    channels.length === 0
      ? 40
      : (channels.filter((channel) => channel.status === 'connected' && channel.enabled).length /
          channels.length) *
        100;
  const automationActivationScore =
    tasks.length === 0
      ? 50
      : (tasks.filter((task) => task.status === 'active').length / tasks.length) * 100;
  const instanceCoverageScore =
    instances.length === 0
      ? 0
      : Math.min(100, (installedSkills.length / Math.max(instances.length, 1)) * 30);

  return clampScore(
    skillBreadthScore * 0.3 +
      agentBreadthScore * 0.25 +
      channelDeliveryScore * 0.2 +
      automationActivationScore * 0.15 +
      instanceCoverageScore * 0.1,
  );
}

function calculateInstanceReadinessScore(
  instance: StudioInstanceRecord,
  tasks: StudioWorkbenchTaskRecord[],
  channels: StudioWorkbenchChannelRecord[],
  installedSkills: Skill[],
) {
  const statusBaseline =
    instance.status === 'online'
      ? 86
      : instance.status === 'starting'
        ? 72
        : instance.status === 'error'
          ? 28
          : 18;
  const resourcePenalty = ((instance.cpu + instance.memory) / 2) * 0.32;
  const stabilityBonus = instance.status === 'online' && instance.uptime !== '-' ? 8 : 0;
  const automationBonus = Math.min(8, tasks.filter((task) => task.status === 'active').length * 2);
  const deliveryBonus = Math.min(
    6,
    channels.filter((channel) => channel.status === 'connected' && channel.enabled).length * 2,
  );
  const skillBonus = Math.min(10, installedSkills.length * 3);

  return clampScore(
    statusBaseline - resourcePenalty + stabilityBonus + automationBonus + deliveryBonus + skillBonus,
  );
}

function deriveAgentFocusAreas(agent: Agent, installedSkills: Skill[]) {
  const description = `${agent.name} ${agent.description} ${agent.systemPrompt}`.toLowerCase();
  const skillCategories = [...new Set(installedSkills.map((skill) => skill.category))];
  const focusAreas = new Set<string>();

  if (description.includes('code') || description.includes('software')) {
    focusAreas.add('Code');
    focusAreas.add('Architecture');
  }
  if (description.includes('data') || description.includes('analysis')) {
    focusAreas.add('Analytics');
  }
  if (description.includes('operat') || description.includes('workflow')) {
    focusAreas.add('Automation');
    focusAreas.add('Reliability');
  }
  if (description.includes('creative') || description.includes('content')) {
    focusAreas.add('Content');
  }

  skillCategories.slice(0, 2).forEach((category) => focusAreas.add(category));

  if (focusAreas.size === 0) {
    focusAreas.add('Generalist');
  }

  return [...focusAreas].slice(0, 4);
}

function buildAgentSummary(
  agent: Agent,
  tasks: StudioWorkbenchTaskRecord[],
  channels: StudioWorkbenchChannelRecord[],
  installedSkills: Skill[],
): DashboardAgentSummary {
  const focusAreas = deriveAgentFocusAreas(agent, installedSkills);
  const automationFit = clampScore(
    tasks.filter((task) => task.actionType === 'skill' && task.status === 'active').length * 20 +
      focusAreas.length * 12,
  );
  const coverageScore = clampScore(
    automationFit * 0.45 +
      Math.min(100, installedSkills.length * 15) * 0.35 +
      Math.min(100, channels.filter((channel) => channel.enabled).length * 25) * 0.2,
  );

  return {
    agent,
    focusAreas,
    coverageScore,
    automationFit,
  };
}

function buildModelBreakdown(
  records: DashboardUsageRecord[],
  totalTokens: number,
): DashboardTokenModelBreakdown[] {
  const modelSummary = new Map<
    string,
    {
      id: string;
      modelName: string;
      requestCount: number;
      tokens: number;
      actualAmount: number;
    }
  >();

  records.forEach((record) => {
    const key = record.model || 'unknown-model';
    const current = modelSummary.get(key) ?? {
      id: key,
      modelName: key,
      requestCount: 0,
      tokens: 0,
      actualAmount: 0,
    };

    current.requestCount += 1;
    current.tokens += getUsageRecordTotalTokens(record);
    current.actualAmount += getUsageRecordAmount(record);

    modelSummary.set(key, current);
  });

  return [...modelSummary.values()]
    .map((row) => ({
      id: row.id,
      modelName: row.modelName,
      requestCount: row.requestCount,
      tokens: row.tokens,
      actualAmount: roundCurrency(row.actualAmount),
      standardAmount: roundCurrency(row.actualAmount),
      share: calculateTokenShare(row.tokens, totalTokens),
    }))
    .sort((left, right) => {
      if (right.tokens !== left.tokens) {
        return right.tokens - left.tokens;
      }

      return right.requestCount - left.requestCount;
    });
}

function buildTokenAnalytics({
  analyticsQuery,
  usageRecords,
}: TokenAnalyticsInput): DashboardTokenAnalytics {
  const filteredUsageRecords = filterUsageRecordsForAnalytics(usageRecords, analyticsQuery);
  const bucketSummaries = new Map<
    string,
    {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      actualAmount: number;
    }
  >();

  filteredUsageRecords.forEach((record) => {
    const bucketKey = getBucketKeyFromTimestamp(
      record.created_at_ms,
      analyticsQuery.granularity,
    );
    const current = bucketSummaries.get(bucketKey) ?? {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      actualAmount: 0,
    };

    current.totalTokens += getUsageRecordTotalTokens(record);
    current.inputTokens += getUsageRecordInputTokens(record);
    current.outputTokens += getUsageRecordOutputTokens(record);
    current.actualAmount += getUsageRecordAmount(record);

    bucketSummaries.set(bucketKey, current);
  });

  const usageTrend = analyticsQuery.bucketDates.map((bucketDate) => {
    const bucketKey =
      analyticsQuery.granularity === 'day'
        ? formatDayKey(bucketDate)
        : formatHourKey(bucketDate);
    const summary = bucketSummaries.get(bucketKey);

    return {
      label: getBucketLabel(bucketDate, analyticsQuery.granularity),
      bucketKey,
      totalTokens: summary?.totalTokens ?? 0,
      inputTokens: summary?.inputTokens ?? 0,
      outputTokens: summary?.outputTokens ?? 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      actualAmount: roundCurrency(summary?.actualAmount ?? 0),
      standardAmount: roundCurrency(summary?.actualAmount ?? 0),
    } satisfies DashboardTokenTrendPoint;
  });

  const totals = summarizeUsageRecords(filteredUsageRecords);
  const totalTokens = totals.totalTokens;
  const inputTokens = totals.inputTokens;
  const outputTokens = totals.outputTokens;
  const actualAmount = roundCurrency(totals.amount);
  const standardAmount = roundCurrency(totals.amount);
  const projectedFactor =
    analyticsQuery.rangeMode === 'month'
      ? 1
      : analyticsQuery.granularity === 'day'
        ? 30 / Math.max(analyticsQuery.bucketCount, 1)
        : (30 * 24) / Math.max(analyticsQuery.bucketCount, 1);
  const peakPoint = usageTrend.reduce((currentPeak, point) => {
    return point.totalTokens > currentPeak.totalTokens ? point : currentPeak;
  }, usageTrend[0] ?? {
    label: '--',
    bucketKey: '',
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    actualAmount: 0,
    standardAmount: 0,
  });
  const modelBreakdown = buildModelBreakdown(filteredUsageRecords, totalTokens);
  const totalRequestCount = filteredUsageRecords.length;

  return {
    granularity: analyticsQuery.granularity,
    rangeMode: analyticsQuery.rangeMode,
    selectedMonthKey: analyticsQuery.selectedMonthKey,
    customRange: analyticsQuery.customRange,
    totalTokens,
    inputTokens,
    outputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    inputShare: calculateTokenShare(inputTokens, totalTokens),
    outputShare: calculateTokenShare(outputTokens, totalTokens),
    cacheCreationShare: 0,
    cacheReadShare: 0,
    actualAmount,
    standardAmount,
    projectedMonthlyActualAmount: roundCurrency(actualAmount * projectedFactor),
    projectedMonthlyStandardAmount: roundCurrency(standardAmount * projectedFactor),
    averageTokensPerRun:
      totalRequestCount === 0 ? 0 : Math.round(totalTokens / totalRequestCount),
    projectedMonthlyTokens: Math.round(totalTokens * projectedFactor),
    estimatedRunCount: totalRequestCount,
    totalRequestCount,
    peakUsageLabel: peakPoint.label,
    peakUsageValue: peakPoint.totalTokens,
    deltaPercentage: calculateDeltaPercentage(usageTrend),
    usageTrend,
    modelBreakdown,
    instanceBreakdown: [],
  };
}

function buildTokenSummary(
  tokenAnalytics: DashboardTokenAnalytics,
  usageRecords: DashboardUsageRecord[],
  referenceDate: Date,
): DashboardTokenSummary {
  const dayStart = startOfUtcDay(referenceDate);
  const dailySummary = summarizeUsageRecords(
    filterUsageRecordsByTimeRange(
      usageRecords,
      dayStart.getTime(),
      addDays(dayStart, 1).getTime(),
    ),
  );
  const weeklySummary = summarizeUsageRecords(
    filterUsageRecordsByTimeRange(
      usageRecords,
      addDays(dayStart, -6).getTime(),
      addDays(dayStart, 1).getTime(),
    ),
  );
  const monthStart = startOfUtcMonth(referenceDate);
  const monthlySummary = summarizeUsageRecords(
    filterUsageRecordsByTimeRange(
      usageRecords,
      monthStart.getTime(),
      createUtcDate(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1).getTime(),
    ),
  );
  const yearStart = startOfUtcYear(referenceDate);
  const yearlySummary = summarizeUsageRecords(
    filterUsageRecordsByTimeRange(
      usageRecords,
      yearStart.getTime(),
      createUtcDate(referenceDate.getUTCFullYear() + 1, 0, 1).getTime(),
    ),
  );

  return {
    dailyRequestCount: dailySummary.requestCount,
    dailyTokenCount: dailySummary.totalTokens,
    dailySpend: roundCurrency(dailySummary.amount),
    weeklyRequestCount: weeklySummary.requestCount,
    weeklyTokenCount: weeklySummary.totalTokens,
    weeklySpend: roundCurrency(weeklySummary.amount),
    monthlyRequestCount: monthlySummary.requestCount,
    monthlyTokenCount: monthlySummary.totalTokens,
    monthlySpend: roundCurrency(monthlySummary.amount),
    yearlyRequestCount: yearlySummary.requestCount,
    yearlyTokenCount: yearlySummary.totalTokens,
    yearlySpend: roundCurrency(yearlySummary.amount),
    usageDelta: tokenAnalytics.deltaPercentage,
  };
}

function buildRecentApiCalls(
  usageRecords: DashboardUsageRecord[],
): DashboardApiCallRecord[] {
  return [...usageRecords]
    .sort((left, right) => right.created_at_ms - left.created_at_ms)
    .map((record, index) => ({
      id: `${record.project_id}-${record.model}-${record.created_at_ms}-${index}`,
      timestamp: new Date(record.created_at_ms).toISOString(),
      modelName: record.model,
      providerName: record.provider || toProviderName(record.model),
      endpoint: 'not-tracked',
      requestCount: 1,
      tokenCount: getUsageRecordTotalTokens(record),
      costAmount: roundCurrency(getUsageRecordAmount(record)),
      latencyMs: 0,
      status: 'success',
    }));
}

function buildAlerts(
  tokenSummary: DashboardTokenSummary,
  businessSummary: DashboardBusinessSummary,
  tokenAnalytics: DashboardTokenAnalytics,
  revenueAnalytics: DashboardRevenueAnalytics,
): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = [];
  const topModel = tokenAnalytics.modelBreakdown[0];
  const topProduct = revenueAnalytics.productBreakdown[0];

  if (topModel) {
    alerts.push({
      id: 'model-cost-spike',
      severity: tokenSummary.usageDelta > 12 ? 'warning' : 'info',
      title: `${topModel.modelName} cost share is leading`,
      description: `${topModel.modelName} carries the largest current model cost share. Watch the mix before spend concentration grows.`,
      value: `${topModel.share}%`,
    });
  }

  if (topProduct) {
    const topProductName = topProduct.productName || topProduct.id;
    alerts.push({
      id: 'revenue-concentration',
      severity: topProduct.share >= 36 ? 'warning' : 'info',
      title: `${topProductName} drives the largest revenue share`,
      description: `Revenue is currently concentrated in ${topProductName}. Keep diversification visible as volume scales.`,
      value: `${topProduct.share}%`,
    });
  }

  alerts.push({
    id: 'daily-spend',
    severity: tokenSummary.dailySpend >= 180 ? 'critical' : 'warning',
    title: 'Daily spend is elevated',
    description: 'Daily model spend is climbing with request volume. Keep an eye on high-cost model routing during peak windows.',
    value: `$${tokenSummary.dailySpend.toFixed(2)}`,
  });

  alerts.push({
    id: 'conversion',
    severity: businessSummary.conversionRate >= 12 ? 'info' : 'warning',
    title: 'Conversion efficiency is the next lever',
    description: 'Revenue is healthy, but call-to-order conversion is still the clearest path to higher business yield.',
    value: `${businessSummary.conversionRate}%`,
  });

  return alerts;
}

function buildActivityFeed(
  recentApiCalls: DashboardApiCallRecord[],
  tokenAnalytics: DashboardTokenAnalytics,
  revenueAnalytics: DashboardRevenueAnalytics,
  tokenSummary: DashboardTokenSummary,
  businessSummary: DashboardBusinessSummary,
  recentRevenueRecords: DashboardRevenueRecord[],
  productPerformance: DashboardProductPerformanceRow[],
): DashboardActivityFeed {
  return {
    recentApiCalls: recentApiCalls.slice(0, 10),
    recentRevenueRecords: recentRevenueRecords.slice(0, 10),
    productPerformance,
    alerts: buildAlerts(tokenSummary, businessSummary, tokenAnalytics, revenueAnalytics),
  };
}

function buildRecommendations({
  instances,
  tasks,
  channels,
  installedSkills,
  healthScore,
  capabilityCoverageScore,
}: CapabilityCoverageScoreInput & { healthScore: number; capabilityCoverageScore: number }) {
  const recommendations: DashboardRecommendation[] = [];

  if (instances.some((instance) => instance.status !== 'online')) {
    recommendations.push({
      id: 'stabilize-instances',
      severity: 'critical',
      titleKey: 'dashboard.recommendations.items.stabilizeInstances.title',
      descriptionKey: 'dashboard.recommendations.items.stabilizeInstances.description',
      actionLabelKey: 'dashboard.recommendations.items.stabilizeInstances.action',
      actionPath: '/instances',
    });
  }

  if (channels.filter((channel) => channel.status === 'connected' && channel.enabled).length === 0) {
    recommendations.push({
      id: 'connect-delivery',
      severity: 'warning',
      titleKey: 'dashboard.recommendations.items.connectDelivery.title',
      descriptionKey: 'dashboard.recommendations.items.connectDelivery.description',
      actionLabelKey: 'dashboard.recommendations.items.connectDelivery.action',
      actionPath: '/channels',
    });
  }

  if (installedSkills.length < 3) {
    recommendations.push({
      id: 'expand-capabilities',
      severity: 'info',
      titleKey: 'dashboard.recommendations.items.expandCapabilities.title',
      descriptionKey: 'dashboard.recommendations.items.expandCapabilities.description',
      actionLabelKey: 'dashboard.recommendations.items.expandCapabilities.action',
      actionPath: '/agents',
    });
  }

  if (tasks.some((task) => task.status === 'failed')) {
    recommendations.push({
      id: 'repair-automations',
      severity: 'warning',
      titleKey: 'dashboard.recommendations.items.repairAutomations.title',
      descriptionKey: 'dashboard.recommendations.items.repairAutomations.description',
      actionLabelKey: 'dashboard.recommendations.items.repairAutomations.action',
      actionPath: '/tasks',
    });
  }

  if (healthScore >= 80 && capabilityCoverageScore >= 75) {
    recommendations.push({
      id: 'scale-operators',
      severity: 'info',
      titleKey: 'dashboard.recommendations.items.scaleOperators.title',
      descriptionKey: 'dashboard.recommendations.items.scaleOperators.description',
      actionLabelKey: 'dashboard.recommendations.items.scaleOperators.action',
      actionPath: '/chat',
    });
  }

  return recommendations.slice(0, 4);
}

interface DashboardInstanceCollections {
  instance: StudioInstanceRecord;
  tasks: StudioWorkbenchTaskRecord[];
  channels: StudioWorkbenchChannelRecord[];
  installedSkills: Skill[];
  agents: Agent[];
}

function collectInstanceWorkbench(
  instance: StudioInstanceRecord,
  detail: StudioInstanceDetailRecord | null,
): DashboardInstanceCollections {
  const workbench = detail?.workbench;

  return {
    instance: detail?.instance ?? instance,
    tasks: uniqueById((workbench?.cronTasks.tasks ?? []).map(cloneTask)),
    channels: uniqueById((workbench?.channels ?? []).map(cloneChannel)),
    installedSkills: uniqueById((workbench?.skills ?? []).map(cloneSkill)),
    agents: uniqueById((workbench?.agents ?? []).map((record) => cloneAgent(record.agent))),
  };
}

class DashboardService {
  private readonly dependencies: DashboardServiceDependencies;

  constructor(dependencies: DashboardServiceDependencies) {
    this.dependencies = dependencies;
  }

  async getSnapshot(analyticsQuery: DashboardAnalyticsQuery = {}): Promise<DashboardSnapshot> {
    const [usageRecords, instances, commerceSnapshot] = await Promise.all([
      loadUsageRecords(this.dependencies.usageRecordsApi),
      this.dependencies.studioApi.listInstances(),
      this.dependencies.dashboardCommerceApi
        .getCommerceSnapshot(analyticsQuery)
        .catch(() => createEmptyDashboardCommerceSnapshot(analyticsQuery)),
    ]);
    const referenceDate = getAnalyticsReferenceDate(usageRecords);
    const resolvedAnalyticsQuery = resolveAnalyticsQuery(analyticsQuery, referenceDate);

    const instanceWorkbenchCollections = await Promise.all(
      instances.map(async (instance) => {
        const detail = await this.dependencies.studioApi.getInstanceDetail(instance.id).catch(() => null);
        return collectInstanceWorkbench(instance, detail);
      }),
    );

    const agents = uniqueById(
      instanceWorkbenchCollections.flatMap((collections) => collections.agents),
    );

    const instanceSummaries = instanceWorkbenchCollections.map(
      ({ instance, tasks: instanceTasks, channels: instanceChannels, installedSkills }) =>
        ({
          instance,
          readinessScore: calculateInstanceReadinessScore(
            instance,
            instanceTasks,
            instanceChannels,
            installedSkills,
          ),
          activeTaskCount: instanceTasks.filter((task) => task.status === 'active').length,
          failedTaskCount: instanceTasks.filter((task) => task.status === 'failed').length,
          connectedChannelCount: instanceChannels.filter(
            (channel) => channel.status === 'connected' && channel.enabled,
          ).length,
          installedSkillCount: installedSkills.length,
        }) satisfies DashboardInstanceSummary,
    );

    const tasks = uniqueById(
      instanceWorkbenchCollections.flatMap((collections) => collections.tasks),
    );
    const channels = uniqueById(
      instanceWorkbenchCollections.flatMap((collections) => collections.channels),
    );
    const installedSkills = uniqueById(
      instanceWorkbenchCollections.flatMap((collections) => collections.installedSkills),
    );

    const healthScore = calculateWorkspaceHealthScore({ instances, tasks, channels });
    const capabilityCoverageScore = calculateCapabilityCoverageScore({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
    });
    const tokenAnalytics = buildTokenAnalytics({
      analyticsQuery: resolvedAnalyticsQuery,
      usageRecords,
    });
    const revenueAnalytics: DashboardRevenueAnalytics = commerceSnapshot.revenueAnalytics;
    const recentApiCalls = buildRecentApiCalls(usageRecords);
    const tokenSummary = buildTokenSummary(tokenAnalytics, usageRecords, referenceDate);
    const businessSummary: DashboardBusinessSummary = commerceSnapshot.businessSummary;
    const activityFeed = buildActivityFeed(
      recentApiCalls,
      tokenAnalytics,
      revenueAnalytics,
      tokenSummary,
      businessSummary,
      commerceSnapshot.recentRevenueRecords,
      commerceSnapshot.productPerformance,
    );
    const recommendations = buildRecommendations({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
      healthScore,
      capabilityCoverageScore,
    });

    return {
      healthScore,
      capabilityCoverageScore,
      activeInstanceCount: instances.filter((instance) => instance.status === 'online').length,
      totalInstanceCount: instances.length,
      activeAutomationCount: tasks.filter((task) => task.status === 'active').length,
      pausedAutomationCount: tasks.filter((task) => task.status === 'paused').length,
      failedAutomationCount: tasks.filter((task) => task.status === 'failed').length,
      connectedChannelCount: channels.filter(
        (channel) => channel.status === 'connected' && channel.enabled,
      ).length,
      totalChannelCount: channels.length,
      installedSkillCount: installedSkills.length,
      businessSummary,
      tokenSummary,
      tokenAnalytics,
      revenueAnalytics,
      activityFeed,
      instances: instanceSummaries.sort((left, right) => right.readinessScore - left.readinessScore),
      agents: agents
        .map((agent) => buildAgentSummary(agent, tasks, channels, installedSkills))
        .sort((left, right) => right.coverageScore - left.coverageScore),
      tasks: tasks.sort((left, right) => left.name.localeCompare(right.name)),
      channels: channels.sort((left, right) => left.name.localeCompare(right.name)),
      installedSkills: installedSkills.sort((left, right) => left.name.localeCompare(right.name)),
      recommendations,
    };
  }
}

export function createDashboardService(
  overrides: DashboardServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new DashboardService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    usageRecordsApi: {
      ...defaults.usageRecordsApi,
      ...(overrides.usageRecordsApi || {}),
    },
    dashboardCommerceApi: {
      ...defaults.dashboardCommerceApi,
      ...(overrides.dashboardCommerceApi || {}),
    },
  });
}

export const dashboardService = createDashboardService();
