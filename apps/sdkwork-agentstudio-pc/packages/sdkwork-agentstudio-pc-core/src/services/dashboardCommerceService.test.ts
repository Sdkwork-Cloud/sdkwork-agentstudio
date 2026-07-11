import assert from 'node:assert/strict';
import { createDashboardCommerceService } from './dashboardCommerceService.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'dashboardCommerceService derives commerce analytics from current generated sdk order and product payloads',
  async () => {
    let orderRequestCount = 0;
    let productRequestCount = 0;

    const service = createDashboardCommerceService({
      getNow: () => new Date('2026-03-24T12:00:00.000Z'),
      getSessionTokens: () => ({
        authToken: 'auth-token',
      }),
      getClient: () =>
        ({
          order: {
            listOrders: async (params?: Record<string, unknown>) => {
              orderRequestCount += 1;
              assert.equal(params?.page, '1');
              assert.equal(params?.size, '100');
              assert.ok(typeof params?.startTime === 'string');
              assert.ok(typeof params?.endTime === 'string');

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      orderId: '1',
                      orderSn: 'SN-001',
                      subject: 'VIP Membership',
                      paidAmount: '120.00',
                      status: 'COMPLETED',
                      paymentProvider: 'app',
                      payTime: '2026-03-24T09:00:00Z',
                    },
                    {
                      orderId: '2',
                      orderSn: 'SN-002',
                      subject: 'Copilot Pack',
                      paidAmount: '80.00',
                      status: 'PAID',
                      paymentProvider: 'wechat',
                      payTime: '2026-03-22T09:00:00Z',
                    },
                    {
                      orderId: '3',
                      orderSn: 'SN-003',
                      subject: 'VIP Membership',
                      totalAmount: '40.00',
                      status: 'DELIVERED',
                      createdAt: '2026-03-19T09:00:00Z',
                    },
                    {
                      orderId: '4',
                      orderSn: 'SN-004',
                      subject: 'Starter Kit',
                      paidAmount: '60.00',
                      status: 'COMPLETED',
                      payTime: '2026-03-15T09:00:00Z',
                    },
                    {
                      orderId: '5',
                      orderSn: 'SN-005',
                      subject: 'Starter Kit',
                      totalAmount: '50.00',
                      status: 'COMPLETED',
                      createdAt: '2026-02-27T09:00:00Z',
                    },
                  ],
                  totalElements: 5,
                  number: 0,
                  size: 100,
                  last: true,
                },
              };
            },
          },
          product: {
            getProducts: async (params?: Record<string, unknown>) => {
              productRequestCount += 1;
              assert.equal(params?.page, '1');
              assert.equal(params?.size, '50');

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '11',
                      title: 'VIP Membership',
                      price: 120,
                      sales: 3,
                    },
                    {
                      id: '22',
                      title: 'Copilot Pack',
                      price: 80,
                      sales: 1,
                    },
                    {
                      id: '33',
                      title: 'Starter Kit',
                      price: 60,
                      sales: 4,
                    },
                  ],
                  totalElements: 3,
                  number: 0,
                  size: 50,
                  last: true,
                },
              };
            },
          },
        }) as any,
    });

    const snapshot = await service.getCommerceSnapshot({
      granularity: 'day',
      rangeMode: 'seven_days',
    });

    assert.equal(snapshot.businessSummary.todayRevenue, 120);
    assert.equal(snapshot.businessSummary.weekRevenue, 240);
    assert.equal(snapshot.businessSummary.monthRevenue, 300);
    assert.equal(snapshot.businessSummary.yearRevenue, 350);
    assert.equal(snapshot.businessSummary.averageOrderValue, 80);
    assert.equal(snapshot.businessSummary.conversionRate, 100);
    assert.equal(snapshot.businessSummary.revenueDelta, 300);
    assert.equal(snapshot.revenueAnalytics.totalRevenue, 240);
    assert.equal(snapshot.revenueAnalytics.totalOrders, 3);
    assert.equal(snapshot.revenueAnalytics.averageOrderValue, 80);
    assert.equal(snapshot.revenueAnalytics.peakRevenueLabel, '03-24');
    assert.equal(snapshot.revenueAnalytics.peakRevenueValue, 120);
    const march22TrendPoint = snapshot.revenueAnalytics.revenueTrend.find(
      (item) => item.bucketKey === '2026-03-22',
    );
    assert.equal(march22TrendPoint?.revenue, 80);
    assert.equal(march22TrendPoint?.averageOrderValue, 80);
    assert.equal(snapshot.revenueAnalytics.productBreakdown[0]?.productName, 'VIP Membership');
    assert.equal(snapshot.revenueAnalytics.productBreakdown[0]?.share, 66.7);
    assert.equal(snapshot.recentRevenueRecords[0]?.status, 'completed');
    assert.equal(snapshot.recentRevenueRecords[1]?.channel, 'wechat');
    assert.equal(snapshot.productPerformance[0]?.id, '11');
    assert.equal(snapshot.productPerformance[0]?.orders, 2);
    assert.equal(orderRequestCount, 1);
    assert.equal(productRequestCount, 1);
  },
);

await runTest(
  'dashboardCommerceService returns an empty snapshot when no auth session is available',
  async () => {
    const service = createDashboardCommerceService({
      getNow: () => new Date('2026-03-24T12:00:00.000Z'),
      getSessionTokens: () => ({
        authToken: '',
      }),
      getClient: () => {
        throw new Error('should not request sdk client without auth');
      },
    });

    const snapshot = await service.getCommerceSnapshot({
      granularity: 'hour',
      rangeMode: 'custom',
      customStart: '2026-03-01',
      customEnd: '2026-03-24',
    });

    assert.equal(snapshot.businessSummary.todayRevenue, 0);
    assert.equal(snapshot.revenueAnalytics.granularity, 'hour');
    assert.equal(snapshot.revenueAnalytics.rangeMode, 'custom');
    assert.equal(snapshot.revenueAnalytics.customRange?.start, '2026-03-01');
    assert.equal(snapshot.revenueAnalytics.customRange?.end, '2026-03-24');
    assert.deepEqual(snapshot.recentRevenueRecords, []);
    assert.deepEqual(snapshot.productPerformance, []);
  },
);

await runTest(
  'dashboardCommerceService delegates commerce queries to the injected app client port when auth exists',
  async () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const service = createDashboardCommerceService({
      getNow: () => new Date('2026-03-24T12:00:00.000Z'),
      getSessionTokens: () => ({
        authToken: 'session-auth-token',
      }),
      getClient: () =>
        ({
          order: {
            listOrders: async (params?: Record<string, unknown>) => {
              calls.push({ method: 'listOrders', params });
              return {
                code: '2000',
                data: {
                  content: [],
                  totalElements: 0,
                  number: 0,
                  size: 100,
                  last: true,
                },
              };
            },
          },
          product: {
            getProducts: async (params?: Record<string, unknown>) => {
              calls.push({ method: 'getProducts', params });
              return {
                code: '2000',
                data: {
                  content: [],
                  totalElements: 0,
                  number: 0,
                  size: 50,
                  last: true,
                },
              };
            },
          },
        }) as any,
    });

    await service.getCommerceSnapshot({
      granularity: 'day',
      rangeMode: 'month',
      monthKey: '2026-03',
    });

    assert.deepEqual(calls.map((call) => call.method), ['listOrders', 'getProducts']);
    assert.equal(calls[0]?.params?.page, '1');
    assert.equal(calls[0]?.params?.size, '100');
    assert.equal(typeof calls[0]?.params?.startTime, 'string');
    assert.equal(typeof calls[0]?.params?.endTime, 'string');
    assert.equal(calls[1]?.params?.page, '1');
    assert.equal(calls[1]?.params?.size, '50');
  },
);
