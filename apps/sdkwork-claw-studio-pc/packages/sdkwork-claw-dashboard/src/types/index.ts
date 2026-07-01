import type {
  Agent,
  Skill,
  StudioInstanceRecord,
  StudioWorkbenchChannelRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';

export type DashboardAnalyticsGranularity = 'day' | 'hour';
export type DashboardAnalyticsRangeMode = 'seven_days' | 'month' | 'custom';

export interface DashboardAnalyticsQuery {
  granularity?: DashboardAnalyticsGranularity;
  rangeMode?: DashboardAnalyticsRangeMode;
  monthKey?: string;
  customStart?: string;
  customEnd?: string;
}

export interface DashboardInstanceSummary {
  instance: StudioInstanceRecord;
  readinessScore: number;
  activeTaskCount: number;
  failedTaskCount: number;
  connectedChannelCount: number;
  installedSkillCount: number;
}

export interface DashboardAgentSummary {
  agent: Agent;
  focusAreas: string[];
  coverageScore: number;
  automationFit: number;
}

export interface DashboardRecommendation {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  titleKey: string;
  descriptionKey: string;
  actionLabelKey: string;
  actionPath: string;
}

export interface DashboardTokenTrendPoint {
  label: string;
  bucketKey: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  actualAmount: number;
  standardAmount: number;
}

export interface DashboardTokenInstanceBreakdown {
  instanceId: string;
  name: string;
  status: StudioInstanceRecord['status'];
  tokens: number;
  estimatedSpend: number;
  share: number;
  readinessScore: number;
}

export interface DashboardTokenModelBreakdown {
  id: string;
  modelName: string;
  requestCount: number;
  tokens: number;
  actualAmount: number;
  standardAmount: number;
  share: number;
}

export interface DashboardTokenAnalytics {
  granularity: DashboardAnalyticsGranularity;
  rangeMode: DashboardAnalyticsRangeMode;
  selectedMonthKey?: string;
  customRange?: {
    start: string;
    end: string;
  };
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  inputShare: number;
  outputShare: number;
  cacheCreationShare: number;
  cacheReadShare: number;
  actualAmount: number;
  standardAmount: number;
  projectedMonthlyActualAmount: number;
  projectedMonthlyStandardAmount: number;
  averageTokensPerRun: number;
  projectedMonthlyTokens: number;
  estimatedRunCount: number;
  totalRequestCount: number;
  peakUsageLabel: string;
  peakUsageValue: number;
  deltaPercentage: number;
  usageTrend: DashboardTokenTrendPoint[];
  modelBreakdown: DashboardTokenModelBreakdown[];
  instanceBreakdown: DashboardTokenInstanceBreakdown[];
}

export interface DashboardRevenueTrendPoint {
  label: string;
  bucketKey: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface DashboardRevenueProductBreakdown {
  id: string;
  productName: string;
  orders: number;
  revenue: number;
  share: number;
  dailyRevenue: number;
}

export interface DashboardRevenueAnalytics {
  granularity: DashboardAnalyticsGranularity;
  rangeMode: DashboardAnalyticsRangeMode;
  selectedMonthKey?: string;
  customRange?: {
    start: string;
    end: string;
  };
  totalRevenue: number;
  dailyRevenue: number;
  projectedMonthlyRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  peakRevenueLabel: string;
  peakRevenueValue: number;
  deltaPercentage: number;
  revenueTrend: DashboardRevenueTrendPoint[];
  productBreakdown: DashboardRevenueProductBreakdown[];
}

export interface DashboardBusinessSummary {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  yearOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  revenueDelta: number;
}

export interface DashboardTokenSummary {
  dailyRequestCount: number;
  dailyTokenCount: number;
  dailySpend: number;
  weeklyRequestCount: number;
  weeklyTokenCount: number;
  weeklySpend: number;
  monthlyRequestCount: number;
  monthlyTokenCount: number;
  monthlySpend: number;
  yearlyRequestCount: number;
  yearlyTokenCount: number;
  yearlySpend: number;
  usageDelta: number;
}

export interface DashboardApiCallRecord {
  id: string;
  timestamp: string;
  modelName: string;
  providerName: string;
  endpoint: string;
  requestCount: number;
  tokenCount: number;
  costAmount: number;
  latencyMs: number;
  status: 'success' | 'failed';
}

export interface DashboardRevenueRecord {
  id: string;
  timestamp: string;
  productName: string;
  orderNo: string;
  revenueAmount: number;
  channel: string;
  status:
    | 'paid'
    | 'pending'
    | 'refunded'
    | 'completed'
    | 'delivered'
    | 'cancelled'
    | 'refunding';
}

export interface DashboardProductPerformanceRow {
  id: string;
  productName: string;
  revenue: number;
  orders: number;
  share: number;
  trendDelta: number;
}

export interface DashboardAlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  value: string;
}

export interface DashboardActivityFeed {
  recentApiCalls: DashboardApiCallRecord[];
  recentRevenueRecords: DashboardRevenueRecord[];
  productPerformance: DashboardProductPerformanceRow[];
  alerts: DashboardAlertItem[];
}

export interface DashboardSnapshot {
  healthScore: number;
  capabilityCoverageScore: number;
  activeInstanceCount: number;
  totalInstanceCount: number;
  activeAutomationCount: number;
  pausedAutomationCount: number;
  failedAutomationCount: number;
  connectedChannelCount: number;
  totalChannelCount: number;
  installedSkillCount: number;
  businessSummary: DashboardBusinessSummary;
  tokenSummary: DashboardTokenSummary;
  tokenAnalytics: DashboardTokenAnalytics;
  revenueAnalytics: DashboardRevenueAnalytics;
  activityFeed: DashboardActivityFeed;
  instances: DashboardInstanceSummary[];
  agents: DashboardAgentSummary[];
  tasks: StudioWorkbenchTaskRecord[];
  channels: StudioWorkbenchChannelRecord[];
  installedSkills: Skill[];
  recommendations: DashboardRecommendation[];
}

export * from './usage';
