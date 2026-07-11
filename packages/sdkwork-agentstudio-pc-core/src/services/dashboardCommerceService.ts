import type {
  OrderVO,
  PageOrderVO,
  PageProductVO,
  ProductVO,
} from '../sdk/appSdkPort.ts';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

export type DashboardCommerceGranularity = 'day' | 'hour';
export type DashboardCommerceRangeMode = 'seven_days' | 'month' | 'custom';
export type DashboardCommerceRecordStatus =
  | 'paid'
  | 'pending'
  | 'refunded'
  | 'completed'
  | 'delivered'
  | 'cancelled'
  | 'refunding';

export interface DashboardCommerceQuery {
  granularity?: DashboardCommerceGranularity;
  rangeMode?: DashboardCommerceRangeMode;
  monthKey?: string;
  customStart?: string;
  customEnd?: string;
}

export interface DashboardCommerceCustomRange {
  start: string;
  end: string;
}

export interface DashboardCommerceBusinessSummary {
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

export interface DashboardCommerceRevenueTrendPoint {
  label: string;
  bucketKey: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface DashboardCommerceProductBreakdown {
  id: string;
  productName: string;
  orders: number;
  revenue: number;
  share: number;
  dailyRevenue: number;
}

export interface DashboardCommerceRevenueAnalytics {
  granularity: DashboardCommerceGranularity;
  rangeMode: DashboardCommerceRangeMode;
  selectedMonthKey?: string;
  customRange?: DashboardCommerceCustomRange;
  totalRevenue: number;
  dailyRevenue: number;
  projectedMonthlyRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  peakRevenueLabel: string;
  peakRevenueValue: number;
  deltaPercentage: number;
  revenueTrend: DashboardCommerceRevenueTrendPoint[];
  productBreakdown: DashboardCommerceProductBreakdown[];
}

export interface DashboardCommerceRevenueRecord {
  id: string;
  timestamp: string;
  productName: string;
  orderNo: string;
  revenueAmount: number;
  channel: string;
  status: DashboardCommerceRecordStatus;
}

export interface DashboardCommerceProductPerformance {
  id: string;
  productName: string;
  revenue: number;
  orders: number;
  share: number;
  trendDelta: number;
}

export interface DashboardCommerceSnapshot {
  businessSummary: DashboardCommerceBusinessSummary;
  revenueAnalytics: DashboardCommerceRevenueAnalytics;
  recentRevenueRecords: DashboardCommerceRevenueRecord[];
  productPerformance: DashboardCommerceProductPerformance[];
}

type DashboardCommerceClient = {
  order: import('../sdk/appSdkPort.ts').agentstudioOrderClient;
  product: import('../sdk/appSdkPort.ts').agentstudioProductClient;
};
type DashboardCommerceSessionTokens = { authToken?: string | null };
type DashboardCommerceSdkRuntime = typeof import('../sdk/useAppSdkClient.ts');

export interface CreateDashboardCommerceServiceOptions {
  getClient?: () => DashboardCommerceClient | Promise<DashboardCommerceClient>;
  getSessionTokens?: () => DashboardCommerceSessionTokens | Promise<DashboardCommerceSessionTokens>;
  getNow?: () => Date;
}

export interface DashboardCommerceService {
  getCommerceSnapshot(query?: DashboardCommerceQuery): Promise<DashboardCommerceSnapshot>;
}

const ORDER_PAGE_SIZE = 100;
const PRODUCT_PAGE_SIZE = 50;
const MAX_PAGES = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
let dashboardCommerceSdkRuntimePromise: Promise<DashboardCommerceSdkRuntime> | null = null;

function loadDashboardCommerceSdkRuntime(): Promise<DashboardCommerceSdkRuntime> {
  if (!dashboardCommerceSdkRuntimePromise) {
    dashboardCommerceSdkRuntimePromise = import('../sdk/useAppSdkClient.ts');
  }

  return dashboardCommerceSdkRuntimePromise;
}

async function getDefaultClient(): Promise<DashboardCommerceClient> {
  const { getagentstudioAppClientWithSession } = await loadDashboardCommerceSdkRuntime();
  return getagentstudioAppClientWithSession() as DashboardCommerceClient;
}

async function getDefaultSessionTokens(): Promise<DashboardCommerceSessionTokens> {
  const { readAppSdkSessionTokens } = await loadDashboardCommerceSdkRuntime();
  return readAppSdkSessionTokens();
}

function toOptionalString(value: string | undefined | null) {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function toNumber(value: number | string | undefined | null, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function roundMetric(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function normalizeGranularity(value: string | undefined): DashboardCommerceGranularity {
  return value === 'hour' ? 'hour' : 'day';
}

function normalizeRangeMode(value: string | undefined): DashboardCommerceRangeMode {
  return value === 'month' || value === 'custom' ? value : 'seven_days';
}

function normalizeRecordStatus(value: string | undefined): DashboardCommerceRecordStatus {
  switch ((value || '').trim().toLowerCase()) {
    case 'paid':
      return 'paid';
    case 'completed':
      return 'completed';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'refunding':
      return 'refunding';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfUtcYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcHours(date: Date, hours: number) {
  const next = new Date(date.getTime());
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function formatDayKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function formatHourKey(date: Date) {
  return `${formatDayKey(date)}T${`${date.getUTCHours()}`.padStart(2, '0')}:00`;
}

function formatBucketLabel(date: Date, granularity: DashboardCommerceGranularity) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return granularity === 'day' ? `${month}-${day}` : `${month}-${day} ${`${date.getUTCHours()}`.padStart(2, '0')}:00`;
}

function parseDay(value: string | undefined) {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function resolveWindow(query: DashboardCommerceQuery, now: Date) {
  const granularity = normalizeGranularity(query.granularity);
  const rangeMode = normalizeRangeMode(query.rangeMode);

  if (rangeMode === 'month') {
    const monthKey = toOptionalString(query.monthKey) || `${now.getUTCFullYear()}-${`${now.getUTCMonth() + 1}`.padStart(2, '0')}`;
    const [yearText, monthText] = monthKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const start = new Date(Date.UTC(Number.isFinite(year) ? year : now.getUTCFullYear(), (Number.isFinite(month) ? month : now.getUTCMonth() + 1) - 1, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { granularity, rangeMode, start, end, selectedMonthKey: `${start.getUTCFullYear()}-${`${start.getUTCMonth() + 1}`.padStart(2, '0')}` };
  }

  if (rangeMode === 'custom') {
    const rawStart = parseDay(query.customStart) || addUtcDays(startOfUtcDay(now), -6);
    const rawEnd = parseDay(query.customEnd) || startOfUtcDay(now);
    const start = rawStart.getTime() <= rawEnd.getTime() ? rawStart : rawEnd;
    const endDay = rawStart.getTime() <= rawEnd.getTime() ? rawEnd : rawStart;
    return {
      granularity,
      rangeMode,
      start,
      end: endOfUtcDay(endDay),
      customRange: { start: formatDayKey(start), end: formatDayKey(endDay) },
    };
  }

  return {
    granularity,
    rangeMode: 'seven_days' as const,
    start: granularity === 'day' ? addUtcDays(startOfUtcDay(now), -6) : addUtcHours(endOfUtcDay(now), -(7 * 24) + 1),
    end: endOfUtcDay(now),
  };
}

function buildBuckets(start: Date, end: Date, granularity: DashboardCommerceGranularity) {
  const buckets: Date[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime() && buckets.length < 24 * 400) {
    buckets.push(new Date(cursor.getTime()));
    if (granularity === 'day') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
    } else {
      cursor.setUTCHours(cursor.getUTCHours() + 1, 0, 0, 0);
    }
  }
  return buckets;
}

function getOrderTimestamp(order: OrderVO) {
  return order.payTime || order.createdAt || order.updatedAt || new Date(0).toISOString();
}

function getOrderAmount(order: OrderVO) {
  return toNumber(order.paidAmount ?? order.totalAmount);
}

function filterOrders(orders: OrderVO[], start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return orders.filter((order) => {
    const timestamp = new Date(getOrderTimestamp(order)).getTime();
    return Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs;
  });
}

function summarizeOrders(orders: OrderVO[]) {
  const revenue = roundMetric(orders.reduce((sum, order) => sum + getOrderAmount(order), 0));
  const count = orders.length;
  const successCount = orders.filter((order) => {
    const status = normalizeRecordStatus(order.status || order.statusName);
    return status === 'paid' || status === 'completed' || status === 'delivered';
  }).length;
  return {
    revenue,
    count,
    averageOrderValue: count > 0 ? roundMetric(revenue / count) : 0,
    conversionRate: count > 0 ? roundMetric((successCount / count) * 100, 1) : 0,
  };
}

function calculateDelta(currentValue: number, previousValue: number) {
  if (previousValue <= 0) {
    return 0;
  }
  return roundMetric(((currentValue - previousValue) / previousValue) * 100, 1);
}

function buildRecentRevenueRecords(orders: OrderVO[]): DashboardCommerceRevenueRecord[] {
  return [...orders]
    .sort((left, right) => getOrderTimestamp(right).localeCompare(getOrderTimestamp(left)))
    .slice(0, 10)
    .map((order, index) => ({
      id: order.orderId || order.orderSn || `order-${index}`,
      timestamp: getOrderTimestamp(order),
      productName: order.subject || order.orderSn || `Order ${index + 1}`,
      orderNo: order.orderSn || order.orderId || '',
      revenueAmount: getOrderAmount(order),
      channel: (order.paymentProvider || order.paymentMethod || 'app').trim().toLowerCase(),
      status: normalizeRecordStatus(order.status || order.statusName),
    }));
}

function normalizeLookupKey(value: string | undefined) {
  return (value || '').trim().toLowerCase();
}

function buildProductMetrics(orders: OrderVO[], previousOrders: OrderVO[], products: ProductVO[], bucketCount: number) {
  const productIds = new Map(
    products
      .map((product) => {
        const title = toOptionalString(product.title);
        return title ? ([normalizeLookupKey(title), product.id || title] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
  const collect = (source: OrderVO[]) => {
    const rows = new Map<string, { id: string; productName: string; orders: number; revenue: number }>();
    source.forEach((order, index) => {
      const productName = toOptionalString(order.subject) || toOptionalString(order.orderSn) || `Product ${index + 1}`;
      const key = normalizeLookupKey(productName) || `product-${index}`;
      const row = rows.get(key) || { id: productIds.get(key) || key, productName, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += getOrderAmount(order);
      rows.set(key, row);
    });
    return rows;
  };

  const currentRows = collect(orders);
  const previousRows = collect(previousOrders);
  const totalRevenue = [...currentRows.values()].reduce((sum, row) => sum + row.revenue, 0);
  const breakdown = [...currentRows.values()]
    .sort((left, right) => right.revenue - left.revenue || right.orders - left.orders)
    .map((row) => ({
      id: row.id,
      productName: row.productName,
      orders: row.orders,
      revenue: roundMetric(row.revenue),
      share: totalRevenue > 0 ? roundMetric((row.revenue / totalRevenue) * 100, 1) : 0,
      dailyRevenue: bucketCount > 0 ? roundMetric(row.revenue / bucketCount) : roundMetric(row.revenue),
    }));
  const fallback = breakdown.map((row) => ({
    id: row.id,
    productName: row.productName,
    revenue: row.revenue,
    orders: row.orders,
    share: row.share,
    trendDelta: calculateDelta(row.revenue, previousRows.get(normalizeLookupKey(row.productName))?.revenue || 0),
  }));

  const fallbackById = new Map(fallback.map((row) => [row.id, row] as const));
  const fallbackByName = new Map(fallback.map((row) => [normalizeLookupKey(row.productName), row] as const));
  const merged = products.map((product, index) => {
    const id = product.id || product.title || `product-${index}`;
    const productName = product.title || id;
    return fallbackById.get(id) || fallbackByName.get(normalizeLookupKey(productName)) || {
      id,
      productName,
      revenue: 0,
      orders: 0,
      share: 0,
      trendDelta: 0,
    };
  });
  const mergedIds = new Set(merged.map((row) => row.id));
  const combined = [...merged, ...fallback.filter((row) => !mergedIds.has(row.id))]
    .sort((left, right) => right.revenue - left.revenue || right.orders - left.orders);
  const combinedRevenue = combined.reduce((sum, row) => sum + row.revenue, 0);

  return {
    breakdown,
    performance: combined.map((row) => ({
      ...row,
      share: combinedRevenue > 0 ? roundMetric((row.revenue / combinedRevenue) * 100, 1) : row.share,
    })),
  };
}

async function loadAllOrders(client: DashboardCommerceClient, start: Date, end: Date) {
  const collected: OrderVO[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = unwrapAppSdkResponse<PageOrderVO>(
      await client.order.listOrders({
        page: String(page),
        size: String(ORDER_PAGE_SIZE),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }),
      'Failed to load order list.',
    );
    const content = payload.content || [];
    collected.push(...content);
    if (payload.last === true || content.length === 0 || (toNumber(payload.totalPages) > 0 && page >= toNumber(payload.totalPages)) || content.length < ORDER_PAGE_SIZE) {
      break;
    }
  }
  return [...new Map(collected.map((order, index) => [order.orderId || order.orderSn || `${getOrderTimestamp(order)}-${index}`, order] as const)).values()];
}

async function loadAllProducts(client: DashboardCommerceClient) {
  const collected: ProductVO[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = unwrapAppSdkResponse<PageProductVO>(
      await client.product.getProducts({
        page: String(page),
        size: String(PRODUCT_PAGE_SIZE),
      }),
      'Failed to load product list.',
    );
    const content = payload.content || [];
    collected.push(...content);
    if (payload.last === true || content.length === 0 || (toNumber(payload.totalPages) > 0 && page >= toNumber(payload.totalPages)) || content.length < PRODUCT_PAGE_SIZE) {
      break;
    }
  }
  return [...new Map(collected.map((product, index) => [product.id || product.title || `product-${index}`, product] as const)).values()];
}

export function createEmptyDashboardCommerceSnapshot(query: DashboardCommerceQuery = {}): DashboardCommerceSnapshot {
  const rangeMode = normalizeRangeMode(query.rangeMode);
  return {
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
      granularity: normalizeGranularity(query.granularity),
      rangeMode,
      selectedMonthKey: rangeMode === 'month' ? toOptionalString(query.monthKey) : undefined,
      customRange: rangeMode === 'custom' ? { start: query.customStart || '', end: query.customEnd || '' } : undefined,
      totalRevenue: 0,
      dailyRevenue: 0,
      projectedMonthlyRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      peakRevenueLabel: '',
      peakRevenueValue: 0,
      deltaPercentage: 0,
      revenueTrend: [],
      productBreakdown: [],
    },
    recentRevenueRecords: [],
    productPerformance: [],
  };
}

export function createDashboardCommerceService(options: CreateDashboardCommerceServiceOptions = {}): DashboardCommerceService {
  const getClient = options.getClient;
  const getSessionTokens = options.getSessionTokens;
  const getNow = options.getNow;

  return {
    async getCommerceSnapshot(query: DashboardCommerceQuery = {}) {
      const sessionTokens = await Promise.resolve(
        getSessionTokens ? getSessionTokens() : getDefaultSessionTokens(),
      );
      if (!toOptionalString(sessionTokens.authToken)) {
        return createEmptyDashboardCommerceSnapshot(query);
      }

      const now = getNow ? getNow() : new Date();
      const window = resolveWindow(query, now);
      const previousStart = new Date(window.start.getTime() - (window.end.getTime() - window.start.getTime() + 1));
      const collectionStart = previousStart.getTime() < startOfUtcYear(now).getTime() ? previousStart : startOfUtcYear(now);
      const collectionEnd = endOfUtcDay(now).getTime() > window.end.getTime() ? endOfUtcDay(now) : window.end;
      const buckets = buildBuckets(window.start, window.end, window.granularity);
      const daySpan = window.granularity === 'hour' ? Math.max(1, Math.ceil(buckets.length / 24)) : Math.max(1, buckets.length);
      const targetMonthDate = window.selectedMonthKey ? new Date(`${window.selectedMonthKey}-01T00:00:00.000Z`) : now;
      const projectedDays = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0)).getUTCDate();

      const client = await Promise.resolve(getClient ? getClient() : getDefaultClient());
      const [orders, products] = await Promise.all([
        loadAllOrders(client, collectionStart, collectionEnd),
        loadAllProducts(client),
      ]);

      const analyticsOrders = filterOrders(orders, window.start, window.end);
      const previousOrders = filterOrders(orders, previousStart, new Date(window.start.getTime() - 1));
      const todayOrders = filterOrders(orders, startOfUtcDay(now), endOfUtcDay(now));
      const weekOrders = filterOrders(orders, addUtcDays(startOfUtcDay(now), -6), endOfUtcDay(now));
      const monthOrders = filterOrders(orders, startOfUtcMonth(now), endOfUtcDay(now));
      const yearOrders = filterOrders(orders, startOfUtcYear(now), endOfUtcDay(now));

      const analyticsSummary = summarizeOrders(analyticsOrders);
      const previousSummary = summarizeOrders(previousOrders);
      const peakMap = new Map<string, { revenue: number; orders: number }>();
      analyticsOrders.forEach((order) => {
        const timestamp = new Date(getOrderTimestamp(order));
        const key = window.granularity === 'day' ? formatDayKey(timestamp) : formatHourKey(timestamp);
        const row = peakMap.get(key) || { revenue: 0, orders: 0 };
        row.revenue += getOrderAmount(order);
        row.orders += 1;
        peakMap.set(key, row);
      });
      const revenueTrend = buckets.map((date) => {
        const key = window.granularity === 'day' ? formatDayKey(date) : formatHourKey(date);
        const row = peakMap.get(key);
        const revenue = roundMetric(row?.revenue || 0);
        const orderCount = row?.orders || 0;
        return {
          label: formatBucketLabel(date, window.granularity),
          bucketKey: key,
          revenue,
          orders: orderCount,
          averageOrderValue: orderCount > 0 ? roundMetric(revenue / orderCount) : 0,
        };
      });
      const peakPoint = revenueTrend.reduce((currentPeak, point) => point.revenue > currentPeak.revenue ? point : currentPeak, revenueTrend[0] || {
        label: '',
        bucketKey: '',
        revenue: 0,
        orders: 0,
        averageOrderValue: 0,
      });
      const productMetrics = buildProductMetrics(analyticsOrders, previousOrders, products, daySpan);

      return {
        businessSummary: {
          todayRevenue: summarizeOrders(todayOrders).revenue,
          weekRevenue: summarizeOrders(weekOrders).revenue,
          monthRevenue: summarizeOrders(monthOrders).revenue,
          yearRevenue: summarizeOrders(yearOrders).revenue,
          todayOrders: todayOrders.length,
          weekOrders: weekOrders.length,
          monthOrders: monthOrders.length,
          yearOrders: yearOrders.length,
          averageOrderValue: analyticsSummary.averageOrderValue,
          conversionRate: analyticsSummary.conversionRate,
          revenueDelta: calculateDelta(analyticsSummary.revenue, previousSummary.revenue),
        },
        revenueAnalytics: {
          granularity: window.granularity,
          rangeMode: window.rangeMode,
          selectedMonthKey: window.selectedMonthKey,
          customRange: window.customRange,
          totalRevenue: analyticsSummary.revenue,
          dailyRevenue: daySpan > 0 ? roundMetric(analyticsSummary.revenue / daySpan) : analyticsSummary.revenue,
          projectedMonthlyRevenue: window.rangeMode === 'month' ? analyticsSummary.revenue : roundMetric((daySpan > 0 ? analyticsSummary.revenue / daySpan : analyticsSummary.revenue) * projectedDays),
          totalOrders: analyticsSummary.count,
          averageOrderValue: analyticsSummary.averageOrderValue,
          peakRevenueLabel: peakPoint.label,
          peakRevenueValue: peakPoint.revenue,
          deltaPercentage: calculateDelta(analyticsSummary.revenue, previousSummary.revenue),
          revenueTrend,
          productBreakdown: productMetrics.breakdown,
        },
        recentRevenueRecords: buildRecentRevenueRecords(yearOrders.length > 0 ? yearOrders : orders),
        productPerformance: productMetrics.performance,
      };
    },
  };
}

export const dashboardCommerceService = createDashboardCommerceService();
